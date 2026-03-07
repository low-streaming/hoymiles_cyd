"""Zero Export (Nulleinspeisung) controller for Hoymiles CYD."""
import logging
import asyncio
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
        self._target_watt = 0
        self._min_limit = 10
        self._max_limit = 100
        self._max_capacity = 800 # Default fallback
        self._unsub = None
        self._last_limit = None
        self._is_updating = False

    @property
    def status(self) -> str:
        """Return current status."""
        if not self._enabled:
            return "Disabled"
        if not self._grid_sensor:
            return "Misconfigured"
        return "Running"

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
    def target_power(self) -> int:
        """Return target power."""
        return self._target_watt

    @target_power.setter
    def target_power(self, value: int):
        """Set target power."""
        self._target_watt = value

    async def async_setup(self):
        """Set up the zero export logic."""
        options = self.entry.options
        self._enabled = options.get(CONF_ZERO_EXPORT_ENABLED, False)
        self._grid_sensor = options.get(CONF_GRID_SENSOR)
        self._target_watt = options.get(CONF_ZERO_EXPORT_TARGET, 0)
        self._min_limit = options.get(CONF_ZERO_EXPORT_MIN_LIMIT, 10)
        self._max_limit = options.get(CONF_ZERO_EXPORT_MAX_LIMIT, 100)
        
        # Estimate max capacity from inverter list if possible
        # For now, let's assume we might need a CONF_MAX_CAPACITY
        self._max_capacity = options.get("max_capacity", 800)

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

    @callback
    async def _handle_grid_change(self, event):
        """Handle grid sensor state change."""
        if self._is_updating:
            return

        new_state = event.data.get("new_state")
        if not new_state or new_state.state in ("unavailable", "unknown"):
            return

        try:
            grid_power = float(new_state.state)
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
            
            if not dtu or not coordinator:
                return

            # Get current production (W)
            current_production = 0
            # Try to get it from the coordinator's data directly
            if coordinator.data:
                # Assuming the coordinator data has a total_ac_power attribute or similar
                # If it's a list or dict, we need to adapt
                if hasattr(coordinator.data, 'total_ac_power'):
                   current_production = coordinator.data.total_ac_power
                elif isinstance(coordinator.data, dict):
                   current_production = coordinator.data.get('total_ac_power', 0)
            
            # If still 0, try to find the actual sensor state
            if current_production == 0:
                states = self.hass.states.get(f"sensor.solar_inverter_ac_power") # Neutral name check
                if not states:
                     states = self.hass.states.get(f"sensor.hoymiles_cyd_ac_power")
                if states and states.state not in ("unavailable", "unknown"):
                    current_production = float(states.state)

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
                _LOGGER.info(f"Zero Export: Adjusting limit to {new_limit}% (Grid: {grid_power}W, Prod: {current_production}W, Target: {self._target_watt}W)")
                await dtu.async_set_power_limit(new_limit)
                self._last_limit = new_limit
                
        except Exception as err:
            _LOGGER.error(f"Error in Zero Export adjustment: {err}")
        finally:
            self._is_updating = False
