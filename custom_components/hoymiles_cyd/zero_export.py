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
        self._max_capacity = 800.0 # Default fallback
        self._unsub = None
        self._last_limit: float | None = None
        self._is_updating = False
        self._callbacks = []
        self._unsub_sub = None
        self._unsub_batt = None
        self._hysteresis = 5.0
        self._zero_export_interval = 10.0
        self._grid_sensor_type = "net"
        self._battery_empty_mode = False
        self._config = {}
        self._last_current_production = 0.0
        self._last_desired_production = 0.0
        self._last_valid_load = 0.0
        self._last_ramp_limit = -1.0
        self._last_interval = 10.0
        self._last_limit_watts = 0.0

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
        self._max_capacity = float(options.get("max_capacity", 800.0))

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
            self._min_limit = float(config.get("min_limit", self._min_limit))
            self._max_limit = float(config.get("max_limit", self._max_limit))
            self._hysteresis = float(config.get("zero_export_hysteresis", 5.0))
            self._zero_export_interval = float(config.get("zero_export_interval", 10.0))
            self._grid_sensor_type = config.get("grid_sensor_type", "net")

        self._update_tracker()

    def _update_tracker(self):
        """Update sensor trackers based on mode and state."""
        u = getattr(self, '_unsub', None)
        if u and callable(u):
            try: u()
            except Exception: pass
            self._unsub = None
            
        ub = getattr(self, '_unsub_batt', None)
        if ub and callable(ub):
            try: ub()
            except Exception: pass
            self._unsub_batt = None
            
        us = getattr(self, '_unsub_sub', None)
        if us and callable(us):
            try: us()
            except Exception: pass
            self._unsub_sub = None
            
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
            
            # Phase tracking
            phases = []
            for i in range(1, 4):
                p = self._config.get(f"grid_sensor_l{i}")
                if p: phases.append(p)
            
            if phases:
                _LOGGER.info(f"Zero Export: Tracking {len(phases)} phases for summing")
                self._unsub_phases = async_track_state_change_event(
                    self.hass, phases, self._handle_grid_change
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
            if self._config.get("enable_sub_consumers"):
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
            _LOGGER.info("Zero Export: Manual mode active. Applying static manual limit.")
            self.hass.async_create_task(self._apply_manual_limit())

    def stop(self):
        """Stop the zero export logic."""
        if self._unsub and callable(self._unsub):
            try: self._unsub()
            except Exception: pass
            self._unsub = None
            
        if self._unsub_batt and callable(self._unsub_batt):
            try: self._unsub_batt()
            except Exception: pass
            self._unsub_batt = None
            
        if self._unsub_sub and callable(self._unsub_sub):
            try: self._unsub_sub()
            except Exception: pass
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
        self._min_limit = float(config.get("min_limit", self._min_limit))
        self._max_limit = float(config.get("max_limit", self._max_limit))
        self._grid_sensor = config.get("grid_sensor", self._grid_sensor)
        self._hysteresis = float(config.get("zero_export_hysteresis", 5.0))
        self._zero_export_interval = float(config.get("zero_export_interval", 10.0))
        self._grid_sensor_type = config.get("grid_sensor_type", "net")
        
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
        
        # Add sub-consumers if they are active and marked as 'use_as_load'
        if self._config.get("enable_sub_consumers"):
            for i in range(1, 5):
                if self._config.get(f"sub_consumer_{i}_use_as_load"):
                    sensor = self._config.get(f"sub_consumer_{i}_sensor")
                    if sensor:
                        state = self.hass.states.get(sensor)
                        if state and state.state not in ("unavailable", "unknown"):
                            try:
                                val = float(state.state)
                                scale = self._config.get(f"sub_consumer_{i}_scale")
                                if scale == "kw_to_w":
                                    val *= 1000
                                total_load += val
                            except ValueError:
                                pass
        
        
        # Production should match base load + offset
        desired_production = total_load + self._target_watt
        _LOGGER.debug(f"Zero Export (Base Load): Static + Plugs = {total_load}W, Target Offset = {self._target_watt}W, Desired = {desired_production}W")
        self._last_current_production = total_load
        self._last_desired_production = desired_production
        await self._apply_production_limit(desired_production, total_load)

    async def _handle_grid_change(self, event):
        """Handle grid sensor state change."""
        if self._is_updating:
            return

        new_state = event.data.get("new_state")
        if not new_state or new_state.state in ("unavailable", "unknown"):
            return

        try:
            if event and event.data.get("new_state"):
                # Standard single sensor change
                grid_power = float(event.data.get("new_state").state)
                scale = self._config.get("grid_power_scale")
                if scale == "kw_to_w": grid_power *= 1000
                elif scale == "w_to_kw": grid_power /= 1000
            else:
                # Summing mode or manual trigger
                grid_power = 0.0
                if self._grid_sensor:
                    s = self.hass.states.get(self._grid_sensor)
                    if s and s.state not in ("unavailable", "unknown"):
                        grid_power = float(s.state)
                else:
                    # Sum phases
                    for i in range(1, 4):
                        p = self._config.get(f"grid_sensor_l{i}")
                        if p:
                            s = self.hass.states.get(p)
                            if s and s.state not in ("unavailable", "unknown"):
                                grid_power += float(s.state)
                
                scale = self._config.get("grid_power_scale")
                if scale == "kw_to_w": grid_power *= 1000
                elif scale == "w_to_kw": grid_power /= 1000

            self._last_valid_load = grid_power
        except (ValueError, TypeError):
            grid_power = self._last_valid_load

        # Get current production (W)
        current_production = self._get_current_production()
        
        # Calculate desired production based on sensor type
        if self._grid_sensor_type == "consumption":
            # Grid sensor already represents house load
            desired_production = grid_power - self._target_watt
            _LOGGER.debug(f"Zero Export (Consumption Mode): House Load = {grid_power}W, TargetOffset = {self._target_watt}W, Desired = {desired_production}W")
        else:
            # Grid sensor is Net (Import/Export)
            desired_production = current_production + grid_power - self._target_watt
            _LOGGER.debug(f"Zero Export (Net Mode): CurrentProdu = {current_production}W, Grid = {grid_power}W, TargetOffset = {self._target_watt}W, Desired = {desired_production}W")
            
        self._last_current_production = current_production
        self._last_desired_production = desired_production
        await self._apply_production_limit(desired_production, grid_power)

    def _get_current_production(self) -> float:
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
                    try:
                        current_production = float(states.state)
                        scale = self._config.get("solar_power_scale")
                        if scale == "kw_to_w": current_production *= 1000
                        elif scale == "w_to_kw": current_production /= 1000
                    except ValueError:
                        current_production = self._last_valid_production
                else:
                    # Sensor flicker/offline -> use last known value
                    current_production = self._last_valid_production
            
            if current_production > 0:
                self._last_valid_production = current_production
                
            return current_production
        except Exception:
            return self._last_valid_production

    async def _apply_production_limit(self, desired_production, grid_power):
        """Calculate and set new power limit based on desired production (W)."""
        import time
        now = time.time()
        
        # Cooldown: only allow updates every X seconds to prevent oscillation
        interval = self._last_interval
        last_exec = float(getattr(self, '_last_execution_time', 0.0))
        
        # Check battery protection first
        batt_sensor = self._config.get("battery_soc_sensor")
        batt_enabled = self._config.get("battery_protection_enabled")
        if batt_enabled and batt_sensor:
            state = self.hass.states.get(batt_sensor)
            if state and state.state not in ("unknown", "unavailable"):
                try:
                    soc = float(state.state)
                    min_soc = float(self._config.get("battery_min_soc", 10))
                    
                    # --- NIGHT RESERVE ---
                    night_enabled = self._config.get("night_reserve_enabled")
                    if night_enabled:
                        try:
                            from datetime import datetime
                            now_time = datetime.now().strftime("%H:%M")
                            start_time = self._config.get("night_reserve_start_time", "18:00")
                            if now_time >= start_time:
                                night_soc = float(self._config.get("night_reserve_soc", 25))
                                if night_soc > min_soc:
                                    min_soc = night_soc
                                    _LOGGER.debug(f"Night Reserve active: Raising min_soc to {min_soc}%")
                        except Exception as e:
                            _LOGGER.error(f"Error calculating night reserve: {e}")

                    restart_soc = float(self._config.get("battery_restart_soc", 15))
                    if restart_soc < min_soc: restart_soc = min_soc + 2 # Safety buffer
                    
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
        
        if self._is_updating or (now - last_exec < interval and not self._battery_empty_mode):
            return
            
        self._is_updating = True
        self._last_execution_time = now
        
        try:
            hass_data = self.hass.data[DOMAIN].get(self.entry.entry_id)
            if not hass_data: return

            dtu = hass_data.get(HASS_DTU)
            inv_type = self._config.get("inverter_type", "hoymiles")
            
            # --- ADAPTIVE INTERVAL ---
            target_lower = float(self._config.get("zero_export_target_lower", -10))
            target_upper = float(self._config.get("zero_export_target_upper", 20))
            
            is_stable = target_lower <= grid_power <= target_upper
            min_int = float(self._config.get("zero_export_min_interval", 5.0))
            max_int = float(self._config.get("zero_export_max_interval", 60.0))
            
            self._last_interval = max_int if is_stable else min_int

            # Check if we actually need to update (Range check)
            if is_stable and self._last_limit is not None:
                _LOGGER.debug(f"Zero Export: Grid power {grid_power}W within target range [{target_lower}, {target_upper}]. Skipping.")
                return

            # --- WETTER SCHUTZ ---
            weather_enabled = self._config.get("weather_protection_enabled")
            weather_sensor = self._config.get("weather_sensor")
            if weather_enabled and weather_sensor:
                w_state = self.hass.states.get(weather_sensor)
                if w_state and w_state.state in ("rainy", "pouring", "cloudy", "thunderstorm", "snowy"):
                    # Reduce desired production by 30% to keep battery reserve
                    _LOGGER.info(f"Weather Protection: Forecast is {w_state.state}. Reducing discharge target to preserve battery.")
                    desired_production *= 0.7

            # --- RAMP LIMITING ---
            ramp_rate = float(self._config.get("zero_export_ramp_rate", 50.0))
            if ramp_rate > 0 and self._last_limit_watts > 0:
                dt = now - last_exec
                max_change = ramp_rate * dt
                diff = desired_production - self._last_limit_watts
                if abs(diff) > max_change:
                    desired_production = self._last_limit_watts + (max_change if diff > 0 else -max_change)
                    _LOGGER.debug(f"Zero Export: Ramp Limit. Capped to {desired_production}W")

            desired_production = max(0.0, desired_production)
            
            # Calculate limits
            if self._battery_empty_mode:
                final_percent = 0.0
                final_watts = 0.0
            else:
                final_percent = max(float(self._min_limit), min(float(self._max_limit), (desired_production / self._max_capacity) * 100))
                min_watts = (float(self._min_limit) / 100.0) * float(self._max_capacity)
                max_watts = (float(self._max_limit) / 100.0) * float(self._max_capacity)
                final_watts = max(min_watts, min(max_watts, float(desired_production)))
                
            final_percent = round(float(final_percent), 1)
            final_watts = int(round(float(final_watts), 0))

            limit_unit = self._config.get("generic_limit_type", "percent") if inv_type != "hoymiles" else "percent"
            current_target = final_watts if limit_unit == "watt" else final_percent
            
            jitter_threshold = self._hysteresis if limit_unit == "watt" else max(0.2, (self._hysteresis / self._max_capacity) * 100)
            
            if self._last_limit is None or abs(float(self._last_limit) - current_target) >= jitter_threshold:
                if inv_type == "hoymiles" and dtu:
                    target_inverter = self._config.get("selected_inverter", "all")
                    _LOGGER.info(f"Zero Export (Hoymiles): Adjusting limit to {final_percent}% ({final_watts}W, Target: {target_inverter}, Int: {self._last_interval}s)")
                    if target_inverter == "all":
                        await dtu.async_set_power_limit(final_percent)
                    else:
                        await dtu.async_set_power_limit(final_percent, [target_inverter])
                elif inv_type != "hoymiles":
                    limit_entity = self._config.get("external_limit_entity")
                    if limit_entity:
                        ent_state = self.hass.states.get(limit_entity)
                        if ent_state and ent_state.state not in ("unavailable", "unknown"):
                            domain_part = limit_entity.split('.')[0]
                            service = "select_option" if domain_part in ("select", "input_select") else "set_value"
                            service_data = {"entity_id": limit_entity, ("option" if service == "select_option" else "value"): (str(current_target) if service == "select_option" else current_target)}
                            
                            _LOGGER.info(f"Zero Export ({inv_type}): Setting {limit_entity} to {current_target} (Int: {self._last_interval}s)")
                            await self.hass.services.async_call(domain_part, service, service_data, blocking=True)
                
                self._last_limit = current_target
                self._last_limit_watts = final_watts
                self._trigger_callbacks()
        except Exception as err:
            _LOGGER.error(f"Error in Zero Export adjustment: {err}")
        finally:
            self._is_updating = False

    async def _apply_manual_limit(self):
        """Directly apply manual limit without hysteresis or constraints."""
        try:
            val = float(self._config.get("manual_limit_value", 50.0))
            manual_unit = self._config.get("manual_limit_type", "percent")
        except ValueError:
            return
            
        inv_type = self._config.get("inverter_type", "hoymiles")
        target_val = val
        
        # Determine if we need to convert W -> %
        needs_percent = True
        if inv_type != "hoymiles":
            generic_unit = self._config.get("generic_limit_type", "percent")
            if generic_unit != "percent":
                needs_percent = False
                
        if manual_unit == "watt" and needs_percent:
            max_cap = float(self._config.get("max_capacity", 800.0))
            if max_cap > 0:
                target_val = (val / max_cap) * 100.0
                target_val = min(100.0, max(0.0, float(target_val)))
                target_val = round(target_val, 1)

        self._last_limit = target_val
        self._trigger_callbacks()
        
        try:
            if inv_type == "hoymiles":
                hass_data = self.hass.data[DOMAIN].get(self.entry.entry_id)
                if hass_data and hass_data.get(HASS_DTU):
                    dtu = hass_data[HASS_DTU]
                    target_inverter = self._config.get("selected_inverter", "all")
                    _LOGGER.info(f"Zero Export (Manual): Setting direct limit to {target_val} (Target: {target_inverter})")
                    if target_inverter == "all":
                        await dtu.async_set_power_limit(target_val)
                    else:
                        try:
                            await dtu.async_set_power_limit(target_val, [target_inverter])
                        except Exception as e:
                            await dtu.async_set_power_limit(target_val)
            else:
                limit_entity = self._config.get("external_limit_entity")
                if limit_entity:
                    domain_part = limit_entity.split('.')[0]
                    service = "set_value"
                    service_data = {"entity_id": limit_entity, "value": target_val}
                    
                    if domain_part in ("select", "input_select"):
                        service = "select_option"
                        service_data = {"entity_id": limit_entity, "option": str(target_val)}
                        
                    _LOGGER.info(f"Zero Export (Manual): Setting {limit_entity} to {target_val}")
                    await self.hass.services.async_call(
                        domain_part,
                        service,
                        service_data,
                        blocking=True
                    )
        except Exception as e:
            _LOGGER.error(f"Failed to apply manual limit: {e}")
