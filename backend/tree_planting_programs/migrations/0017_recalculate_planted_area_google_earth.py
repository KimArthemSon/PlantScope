"""
Recalculate each progress report's planted area with the Google Earth formula
(geodesic area on a sphere, R = 6,378,137 m). Reports submitted before the
switch were saved with a flat approximation.
"""
import importlib

from django.db import migrations

# Same frozen formula as the sites migration
_area = importlib.import_module('sites.migrations.0015_recalculate_area_google_earth')


def recalculate(apps, schema_editor):
    ProgressReport = apps.get_model('tree_planting_programs', 'ProgressReport')
    qs = ProgressReport.objects.exclude(polygon_coordinates__isnull=True).only(
        'progress_report_id', 'polygon_coordinates', 'planted_area_hectares'
    )
    for report in qs:
        ha = _area.latlng_list_hectares(report.polygon_coordinates)
        if ha is not None and ha != report.planted_area_hectares:
            ProgressReport.objects.filter(pk=report.pk).update(planted_area_hectares=ha)


class Migration(migrations.Migration):

    dependencies = [
        ('sites', '0015_recalculate_area_google_earth'),
        ('tree_planting_programs', '0016_program_closure_request'),
    ]

    operations = [
        # Old values can't be restored, so reversing just leaves the new ones
        migrations.RunPython(recalculate, migrations.RunPython.noop),
    ]
