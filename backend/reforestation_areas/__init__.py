# reforestation_areas/__init__.py
from . import gee_helpers

try:
    gee_helpers.initialize_earth_engine()
except RuntimeError as e:
    import logging
    logger = logging.getLogger(__name__)
    logger.warning(f"⚠️ GEE not initialized: {e}")