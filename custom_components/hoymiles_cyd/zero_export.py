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
        self._enabled = False
        self._grid_sensor = None
        self._target_watt = 0.0
        self._min_limit = 10.0
        self._max_limit = 100.0
        self._max_capacity = 800 # Default fallback
        self._unsub = None
        self._last_limit = None
        self._is_updating = False
        self._config = {}

    @property
    def status(self) -> str:
        """Return current status."""
        mode = self._config.get("operation_mode", "zero_export")
        if mode == "disabled":
            return "Inaktiv"
        if not self._enabled:
            return "Deaktiviert (Switch)"
        if not self._grid_sensor:
            return "Konfigurationsfehler"
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
        self._enabled = value
        if value:
            if not self._unsub and self._grid_sensor:
                _LOGGER.info(f"Enabling Zero Export for {self._grid_sensor}")
                self._unsub = async_track_state_change_event(
                    self.hass, [self._grid_sensor], self._handle_grid_change
                )
        else:
            self.stop()

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
            self._grid_sensor = config.get("grid_sensor", self._grid_sensor)
            self._target_watt = float(config.get("target_grid_watt", self._target_watt))

        if self._enabled and self._grid_sensor:
            _LOGGER.info(f"Setting up Zero Export for {self._grid_sensor} (Target: {self._target_watt}W)")
            self._unsub = async_track_state_change_event(
                self.hass, [self._grid_sensor], self._handle_grid_change
            )

    def stop(self):
        """Stop the zero export logic."""
        if self._unsub:
            self._unsub()
            self._unsub = None

    def update_config(self, config: dict):
        """Update configuration from external source (Panel)."""
        _LOGGER.info(f"Updating Zero Export configuration from Panel: {config}")
        self._config = config
        new_sensor = config.get("grid_sensor")
        self._target_watt = float(config.get("target_grid_watt", self._target_watt))
        
        if new_sensor and new_sensor != self._grid_sensor:
            self.stop()
            self._grid_sensor = new_sensor
            if self._enabled:
                _LOGGER.info(f"Re-starting Zero Export with new sensor: {new_sensor}")
                self._unsub = async_track_state_change_event(
                    self.hass, [self._grid_sensor], self._handle_grid_change
                )

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

        await self._adjust_power(grid_power)

    async def _adjust_power(self, grid_power):
        """Calculate and set new power limit."""
        if self._is_updating:
            return
            
        self._is_updating = True
        try:
            hass_data = self.hass.data[DOMAIN].get(self.entry.entry_id)
            if not hass_data:
                return

            dtu = hass_data.get(HASS_DTU)
            coordinator = hass_data.get(HASS_DATA_COORDINATOR)
            
            inv_type = self._config.get("inverter_type", "hoymiles")
            if inv_type == "hoymiles" and (not dtu or not coordinator):
                return

            # Get current production (W)
            current_production = 0
            # Try to get it from the coordinator's data directly
            if coordinator and hasattr(coordinator, "data") and coordinator.data:
                # Assuming the coordinator data has a total_ac_power attribute or similar
                # If it's a list or dict, we need to adapt
                if hasattr(coordinator.data, 'total_ac_power'):
                   current_production = coordinator.data.total_ac_power
                elif isinstance(coordinator.data, dict):
                   current_production = coordinator.data.get('total_ac_power', 0)
            
            # If still 0, try to find the actual sensor state
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

            # Desired Production = Current + Grid - Target
            # grid_power > 0 (Import), grid_power < 0 (Export)
            # Target is what we want the grid to show (e.g. 0)
            
            desired_production = current_production + grid_power - self._target_watt
            
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

                if inv_type == "hoymiles":
                    target_inverter = self._config.get("selected_inverter", "all")
                    _LOGGER.info(f"Zero Export (Hoymiles): Adjusting limit to {new_limit}% (Target: {target_inverter})")
                    if target_inverter == "all":
                        await dtu.async_set_power_limit(new_limit)
                    else:
                        try:
                            await dtu.async_set_power_limit(new_limit, [target_inverter])
                        except Exception:
                            await dtu.async_set_power_limit(new_limit)
                else:
                    # Generic / OpenDTU / AhoyDTU
                    limit_entity = self._config.get("external_limit_entity")
                    if not limit_entity:
                        _LOGGER.warning(f"Zero Export: External mode {inv_type} enabled but no limit entity configured")
                        return
                    
                    limit_unit = self._config.get("generic_limit_type", "watt")
                    final_value = desired_production if limit_unit == "watt" else new_limit
                    
                    # Apply max capacity limit for absolute watt mode
                    if limit_unit == "watt":
                        final_value = min(float(self._max_capacity), final_value)
                        final_value = round(final_value, 0) # Watts usually don't need decimals in most WRs
                    
                    _LOGGER.info(f"Zero Export (Generic): Setting {limit_entity} to {final_value} {limit_unit}")
                    
                    domain_part = limit_entity.split('.')[0]
                    await self.hass.services.async_call(
                        domain_part,
                        "set_value",
                        {"entity_id": limit_entity, "value": final_value},
                        blocking=True
                    )
                
                self._last_limit = new_limit
                
        except Exception as err:
            _LOGGER.error(f"Error in Zero Export adjustment: {err}")
        finally:
            self._is_updating = False
