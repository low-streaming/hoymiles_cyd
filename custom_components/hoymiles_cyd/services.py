from homeassistant.core import ServiceCall
from hoymiles_wifi.dtu import DTU

from hoymiles_wifi.hoymiles import BMSWorkingMode

from .const import HASS_DTU, DOMAIN
from homeassistant.helpers.device_registry import async_get as async_get_device_registry


from hoymiles_wifi.utils import parse_time_periods_input, parse_time_settings_input

import logging
import os
import shutil
import zipfile
import io
import aiohttp
from .const import CONF_DTU_SERIAL_NUMBER, DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_handle_update_integration(call: ServiceCall):
    """Update the integration from GitHub."""
    hass = call.hass
    repo_url = "https://github.com/low-streaming/hoymiles_cyd/archive/refs/heads/main.zip"
    
    _LOGGER.info("Starting Hoymiles CYD integration update from %s", repo_url)
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(repo_url) as response:
                if response.status != 200:
                    _LOGGER.error("Failed to download update, status: %s", response.status)
                    return
                content = await response.read()

        # Unzip
        with zipfile.ZipFile(io.BytesIO(content)) as zip_ref:
            # We assume the zip has a top level folder like hoymiles_cyd-main
            # and inside it is custom_components/hoymiles_cyd
            
            extract_path = hass.config.path("hoymiles_cyd_update_temp")
            if os.path.exists(extract_path):
                shutil.rmtree(extract_path)
            os.makedirs(extract_path)
            
            zip_ref.extractall(extract_path)
            
            # Find the component folder
            top_dir = os.listdir(extract_path)[0]
            src_component_path = os.path.join(extract_path, top_dir, "custom_components", "hoymiles_cyd")
            dest_component_path = os.path.join(hass.config.config_dir, "custom_components", "hoymiles_cyd")
            
            if not os.path.exists(src_component_path):
                 _LOGGER.error("Could not find component folder in update ZIP")
                 return

            _LOGGER.info("Cleaning up and replacing files at %s", dest_component_path)
            # Replace files
            if os.path.exists(dest_component_path):
                # Don't delete the whole folder to avoid potential lock issues, just overwrite files
                # Wait, actually for custom_components, deleting and moving is usually cleaner
                shutil.rmtree(dest_component_path)
            
            shutil.copytree(src_component_path, dest_component_path)
            
            # Cleanup temp
            shutil.rmtree(extract_path)
            
            _LOGGER.info("Hoymiles CYD Update successful! Please restart Home Assistant.")
            
            # Fire event so frontend knows we are done
            hass.bus.async_fire("hoymiles_cyd_update_completed", {"status": "success"})

    except Exception as e:
        _LOGGER.error("Error during Hoymiles CYD update: %s", e)
        hass.bus.async_fire("hoymiles_cyd_update_completed", {"status": "error", "message": str(e)})


async def async_handle_set_bms_mode(call: ServiceCall):
    hass = call.hass
    device_registry = async_get_device_registry(hass)

    bms_mode_str = call.data.get("bms_mode")
    rev_soc = call.data.get("rev_soc")
    max_power = call.data.get("max_power")
    peak_soc = call.data.get("peak_soc", None)
    peak_meter_power = call.data.get("peak_meter_power", None)
    time_settings_str = call.data.get("time_settings", None)
    time_periods_str = call.data.get("time_periods", None)
    device_ids = call.data.get("device_id", [])

    time_settings = None
    time_periods = None

    bms_working_mode = BMSWorkingMode[bms_mode_str.upper()]

    _LOGGER.debug(f"Setting BMS mode to {bms_working_mode}")
    _LOGGER.debug(f"  rev_soc: {rev_soc}")
    _LOGGER.debug(f"  max_power: {max_power}")
    _LOGGER.debug(f"  peak_soc: {peak_soc}")
    _LOGGER.debug(f"  peak_meter_power: {peak_meter_power}")
    _LOGGER.debug(f"  time_settings_str: {time_settings_str}")
    _LOGGER.debug(f"  time_periods_str: {time_periods_str}")

    if rev_soc is None:
        raise ValueError("No reserve SOC provided!")

    if bms_working_mode == BMSWorkingMode.ECONOMIC:
        time_settings = parse_time_settings_input(time_settings_str)
        if not time_settings:
            raise ValueError("Invalid time settings!")

    elif bms_working_mode in (
        BMSWorkingMode.FORCED_CHARGING,
        BMSWorkingMode.FORCED_DISCHARGE,
    ):
        if max_power is None:
            raise ValueError("No max power provided!")

    elif bms_working_mode == BMSWorkingMode.PEAK_SHAVING:
        if peak_soc is None:
            raise ValueError("No peak SOC provided!")
        if peak_meter_power is None:
            raise ValueError("No peak meter power provided!")

    elif bms_working_mode == BMSWorkingMode.TIME_OF_USE:
        time_periods = parse_time_periods_input(time_periods_str)
        if not time_periods:
            raise ValueError("Invalid time periods!")

    for device_id in device_ids:
        device = device_registry.async_get(device_id)
        if not device:
            _LOGGER.error(f"Device {device_id} not found in registry")
            continue

        for entry_id in device.config_entries:
            hass_data = hass.data[DOMAIN].get(entry_id)
            if not hass_data:
                continue

            dtu = hass_data[HASS_DTU]
            if not dtu or not isinstance(dtu, DTU):
                _LOGGER.error(f"DTU not found for entry {entry_id}")
                continue

            _LOGGER.debug("Found DTU for entry %s -> %s", entry_id, dtu)

            dtu_serial_number_str = hass_data.get(CONF_DTU_SERIAL_NUMBER, None)

            if not dtu_serial_number_str:
                _LOGGER.error(f"DTU serial number not found in config entry {entry_id}")
                continue

            dtu_serial_number = int(dtu_serial_number_str)
            inverter_serial_number = int(device.serial_number)

            _LOGGER.debug(
                f"Setting BMS mode for inverter_serial_number: {inverter_serial_number}"
            )

            await dtu.async_set_energy_storage_working_mode(
                dtu_serial_number=dtu_serial_number,
                inverter_serial_number=inverter_serial_number,
                bms_working_mode=bms_working_mode,
                rev_soc=rev_soc,
                time_settings=time_settings,
                max_power=max_power,
                peak_soc=peak_soc,
                peak_meter_power=peak_meter_power,
                time_periods=time_periods,
            )
