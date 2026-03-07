"""Constants for the OpenKairo Solar integration."""
from datetime import timedelta

DOMAIN = "hoymiles_cyd"
CONF_IP_ADDRESS = "ip_address"
CONF_UPDATE_INTERVAL = "update_interval"
DEFAULT_UPDATE_INTERVAL_SECONDS = 5

UPDATE_INTERVAL = timedelta(seconds=DEFAULT_UPDATE_INTERVAL_SECONDS)
