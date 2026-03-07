"""Custom panel for Hoymiles CYD."""
from homeassistant.components import frontend
from homeassistant.core import HomeAssistant

from .const import DOMAIN

PANEL_TITLE = "Nulleinspeisung Steuerung"
PANEL_ICON = "mdi:solar-power-variant"

async def async_setup_panel(hass: HomeAssistant):
    """Register the custom panel."""
    
    # Register the JS file as a resource
    hass.http.register_static_path(
        "/hoymiles_cyd/panel.js",
        hass.config.path("custom_components/hoymiles_cyd/hoymiles-cyd-panel.js"),
        False
    )

    hass.components.frontend.async_register_built_in_panel(
        component_name="external_main",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path="hoymiles-cyd",
        config={
            "url": "/hoymiles_cyd/panel.js",
            "trust_external": True,
        },
        require_admin=False,
    )

    _LOGGING = "Hoymiles CYD: Panel registered at /hoymiles_cyd_panel"
