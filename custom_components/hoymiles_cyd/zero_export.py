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
        self._config = {}
        self._on_state_change = None

    def set_on_state_change(self, callback_func):
        """Set callback for state changes."""
        self._on_state_change = callback_func

    @property
    def status(self) -> str:
        """Return current status."""
        mode = self._config.get("operation_mode", "zero_export")
        if mode == "disabled":
            return "Inaktiv"
        
        if not self._enabled:
            return "Ausgeschaltet (Schalter)"
            
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
            
        if self._on_state_change:
            self._on_state_change()
            
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
            
        if not self._enabled:
            return

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
                # Trigger initial update
                self.hass.async_create_task(self._handle_base_load_change(None))
        elif mode == "manual_limit":
             # Manual mode might not need trackers, but we could track a number entity
             pass

    def stop(self):
        """Stop the zero export logic."""
        if self._unsub:
            self._unsub()
            self._unsub = None

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

    async def _handle_base_load_change(self, event):
        """Handle change in one of the base load plugs."""
        if self._is_updating:
            return
            
        total_load = 0.0
        # Add static base load
        try:
            total_load += float(self._config.get("static_base_load", 0))
        except ValueError:
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
        
        # Production should match base load + offset
        desired_production = total_load + self._target_watt
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
            
            # New Limit % = (Desired / MaxCapacity) * 100
            new_limit = (desired_production / self._max_capacity) * 100
            
            # Apply constraints
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
                if self._on_state_change:
                    self._on_state_change()
                
        except Exception as err:
            _LOGGER.error(f"Error in Zero Export adjustment: {err}")
        finally:
            self._is_updating = False
