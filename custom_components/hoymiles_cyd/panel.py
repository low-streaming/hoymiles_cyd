import logging
import os
from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .const import DOMAIN

PANEL_TITLE = "Nulleinspeisung Steuerung"
PANEL_ICON = "mdi:solar-power-variant"

async def async_setup_panel(hass: HomeAssistant):
    """Register the custom panel."""
    
    # Register the View to serve the JS file
    hass.http.register_view(HoymilesCYDPanelView())

    hass.components.frontend.async_register_built_in_panel(
        component_name="custom",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path="hoymiles-cyd-control",
        config={
            "_panel_custom": {
                "name": "hoymiles-cyd-panel",
                "module_url": "/api/hoymiles_cyd/panel.js"
            }
        },
        require_admin=False,
    )

class HoymilesCYDPanelView(HomeAssistantView):
    """View to serve the Hoymiles CYD panel JS file."""
    url = "/api/hoymiles_cyd/panel.js"
    name = "api:hoymiles_cyd:panel"
    requires_auth = False

    async def get(self, request):
        """Serve the JS file."""
        path = os.path.join(os.path.dirname(__file__), "hoymiles-cyd-panel.js")
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            return web.Response(body=content, content_type="application/javascript")
        except Exception:
            return web.Response(status=404)

    _LOGGING = "Hoymiles CYD: Panel registered at /hoymiles_cyd_panel"
