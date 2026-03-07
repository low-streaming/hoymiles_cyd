"""Support for Hoymiles switches."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    DOMAIN,
    HASS_ZERO_EXPORT_MANAGER,
    CONF_ZERO_EXPORT_ENABLED,
)

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Hoymiles switch entities."""
    hass_data = hass.data[DOMAIN][config_entry.entry_id]
    zero_export_manager = hass_data.get(HASS_ZERO_EXPORT_MANAGER)

    if zero_export_manager:
        async_add_entities([HoymilesZeroExportSwitch(zero_export_manager, config_entry)])


class HoymilesZeroExportSwitch(SwitchEntity):
    """Switch to enable/disable Zero Export."""

    _attr_has_entity_name = True
    _attr_translation_key = "zero_export_enabled"
    _attr_icon = "mdi:solar-power"

    def __init__(self, manager, entry):
        """Initialize."""
        self._manager = manager
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_zero_export_enabled"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry.entry_id)},
            "name": "Zero Export Controller",
            "manufacturer": "Hoymiles CYD",
            "model": "Logic Module",
        }

    @property
    def is_on(self) -> bool:
        """Return true if Zero Export is enabled."""
        return self._manager.is_enabled

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Turn the entity on."""
        self._manager.is_enabled = True
        # Update entry options
        new_options = dict(self._entry.options)
        new_options[CONF_ZERO_EXPORT_ENABLED] = True
        self.hass.config_entries.async_update_entry(self._entry, options=new_options)
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Turn the entity off."""
        self._manager.is_enabled = False
        # Update entry options
        new_options = dict(self._entry.options)
        new_options[CONF_ZERO_EXPORT_ENABLED] = False
        self.hass.config_entries.async_update_entry(self._entry, options=new_options)
        self.async_write_ha_state()
