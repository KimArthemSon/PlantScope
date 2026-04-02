from django.core.management.base import BaseCommand
from mcda_weight_config.models import McdaWeightsConfig

class Command(BaseCommand):
    help = 'Initialize default MCDA scoring rules for all 8 layers (No Admin required)'

    def handle(self, *args, **kwargs):
        self.stdout.write('🌱 Initializing MCDA Configurations...')

        configs = [
            {
                'layer_name': 'safety',
                'weight': 15.00,
                'rules': {
                    "input_field": "risk_level",
                    "rules": [
                        {"status_input": "Low", "normalized_score": 90, "verdict": "PASS", "is_veto": False},
                        {"status_input": "Medium", "normalized_score": 60, "verdict": "PASS_WITH_MITIGATION", "is_veto": False},
                        {"status_input": "High", "normalized_score": 20, "verdict": "FAIL", "is_veto": False},
                        {"status_input": "Critical", "normalized_score": 0, "verdict": "AUTO_REJECT", "is_veto": True}
                    ]
                }
            },
            {
                'layer_name': 'legality',
                'weight': 20.00,
                'rules': {
                    "input_field": "compliance_status",
                    "rules": [
                        {"status_input": "Compliant", "normalized_score": 100, "verdict": "PASS", "is_veto": False},
                        {"status_input": "Pending", "normalized_score": 50, "verdict": "HOLD", "is_veto": False},
                        {"status_input": "Disputed", "normalized_score": 0, "verdict": "AUTO_REJECT", "is_veto": True},
                        {"status_input": "Illegal", "normalized_score": 0, "verdict": "AUTO_REJECT", "is_veto": True}
                    ]
                }
            },
            {
                'layer_name': 'slope',
                'weight': 10.00,
                'rules': {
                    "input_field": "slope_category",
                    "rules": [
                        {"status_input": "Flat/Gentle (0-15°)", "normalized_score": 100, "verdict": "HIGHLY_SUITABLE", "is_veto": False},
                        {"status_input": "Moderate (16-30°)", "normalized_score": 80, "verdict": "PASS", "is_veto": False},
                        {"status_input": "Steep (31-45°)", "normalized_score": 40, "verdict": "WARNING", "is_veto": False},
                        {"status_input": "Very Steep (>45°)", "normalized_score": 10, "verdict": "FAIL", "is_veto": False}
                    ]
                }
            },
            {
                'layer_name': 'soil_quality',
                'weight': 15.00,
                'rules': {
                    "input_field": "fertility_status",
                    "rules": [
                        {"status_input": "High", "normalized_score": 95, "verdict": "HIGHLY_SUITABLE", "is_veto": False},
                        {"status_input": "Moderate", "normalized_score": 70, "verdict": "PASS", "is_veto": False},
                        {"status_input": "Low", "normalized_score": 30, "verdict": "WARNING", "is_veto": False},
                        {"status_input": "Poor", "normalized_score": 5, "verdict": "FAIL", "is_veto": False}
                    ]
                }
            },
            {
                'layer_name': 'accessibility',
                'weight': 10.00,
                'rules': {
                    "input_field": "access_category",
                    "rules": [
                        {"status_input": "Easy", "normalized_score": 100, "verdict": "HIGHLY_SUITABLE", "is_veto": False},
                        {"status_input": "Moderate", "normalized_score": 65, "verdict": "WARNING", "is_veto": False},
                        {"status_input": "Difficult", "normalized_score": 30, "verdict": "FAIL", "is_veto": False},
                        {"status_input": "Inaccessible", "normalized_score": 0, "verdict": "AUTO_REJECT", "is_veto": False}
                    ]
                }
            },
            {
                'layer_name': 'hydrology',
                'weight': 10.00,
                'rules': {
                    "input_field": "water_security",
                    "rules": [
                        {"status_input": "Near", "normalized_score": 90, "verdict": "HIGHLY_SUITABLE", "is_veto": False},
                        {"status_input": "Moderate", "normalized_score": 60, "verdict": "PASS", "is_veto": False},
                        {"status_input": "Far", "normalized_score": 20, "verdict": "WARNING", "is_veto": False},
                        {"status_input": "None", "normalized_score": 0, "verdict": "FAIL", "is_veto": False}
                    ]
                }
            },
            {
                'layer_name': 'wildlife_status',
                'weight': 10.00,
                'rules': {
                    "input_field": "ecological_status",
                    "rules": [
                        {"status_input": "Healthy", "normalized_score": 85, "verdict": "PASS", "is_veto": False},
                        {"status_input": "Degraded", "normalized_score": 50, "verdict": "WARNING", "is_veto": False},
                        {"status_input": "Critical Habitat", "normalized_score": 0, "verdict": "AUTO_REJECT", "is_veto": True},
                        {"status_input": "Infested", "normalized_score": 10, "verdict": "FAIL", "is_veto": False}
                    ]
                }
            },
            {
                'layer_name': 'tree_species_suitability',
                'weight': 10.00,
                'rules': {
                    "input_field": "match_quality",
                    "rules": [
                        {"status_input": "High Match", "normalized_score": 88, "verdict": "OPTIMIZED", "is_veto": False},
                        {"status_input": "Moderate Match", "normalized_score": 60, "verdict": "PASS", "is_veto": False},
                        {"status_input": "Low Match", "normalized_score": 20, "verdict": "WARNING", "is_veto": False},
                        {"status_input": "No Match", "normalized_score": 0, "verdict": "FAIL", "is_veto": False}
                    ]
                }
            },
        ]

        created_count = 0
        updated_count = 0

        for config in configs:
            obj, created = McdaWeightsConfig.objects.update_or_create(
                layer_name=config['layer_name'],
                defaults={
                    'weight_percentage': config['weight'],
                    'scoring_rules': config['rules'],
                    'is_active': True
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        # Calculate total weight for the summary message
        total_weight = sum(c["weight"] for c in configs)

        self.stdout.write(self.style.SUCCESS(f'✅ Successfully initialized MCDA configs!'))
        self.stdout.write(self.style.WARNING(f'   Created: {created_count} | Updated: {updated_count}'))
        
        # FIXED LINE: Removed .style.INFO (which doesn't exist) and used plain write
        self.stdout.write(f'   ℹ️  Total Weight Check: {total_weight}% (Should be 100%)')