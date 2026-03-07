"""Coordinator for OpenKairo Solar."""
import logging
from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from hoymiles_wifi.dtu import DTU

from .const import DOMAIN, UPDATE_INTERVAL

_LOGGER = logging.getLogger(__name__)

class HoymilesDataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching OpenKairo Solar data."""

    def __init__(self, hass: HomeAssistant, dtu: DTU) -> None:
        """Initialize the coordinator."""
        self.dtu = dtu
        self.dtu_sn = None

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=UPDATE_INTERVAL,
        )

    async def _async_update_data(self):
        """Fetch data from API endpoint."""
        try:
            # We fetch both Data and Information if needed, but RealDataNew usually has everything.
            real_data = await self.dtu.async_get_real_data_new()
            
            if not real_data:
                raise UpdateFailed("No data received from inverter.")
            
            return real_data
            
        except Exception as err:
            raise UpdateFailed(f"Error communicating with inverter: {err}")
