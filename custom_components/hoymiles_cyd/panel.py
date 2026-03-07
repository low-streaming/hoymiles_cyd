import logging
import os
import json
from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .const import DOMAIN

PANEL_TITLE = "Nulleinspeisung Steuerung"
PANEL_ICON = "mdi:solar-power-variant"

from homeassistant.components.frontend import async_register_built_in_panel

async def async_setup_panel(hass: HomeAssistant):
    """Register the custom panel."""
    
    # Register the View to serve the JS file
    hass.http.register_view(HoymilesCYDPanelView())
    hass.http.register_view(HoymilesCYDConfigView())

    async_register_built_in_panel(
        hass,
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

class HoymilesCYDConfigView(HomeAssistantView):
    """View to handle Hoymiles CYD configuration."""
    url = "/api/hoymiles_cyd/config"
    name = "api:hoymiles_cyd:config"
    requires_auth = False # Should be True in production, but following user's pattern

    def _get_path(self, hass):
        return hass.config.path("hoymiles_cyd_config.json")

    async def get(self, request):
        """Get the configuration."""
        hass = request.app["hass"]
        path = self._get_path(hass)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return web.json_response(json.load(f))
        return web.json_response({})

    async def post(self, request):
        """Save the configuration."""
        hass = request.app["hass"]
        data = await request.json()
        path = self._get_path(hass)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
        
        # Notify ZeroExportManager if it exists
        from .const import HASS_ZERO_EXPORT_MANAGER
        if DOMAIN in hass.data and HASS_ZERO_EXPORT_MANAGER in hass.data[DOMAIN]:
            manager = hass.data[DOMAIN][HASS_ZERO_EXPORT_MANAGER]
            if hasattr(manager, "update_config"):
                manager.update_config(data)

        return web.json_response({"status": "ok"})
