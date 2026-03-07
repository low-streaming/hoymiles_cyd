"""Platform for sensor integration."""
from __future__ import annotations

import logging
from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    UnitOfPower,
    UnitOfEnergy,
    UnitOfElectricPotential,
    UnitOfElectricCurrent,
    UnitOfFrequency,
    UnitOfTemperature,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import HoymilesDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the sensor platform."""
    coordinator = hass.data[DOMAIN][entry.entry_id]

    # Data from coordinator is the parsed protobuf response.
    # We will create global sensors (Total Power, Daily Energy) and port-specific sensors.
    
    entities = []

    # Global DTU / General sensors
    entities.append(OpenKairoSensor(coordinator, "Total Power", "total_power", SensorDeviceClass.POWER, UnitOfPower.WATT, SensorStateClass.MEASUREMENT))
    entities.append(OpenKairoSensor(coordinator, "Daily Energy", "daily_energy", SensorDeviceClass.ENERGY, UnitOfEnergy.WATT_HOUR, SensorStateClass.TOTAL_INCREASING))
    
    # Since we know `pv_data` and `sgs_data` arrays exist in actual RealDataNewResDTO:
    if coordinator.data and hasattr(coordinator.data, "pv_data"):
        for i, pv in enumerate(coordinator.data.pv_data):
            port = pv.port_number
            entities.append(OpenKairoPVSensor(coordinator, port, "Voltage", "voltage", SensorDeviceClass.VOLTAGE, UnitOfElectricPotential.VOLT, SensorStateClass.MEASUREMENT))
            entities.append(OpenKairoPVSensor(coordinator, port, "Current", "current", SensorDeviceClass.CURRENT, UnitOfElectricCurrent.AMPERE, SensorStateClass.MEASUREMENT))
            entities.append(OpenKairoPVSensor(coordinator, port, "Power", "power", SensorDeviceClass.POWER, UnitOfPower.WATT, SensorStateClass.MEASUREMENT))
            entities.append(OpenKairoPVSensor(coordinator, port, "Energy Today", "energy_daily", SensorDeviceClass.ENERGY, UnitOfEnergy.WATT_HOUR, SensorStateClass.TOTAL_INCREASING))
            entities.append(OpenKairoPVSensor(coordinator, port, "Energy Total", "energy_total", SensorDeviceClass.ENERGY, UnitOfEnergy.WATT_HOUR, SensorStateClass.TOTAL_INCREASING))

    if coordinator.data and hasattr(coordinator.data, "sgs_data"):
         for i, sgs in enumerate(coordinator.data.sgs_data):
            entities.append(OpenKairoSGSSensor(coordinator, i, "AC Voltage", "voltage", SensorDeviceClass.VOLTAGE, UnitOfElectricPotential.VOLT, SensorStateClass.MEASUREMENT))
            entities.append(OpenKairoSGSSensor(coordinator, i, "AC Frequency", "frequency", SensorDeviceClass.FREQUENCY, UnitOfFrequency.HERTZ, SensorStateClass.MEASUREMENT))
            entities.append(OpenKairoSGSSensor(coordinator, i, "AC Temperature", "temperature", SensorDeviceClass.TEMPERATURE, UnitOfTemperature.CELSIUS, SensorStateClass.MEASUREMENT))
            entities.append(OpenKairoSGSSensor(coordinator, i, "AC Active Power", "active_power", SensorDeviceClass.POWER, UnitOfPower.WATT, SensorStateClass.MEASUREMENT))


    async_add_entities(entities)


class OpenKairoSensorBase(CoordinatorEntity):
    """Base class for an OpenKairo Hoymiles sensor."""

    def __init__(self, coordinator, name, key, dev_class, unit, state_class) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._name_prefix = name
        self._key = key
        
        self._attr_device_class = dev_class
        self._attr_native_unit_of_measurement = unit
        self._attr_state_class = state_class

    @property
    def device_info(self):
        """Return device info."""
        # Using the DTU serial as the identifier
        serial = getattr(self.coordinator.data, "device_serial_number", "unknown")
        fw_version = getattr(self.coordinator.data, "firmware_version", "N/A")
        
        return {
            "identifiers": {(DOMAIN, serial)},
            "name": f"OpenKairo Solar Inverter {serial}",
            "manufacturer": "OpenKairo",
            "model": "Solar Inverter Integration",
            "sw_version": str(fw_version),
        }

class OpenKairoSensor(OpenKairoSensorBase):
    """A general OpenKairo sensor."""
    
    @property
    def name(self):
        return f"OpenKairo {self._name_prefix}"

    @property
    def unique_id(self):
        serial = getattr(self.coordinator.data, "device_serial_number", "unknown")
        return f"{serial}_{self._key}"

    @property
    def native_value(self):
        """Return the state of the sensor."""
        data = self.coordinator.data
        if not data:
            return None
        
        # Calculate custom fields
        if self._key == "total_power":
            total = 0
            if hasattr(data, "dtu_power") and data.dtu_power:
                return data.dtu_power / 10.0
            if hasattr(data, "sgs_data"):
                for sgs in data.sgs_data:
                    total += sgs.active_power
            return total / 10.0
            
        elif self._key == "daily_energy":
            if hasattr(data, "dtu_daily_energy") and data.dtu_daily_energy:
                return data.dtu_daily_energy
            daily = 0
            if hasattr(data, "pv_data"):
                for pv in data.pv_data:
                    daily += pv.energy_daily
            return daily
            
        return None

class OpenKairoPVSensor(OpenKairoSensorBase):
    """A port-specific PV sensor."""
    def __init__(self, coordinator, port, name, key, dev_class, unit, state_class):
        super().__init__(coordinator, name, key, dev_class, unit, state_class)
        self._port = port

    @property
    def name(self):
        return f"OpenKairo PV {self._port} {self._name_prefix}"

    @property
    def unique_id(self):
        serial = getattr(self.coordinator.data, "device_serial_number", "unknown")
        return f"{serial}_pv_{self._port}_{self._key}"

    @property
    def native_value(self):
        data = self.coordinator.data
        if not data or not hasattr(data, "pv_data"):
            return None
            
        for pv in data.pv_data:
            if pv.port_number == self._port:
                val = getattr(pv, self._key, None)
                if val is None:
                    return None
                    
                # Scaling per Hoymiles standard
                if self._key == "voltage":
                    return val / 10.0
                elif self._key == "current":
                    return val / 100.0
                elif self._key == "power":
                    return val / 10.0
                else:
                    return val # Energy in Wh
        return None

class OpenKairoSGSSensor(OpenKairoSensorBase):
    """An SGS (AC side) specific sensor."""
    def __init__(self, coordinator, index, name, key, dev_class, unit, state_class):
        super().__init__(coordinator, name, key, dev_class, unit, state_class)
        self._index = index

    @property
    def name(self):
        return f"OpenKairo AC {self._index} {self._name_prefix}"

    @property
    def unique_id(self):
        serial = getattr(self.coordinator.data, "device_serial_number", "unknown")
        return f"{serial}_sgs_{self._index}_{self._key}"

    @property
    def native_value(self):
        data = self.coordinator.data
        if not data or not hasattr(data, "sgs_data"):
            return None
            
        if self._index < len(data.sgs_data):
            sgs = data.sgs_data[self._index]
            val = getattr(sgs, self._key, None)
            if val is None:
                return None
                
            if self._key == "voltage":
                return val / 10.0
            elif self._key == "frequency":
                return val / 100.0
            elif self._key == "temperature":
                return val / 10.0
            elif self._key == "active_power":
                return val / 10.0
        return None
