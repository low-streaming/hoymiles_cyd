"""Custom panel for Hoymiles CYD."""
from homeassistant.components import frontend
from homeassistant.core import HomeAssistant

from .const import DOMAIN

PANEL_TITLE = "Hoymiles CYD Control"
PANEL_ICON = "mdi:solar-power-variant"

async def async_setup_panel(hass: HomeAssistant):
    """Register the custom panel."""
    # This registers a side-panel that currently points to a basic view.
    # In a full implementation, this would serve a custom LitElement.
    # For now, we point it to a pre-configured dashboard path.
    
    frontend.async_register_built_in_panel(
        hass,
        component_name="external_main",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path="hoymiles-cyd-panel",
        config={"url": "/lovelace-hoymiles-cyd"}, # Custom dashboard path
        require_admin=False,
    )

    _LOGGING = "Hoymiles CYD: Panel registered at /hoymiles_cyd_panel"
