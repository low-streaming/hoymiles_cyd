import logging
import asyncio
import os
import json
from typing import Optional

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.config_entries import ConfigEntry

from .const import (
    DOMAIN,
    CONF_ZERO_EXPORT_ENABLED,
    CONF_GRID_SENSOR,
    CONF_ZERO_EXPORT_TARGET,
    CONF_ZERO_EXPORT_MIN_LIMIT,
    CONF_ZERO_EXPORT_MAX_LIMIT,
    HASS_DTU,
    HASS_DATA_COORDINATOR,
)

_LOGGER = logging.getLogger(__name__)

class ZeroExportManager:
    """Manages Zero Export logic."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry):
        """Initialize the manager."""
        self.hass = hass
        self.entry = entry
        self._enabled = entry.options.get(CONF_ZERO_EXPORT_ENABLED, False)
        self._grid_sensor = entry.options.get(CONF_GRID_SENSOR)
        self._target_watt = 0.0
        self._min_limit = 10.0
        self._max_limit = 100.0
        self._max_capacity = 800 # Default fallback
        self._unsub = None
        self._last_limit = None
        self._is_updating = False
        self._callbacks = []
        self._config = {}
        self._battery_empty_mode = False
        self._unsub_batt = None
        self._unsub_sub = None

    def add_state_change_callback(self, callback_func):
        """Add callback for state changes."""
        if callback_func not in self._callbacks:
            self._callbacks.append(callback_func)
            
    def set_on_state_change(self, callback_func):
        """Deprecated: Use add_state_change_callback."""
        self.add_state_change_callback(callback_func)

    def _trigger_callbacks(self):
        """Trigger all registered state change callbacks."""
        for callback_func in self._callbacks:
            try:
                callback_func()
            except Exception as e:
                _LOGGER.error(f"Error in Zero Export state callback: {e}")

    @property
    def status(self) -> str:
        """Return current status."""
        mode = self._config.get("operation_mode", "zero_export")
        if mode == "disabled":
            return "Inaktiv"
        
        if not self._enabled:
            return "Ausgeschaltet (Schalter)"
            
        if getattr(self, '_battery_empty_mode', False):
            return "Akku Leer (Schutz)"
            
        if mode == "zero_export" and not self._grid_sensor:
            return "Konf-Fehler (Zähler?)"
            
        if self._last_limit is None:
            return "Warte auf Messwerte"
            
        if mode == "base_load":
            return "Läuft (Grundlast)"
            
        return "Läuft (ZEN)" if mode == "zero_export" else "Manuell"

    @property
    def last_limit(self) -> Optional[float]:
        """Return last set limit."""
        return self._last_limit

    @property
    def is_enabled(self) -> bool:
        """Return True if enabled."""
        return self._enabled

    @is_enabled.setter
    def is_enabled(self, value: bool):
        """Enable or disable logic."""
        if value == self._enabled:
            return
        
        _LOGGER.info(f"Zero Export Manager: Changing enabled state to {value}")
        self._enabled = value
        self._update_tracker()
        if not value:
            self.stop()
            
        self._trigger_callbacks()
            
        # Save state to persistent JSON
        self.hass.async_create_task(self.async_save_config())

    async def async_save_config(self):
        """Save current config to JSON."""
        json_path = self.hass.config.path("hoymiles_cyd_config.json")
        self._config["is_enabled"] = self._enabled
        
        def save():
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(self._config, f, indent=2)
        
        try:
            await self.hass.async_add_executor_job(save)
        except Exception as e:
            _LOGGER.error(f"Failed to save zero export config: {e}")

    @property
    def target_power(self) -> float:
        """Return target power."""
        return self._target_watt

    @target_power.setter
    def target_power(self, value: float):
        """Set target power."""
        self._target_watt = float(value)

    async def async_setup(self):
        """Set up the zero export logic."""
        options = self.entry.options
        self._enabled = options.get(CONF_ZERO_EXPORT_ENABLED, False)
        self._grid_sensor = options.get(CONF_GRID_SENSOR)
        self._target_watt = options.get(CONF_ZERO_EXPORT_TARGET, 0)
        self._min_limit = options.get(CONF_ZERO_EXPORT_MIN_LIMIT, 10)
        self._max_limit = options.get(CONF_ZERO_EXPORT_MAX_LIMIT, 100)
        
        # Estimate max capacity from inverter list if possible
        self._max_capacity = options.get("max_capacity", 800)

        # Load existing JSON config if any
        json_path = self.hass.config.path("hoymiles_cyd_config.json")
        
        def load_json():
            if os.path.exists(json_path):
                with open(json_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            return None

        config = await self.hass.async_add_executor_job(load_json)
        if config:
            self._config = config
            self._enabled = config.get("is_enabled", self._enabled)
            self._grid_sensor = config.get("grid_sensor", self._grid_sensor)
            self._target_watt = float(config.get("target_grid_watt", self._target_watt))
            self._max_capacity = float(config.get("max_capacity", self._max_capacity))

        self._update_tracker()

    def _update_tracker(self):
        """Update sensor trackers based on mode and state."""
        if self._unsub:
            self._unsub()
            self._unsub = None
            
        if self._unsub_batt:
            self._unsub_batt()
            self._unsub_batt = None
            
        if not self._enabled:
            return
            
        batt_sensor = self._config.get("battery_soc_sensor")
        if self._config.get("battery_protection_enabled") and batt_sensor:
            self._unsub_batt = async_track_state_change_event(
                self.hass, [batt_sensor], self._handle_battery_change
            )

        mode = self._config.get("operation_mode", "zero_export")
        if mode == "zero_export":
            if self._grid_sensor:
                _LOGGER.info(f"Zero Export: Tracking grid sensor {self._grid_sensor}")
                self._unsub = async_track_state_change_event(
                    self.hass, [self._grid_sensor], self._handle_grid_change
                )
        elif mode == "base_load":
            plugs = []
            for i in range(1, 7):
                plug = self._config.get(f"base_plug_{i}")
                if plug:
                    plugs.append(plug)
            if plugs:
                _LOGGER.info(f"Zero Export: Tracking {len(plugs)} plugs for base load")
                self._unsub = async_track_state_change_event(
                    self.hass, plugs, self._handle_base_load_change
                )
            
            # Sub-consumers tracking (always track if sensor is set, to trigger UI updates or calculation)
            sub_plugs = []
            for i in range(1, 5):
                plug = self._config.get(f"sub_consumer_{i}_sensor")
                if plug:
                    sub_plugs.append(plug)
            
            if sub_plugs:
                _LOGGER.info(f"Zero Export: Tracking {len(sub_plugs)} sub-consumers")
                # We reuse the same handler if we want them to trigger calculation
                # If they are NOT used as load, they just update the UI (which happens via HASS events anyway)
                # but if they ARE used as load, we need to handle their changes.
                self._unsub_sub = async_track_state_change_event(
                    self.hass, sub_plugs, self._handle_base_load_change
                )
            
            if not plugs and not sub_plugs:
                _LOGGER.info("Zero Export: Base load mode active with static load only")
                
            # Trigger initial update always
            self.hass.async_create_task(self._handle_base_load_change(None))
        elif mode == "manual_limit":
             # Manual mode might not need trackers, but we could track a number entity
             pass

    def stop(self):
        """Stop the zero export logic."""
        if self._unsub:
            self._unsub()
            self._unsub = None
        if self._unsub_batt:
            self._unsub_batt()
            self._unsub_batt = None
        if self._unsub_sub:
            self._unsub_sub()
            self._unsub_sub = None

    def update_config(self, config: dict):
        """Update configuration from external source (Panel)."""
        _LOGGER.info(f"Updating Zero Export configuration from Panel: {config}")
        self._config = config
        
        # Apply enabled state from Panel
        if "is_enabled" in config:
            self.is_enabled = config["is_enabled"]
            
        self._target_watt = float(config.get("target_grid_watt", self._target_watt))
        self._max_capacity = float(config.get("max_capacity", self._max_capacity))
        self._grid_sensor = config.get("grid_sensor", self._grid_sensor)
        
        self._update_tracker()

    async def _handle_battery_change(self, event):
        """Handle battery SOC change to trigger limit updates."""
        mode = self._config.get("operation_mode", "zero_export")
        if mode == "zero_export":
            if self._grid_sensor:
                state = self.hass.states.get(self._grid_sensor)
                if state:
                    class MockEvent:
                        def __init__(self, data):
                            self.data = data
                    await self._handle_grid_change(MockEvent({"new_state": state}))
        elif mode == "base_load":
            await self._handle_base_load_change(None)

    async def _handle_base_load_change(self, event):
        """Handle change in one of the base load plugs."""
        if self._is_updating:
            return
            
        total_load = 0.0
        # Add static base load
        try:
            val = self._config.get("static_base_load")
            if val:
                total_load += float(val)
        except (ValueError, TypeError):
            pass

        for i in range(1, 7):
            plug = self._config.get(f"base_plug_{i}")
            if plug:
                state = self.hass.states.get(plug)
                if state and state.state not in ("unavailable", "unknown"):
                    try:
                        total_load += float(state.state)
                    except ValueError:
                        pass
        
        # Add sub-consumers if they are marked as 'use_as_load'
        for i in range(1, 5):
            if self._config.get(f"sub_consumer_{i}_use_as_load"):
                sensor = self._config.get(f"sub_consumer_{i}_sensor")
                if sensor:
                    state = self.hass.states.get(sensor)
                    if state and state.state not in ("unavailable", "unknown"):
                        try:
                            total_load += float(state.state)
                        except ValueError:
                            pass
        
        
        # Production should match base load + offset
        desired_production = total_load + self._target_watt
        _LOGGER.debug(f"Zero Export (Base Load): Static + Plugs = {total_load}W, Target Offset = {self._target_watt}W, Desired = {desired_production}W")
        await self._apply_production_limit(desired_production)

    async def _handle_grid_change(self, event):
        """Handle grid sensor state change."""
        if self._is_updating:
            return

        new_state = event.data.get("new_state")
        if not new_state or new_state.state in ("unavailable", "unknown"):
            return

        try:
            grid_power = float(new_state.state)
            scale = self._config.get("grid_power_scale")
            if scale == "kw_to_w": grid_power *= 1000
            elif scale == "w_to_kw": grid_power /= 1000
        except ValueError:
            return

        # Get current production (W)
        current_production = await self._get_current_production()
        
        # Desired Production = Current + Grid - Target
        desired_production = current_production + grid_power - self._target_watt
        await self._apply_production_limit(desired_production)

    async def _get_current_production(self):
        """Get current solar power production."""
        try:
            hass_data = self.hass.data[DOMAIN].get(self.entry.entry_id)
            if not hass_data:
                return 0.0

            coordinator = hass_data.get(HASS_DATA_COORDINATOR)
            current_production = 0.0
            
            if coordinator and hasattr(coordinator, "data") and coordinator.data:
                if hasattr(coordinator.data, 'total_ac_power'):
                   current_production = coordinator.data.total_ac_power
                elif isinstance(coordinator.data, dict):
                   current_production = coordinator.data.get('total_ac_power', 0)
            
            if current_production == 0:
                sensor_id = self._config.get("solar_power_sensor")
                if not sensor_id:
                    sensor_id = f"sensor.hoymiles_cyd_ac_power"
                
                states = self.hass.states.get(sensor_id)
                if states and states.state not in ("unavailable", "unknown"):
                    current_production = float(states.state)
                    scale = self._config.get("solar_power_scale")
                    if scale == "kw_to_w": current_production *= 1000
                    elif scale == "w_to_kw": current_production /= 1000
            return current_production
        except Exception:
            return 0.0

    async def _apply_production_limit(self, desired_production):
        """Calculate and set new power limit based on desired production (W)."""
        if self._is_updating:
            return
            
        self._is_updating = True
        try:
            hass_data = self.hass.data[DOMAIN].get(self.entry.entry_id)
            if not hass_data:
                return

            dtu = hass_data.get(HASS_DTU)
            
            # Safety: don't let desired production go below 0
            desired_production = max(0.0, desired_production)
            
            # Batteryschutz (Battery Protection)
            batt_sensor = self._config.get("battery_soc_sensor")
            batt_enabled = self._config.get("battery_protection_enabled")
            if batt_enabled and batt_sensor:
                state = self.hass.states.get(batt_sensor)
                if state and state.state not in ("unknown", "unavailable"):
                    try:
                        soc = float(state.state)
                        min_soc = float(self._config.get("battery_min_soc", 10))
                        restart_soc = float(self._config.get("battery_restart_soc", 15))
                        
                        if soc <= min_soc:
                            if not self._battery_empty_mode:
                                _LOGGER.info(f"Battery Protection: SOC {soc}% <= {min_soc}%. STOPPING export.")
                            self._battery_empty_mode = True
                        elif soc >= restart_soc:
                            if self._battery_empty_mode:
                                _LOGGER.info(f"Battery Protection: SOC {soc}% >= {restart_soc}%. RESUMING export.")
                            self._battery_empty_mode = False
                    except ValueError:
                        pass
            
            # New Limit % = (Desired / MaxCapacity) * 100
            new_limit = (desired_production / self._max_capacity) * 100
            
            # Apply constraints overrides for empty battery
            if self._battery_empty_mode:
                new_limit = 0.0
                desired_production = 0.0
            else:
                new_limit = max(float(self._min_limit), min(float(self._max_limit), new_limit))
                
            new_limit = round(new_limit, 1)

            # Avoid small jitter
            if self._last_limit is None or abs(self._last_limit - new_limit) >= 0.5:
                mode = self._config.get("operation_mode", "zero_export")
                inv_type = self._config.get("inverter_type", "hoymiles")
                
                if mode == "disabled":
                    return

                if inv_type == "hoymiles" and dtu:
                    target_inverter = self._config.get("selected_inverter", "all")
                    _LOGGER.info(f"Zero Export (Hoymiles): Adjusting limit to {new_limit}% (Target: {target_inverter})")
                    if target_inverter == "all":
                        await dtu.async_set_power_limit(new_limit)
                    else:
                        try:
                            await dtu.async_set_power_limit(new_limit, [target_inverter])
                        except Exception:
                            await dtu.async_set_power_limit(new_limit)
                elif inv_type != "hoymiles":
                    # Generic / OpenDTU / AhoyDTU
                    limit_entity = self._config.get("external_limit_entity")
                    if not limit_entity:
                        _LOGGER.warning(f"Zero Export: External mode {inv_type} enabled but no limit entity configured")
                        return
                    
                    limit_unit = self._config.get("generic_limit_type", "watt")
                    final_value = desired_production if limit_unit == "watt" else new_limit
                    
                    if limit_unit == "watt":
                        final_value = min(float(self._max_capacity), final_value)
                        final_value = round(final_value, 0)
                    
                    _LOGGER.info(f"Zero Export (Generic): Setting {limit_entity} to {final_value} {limit_unit}")
                    
                    domain_part = limit_entity.split('.')[0]
                    await self.hass.services.async_call(
                        domain_part,
                        "set_value",
                        {"entity_id": limit_entity, "value": final_value},
                        blocking=True
                    )
                
                self._last_limit = new_limit
                self._trigger_callbacks()
                
        except Exception as err:
            _LOGGER.error(f"Error in Zero Export adjustment: {err}")
        finally:
            self._is_updating = False
