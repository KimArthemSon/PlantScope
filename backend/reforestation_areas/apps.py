from django.apps import AppConfig

class ReforestationAreasConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'reforestation_areas'
    
    def ready(self):
        # Initialize GEE when Django starts
        try:
            from .gee_helpers import initialize_earth_engine
            initialize_earth_engine()
        except Exception as e:
            print(f"⚠️  GEE initialization failed: {e}")
            print("💡 GEE features will not work until initialized")