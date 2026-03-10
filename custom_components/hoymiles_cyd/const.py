"""Constants for the Hoymiles integration."""

DOMAIN = "hoymiles_cyd"
NAME = "Hoymiles CYD Nulleinspeisung"
DOMAIN = "hoymiles_cyd"
DOMAIN_DATA = f"{DOMAIN}_data"
CONFIG_VERSION = 5

ISSUE_URL = "https://github.com/low-streaming/hoymiles_cyd/issues"

CONF_UPDATE_INTERVAL = "update_interval"
CONF_DTU_SERIAL_NUMBER = "dtu_serial_number"
CONF_INVERTERS = "inverters"
CONF_THREE_PHASE_INVERTERS = "three_phase_inverters"
CONF_HYBRID_INVERTERS = "hybrid_inverters"
CONF_PORTS = "ports"
CONF_METERS = "meters"
CONF_IS_ENCRYPTED = "is_encrypted"
CONF_ENC_RAND = "enc_rand"
CONF_TIMEOUT = "timeout"
CONF_ZERO_EXPORT_ENABLED = "zero_export_enabled"
CONF_GRID_SENSOR = "grid_sensor"
CONF_ZERO_EXPORT_TARGET = "zero_export_target"
CONF_ZERO_EXPORT_MIN_LIMIT = "zero_export_min_limit"
CONF_ZERO_EXPORT_MAX_LIMIT = "zero_export_max_limit"
CONF_MAX_CAPACITY = "max_capacity"
CONF_USE_GENERIC = "use_generic"

DEFAULT_UPDATE_INTERVAL_SECONDS = 35
MIN_UPDATE_INTERVAL_SECONDS = 1
DEFAULT_TIMEOUT_SECONDS = 10
MIN_TIMEOUT_SECONDS = 1

DEFAULT_CONFIG_UPDATE_INTERVAL_SECONDS = 60 * 5
DEFAULT_APP_INFO_UPDATE_INTERVAL_SECONDS = 60 * 60 * 2


HASS_DATA_COORDINATOR = "data_coordinator"
HASS_CONFIG_COORDINATOR = "config_coordinator"
HASS_APP_INFO_COORDINATOR = "app_info_coordinator"
HASS_ENERGY_STORAGE_DATA_COORDINATOR = "energy_stroage_data_coordinator"
HASS_DTU = "dtu"
HASS_DATA_UNSUB_OPTIONS_UPDATE_LISTENER = "unsub_options_update_listener"
HASS_ZERO_EXPORT_MANAGER = "zero_export_manager"


FCTN_GENERATE_DTU_VERSION_STRING = "generate_dtu_version_string"
FCTN_GENERATE_INVERTER_HW_VERSION_STRING = "generate_version_string"
FCTN_GENERATE_INVERTER_SW_VERSION_STRING = "generate_sw_version_string"

STARTUP_MESSAGE = f"""

-------------------------------------------------------------------
{NAME}
This is a custom integration!
If you have any issues with it please open an issue here:
{ISSUE_URL}
-------------------------------------------------------------------
"""
