"""The OpenKairo Solar integration."""
from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from hoymiles_wifi.dtu import DTU

from .const import DOMAIN, CONF_IP_ADDRESS
from .coordinator import HoymilesDataUpdateCoordinator

PLATFORMS: list[Platform] = [Platform.SENSOR]

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up OpenKairo Solar from a config entry."""
    ip_address = entry.data[CONF_IP_ADDRESS]
    
    _LOGGER.debug(f"Connecting to OpenKairo Solar Inverter at {ip_address}")
    
    dtu = DTU(ip_address)
    coordinator = HoymilesDataUpdateCoordinator(hass, dtu)
    
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    if unload_ok := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        hass.data[DOMAIN].pop(entry.entry_id)

    return unload_ok
