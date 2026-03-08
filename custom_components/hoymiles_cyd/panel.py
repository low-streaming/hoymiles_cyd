import logging
import os
import json
import asyncio
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
    hass.http.register_view(HoymilesCYDSyncView())

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

class HoymilesCYDSyncView(HomeAssistantView):
    """View to provide a unified state object for the CYD hardware display."""
    url = "/api/hoymiles_cyd/sync"
    name = "api:hoymiles_cyd:sync"
    requires_auth = False # Set to True if Token is used in display

    async def get(self, request):
        """Return the current states in one JSON."""
        hass = request.app["hass"]
        config_path = hass.config.path("hoymiles_cyd_config.json")
        config = {}
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)

        def get_val(entity_id):
            if not entity_id: return 0.0
            state = hass.states.get(entity_id)
            if state and state.state not in ("unavailable", "unknown"):
                try:
                    return round(float(state.state), 2)
                except ValueError:
                    return state.state
            return 0.0

        # Gather data
        solar_p = get_val(config.get("solar_power_sensor"))
        solar_y = get_val(config.get("solar_energy_yield_sensor"))
        grid_p = get_val(config.get("grid_sensor"))
        grid_import = get_val(config.get("grid_energy_import_sensor"))
        grid_export = get_val(config.get("grid_energy_export_sensor"))
        bat_p = get_val(config.get("battery_power_sensor"))
        bat_soc = get_val(config.get("battery_soc_sensor"))

        # Zero Export Status
        ze_status = "Deaktiviert"
        from .const import HASS_ZERO_EXPORT_MANAGER
        if DOMAIN in hass.data and HASS_ZERO_EXPORT_MANAGER in hass.data[DOMAIN]:
            manager = hass.data[DOMAIN][HASS_ZERO_EXPORT_MANAGER]
            ze_status = getattr(manager, "status", "Unbekannt")

        data = {
            "solar": {"p": solar_p, "y": solar_y},
            "grid": {"p": grid_p, "imp": grid_import, "exp": grid_export},
            "bat": {"p": bat_p, "soc": bat_soc},
            "status": ze_status,
            "ts": int(asyncio.get_event_loop().time())
        }

        return web.json_response(data)
