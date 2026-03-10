"""Config flow for Hoymiles."""

from datetime import timedelta
import logging
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.const import CONF_HOST
from homeassistant.data_entry_flow import FlowResult
from homeassistant.core import callback

from .const import (
    CONF_DTU_SERIAL_NUMBER,
    CONF_HYBRID_INVERTERS,
    CONF_INVERTERS,
    CONF_METERS,
    CONF_PORTS,
    CONF_THREE_PHASE_INVERTERS,
    CONF_TIMEOUT,
    CONF_UPDATE_INTERVAL,
    CONF_IS_ENCRYPTED,
    CONF_ENC_RAND,
    CONFIG_VERSION,
    DEFAULT_TIMEOUT_SECONDS,
    DEFAULT_UPDATE_INTERVAL_SECONDS,
    DOMAIN,
    MIN_UPDATE_INTERVAL_SECONDS,
    MIN_TIMEOUT_SECONDS,
    CONF_ZERO_EXPORT_ENABLED,
    CONF_GRID_SENSOR,
    CONF_ZERO_EXPORT_TARGET,
    CONF_ZERO_EXPORT_MIN_LIMIT,
    CONF_ZERO_EXPORT_MAX_LIMIT,
    CONF_MAX_CAPACITY,
    CONF_USE_GENERIC,
)
from .error import CannotConnect
from .util import async_get_config_entry_data_for_host

_LOGGER = logging.getLogger(__name__)

DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_HOST): str,
        vol.Optional(
            CONF_UPDATE_INTERVAL,
            default=timedelta(seconds=DEFAULT_UPDATE_INTERVAL_SECONDS).seconds,
        ): vol.All(
            vol.Coerce(int),
            vol.Range(min=timedelta(seconds=MIN_UPDATE_INTERVAL_SECONDS).seconds),
        ),
        vol.Optional(
            CONF_TIMEOUT,
            default=timedelta(seconds=DEFAULT_TIMEOUT_SECONDS).seconds,
        ): vol.All(
            vol.Coerce(int),
            vol.Range(min=timedelta(seconds=MIN_TIMEOUT_SECONDS).seconds),
        ),
        vol.Optional(CONF_USE_GENERIC, default=False): bool,
    }
)


class HoymilesInverterConfigFlowHandler(ConfigFlow, domain=DOMAIN):
    """Hoymiles Inverter config flow."""

    VERSION = CONFIG_VERSION

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> "HoymilesInverterOptionsFlowHandler":
        """Get the options flow for this handler."""
        return HoymilesInverterOptionsFlowHandler(config_entry)

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle a flow initiated by the user."""
        errors = {}

        if user_input is not None:
            host = user_input[CONF_HOST]
            update_interval = user_input.get(
                CONF_UPDATE_INTERVAL, DEFAULT_UPDATE_INTERVAL_SECONDS
            )
            timeout = user_input.get(CONF_TIMEOUT, DEFAULT_TIMEOUT_SECONDS)
            use_generic = user_input.get(CONF_USE_GENERIC, False)

            if use_generic:
                return self.async_create_entry(
                    title=f"{host} (Generic)",
                    data={
                        CONF_HOST: host,
                        CONF_UPDATE_INTERVAL: update_interval,
                        CONF_DTU_SERIAL_NUMBER: f"generic_{host}",
                        CONF_INVERTERS: [],
                        CONF_THREE_PHASE_INVERTERS: [],
                        CONF_PORTS: [],
                        CONF_METERS: [],
                        CONF_HYBRID_INVERTERS: [],
                        CONF_IS_ENCRYPTED: False,
                        CONF_ENC_RAND: "",
                        CONF_TIMEOUT: timeout,
                        CONF_USE_GENERIC: True,
                    },
                )

            try:
                (
                    dtu_sn,
                    single_phase_inverters,
                    three_phase_inverters,
                    ports,
                    meters,
                    hybrid_inverters,
                    is_encrypted,
                    enc_rand,
                ) = await async_get_config_entry_data_for_host(host)
            except CannotConnect:
                errors["base"] = "cannot_connect"
            else:
                await self.async_set_unique_id(dtu_sn)
                self._abort_if_unique_id_configured()

                return self.async_create_entry(
                    title=host,
                    data={
                        CONF_HOST: host,
                        CONF_UPDATE_INTERVAL: update_interval,
                        CONF_DTU_SERIAL_NUMBER: dtu_sn,
                        CONF_INVERTERS: single_phase_inverters,
                        CONF_THREE_PHASE_INVERTERS: three_phase_inverters,
                        CONF_PORTS: ports,
                        CONF_METERS: meters,
                        CONF_HYBRID_INVERTERS: hybrid_inverters,
                        CONF_IS_ENCRYPTED: is_encrypted,
                        CONF_ENC_RAND: enc_rand,
                        CONF_TIMEOUT: timeout,
                        CONF_USE_GENERIC: False,
                    },
                )

        return self.async_show_form(
            step_id="user", data_schema=DATA_SCHEMA, errors=errors
        )

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle a reconfiguration flow initialized by the user."""

        entry = self.hass.config_entries.async_get_entry(self.context["entry_id"])
        assert entry is not None

        errors = {}

        if user_input is not None:
            host = user_input[CONF_HOST]
            update_interval = user_input.get(
                CONF_UPDATE_INTERVAL, DEFAULT_UPDATE_INTERVAL_SECONDS
            )

            timeout = user_input.get(CONF_TIMEOUT, DEFAULT_TIMEOUT_SECONDS)
            use_generic = user_input.get(CONF_USE_GENERIC, False)

            if use_generic:
                data = {
                    CONF_HOST: host,
                    CONF_UPDATE_INTERVAL: update_interval,
                    CONF_DTU_SERIAL_NUMBER: entry.unique_id, # Keep it
                    CONF_INVERTERS: [],
                    CONF_THREE_PHASE_INVERTERS: [],
                    CONF_PORTS: [],
                    CONF_METERS: [],
                    CONF_HYBRID_INVERTERS: [],
                    CONF_IS_ENCRYPTED: False,
                    CONF_ENC_RAND: "",
                    CONF_TIMEOUT: timeout,
                    CONF_USE_GENERIC: True,
                }
                self.hass.config_entries.async_update_entry(
                    entry, data=data, version=CONFIG_VERSION
                )
                await self.hass.config_entries.async_reload(entry.entry_id)
                return self.async_abort(reason="reconfigure_successful")

            try:
                (
                    dtu_sn,
                    single_phase_inverters,
                    three_phase_inverters,
                    ports,
                    meters,
                    hybrid_inverters,
                    is_encrypted,
                    enc_rand,
                ) = await async_get_config_entry_data_for_host(host)
            except CannotConnect:
                errors["base"] = "cannot_connect"

            else:
                if dtu_sn != entry.unique_id:
                    return self.async_abort(reason="another_device")

                data = {
                    CONF_HOST: host,
                    CONF_UPDATE_INTERVAL: update_interval,
                    CONF_DTU_SERIAL_NUMBER: dtu_sn,
                    CONF_INVERTERS: single_phase_inverters,
                    CONF_THREE_PHASE_INVERTERS: three_phase_inverters,
                    CONF_PORTS: ports,
                    CONF_METERS: meters,
                    CONF_HYBRID_INVERTERS: hybrid_inverters,
                    CONF_IS_ENCRYPTED: is_encrypted,
                    CONF_ENC_RAND: enc_rand,
                    CONF_TIMEOUT: timeout,
                    CONF_USE_GENERIC: False,
                }

                self.hass.config_entries.async_update_entry(
                    entry, data=data, version=CONFIG_VERSION
                )
                result = await self.hass.config_entries.async_reload(entry.entry_id)
                if not result:
                    errors["base"] = "unknown"
                else:
                    return self.async_abort(reason="reconfigure_successful")

        return self.async_show_form(
            step_id="reconfigure",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_HOST, default=entry.data[CONF_HOST]): str,
                    vol.Optional(
                        CONF_UPDATE_INTERVAL,
                        default=entry.data[CONF_UPDATE_INTERVAL],
                    ): vol.All(
                        vol.Coerce(int),
                        vol.Range(
                            min=timedelta(seconds=MIN_UPDATE_INTERVAL_SECONDS).seconds
                        ),
                    ),
                    vol.Optional(
                        CONF_TIMEOUT,
                        default=entry.data.get(CONF_TIMEOUT, DEFAULT_TIMEOUT_SECONDS),
                    ): vol.All(
                        vol.Coerce(int),
                        vol.Range(min=timedelta(seconds=MIN_TIMEOUT_SECONDS).seconds),
                    ),
                    vol.Optional(
                        CONF_USE_GENERIC,
                        default=entry.data.get(CONF_USE_GENERIC, False),
                    ): bool,
                }
            ),
            errors=errors,
        )


class HoymilesInverterOptionsFlowHandler(OptionsFlow):
    """Handle options."""

    def __init__(self, config_entry: ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_ZERO_EXPORT_ENABLED,
                        default=self.config_entry.options.get(CONF_ZERO_EXPORT_ENABLED, False),
                    ): bool,
                    vol.Optional(
                        CONF_GRID_SENSOR,
                        default=self.config_entry.options.get(CONF_GRID_SENSOR, ""),
                    ): str,
                    vol.Optional(
                        CONF_ZERO_EXPORT_TARGET,
                        default=self.config_entry.options.get(CONF_ZERO_EXPORT_TARGET, 0),
                    ): int,
                    vol.Optional(
                        CONF_MAX_CAPACITY,
                        default=self.config_entry.options.get(CONF_MAX_CAPACITY, 800),
                    ): int,
                    vol.Optional(
                        CONF_ZERO_EXPORT_MIN_LIMIT,
                        default=self.config_entry.options.get(CONF_ZERO_EXPORT_MIN_LIMIT, 10),
                    ): int,
                    vol.Optional(
                        CONF_ZERO_EXPORT_MAX_LIMIT,
                        default=self.config_entry.options.get(CONF_ZERO_EXPORT_MAX_LIMIT, 100),
                    ): int,
                }
            ),
        )
