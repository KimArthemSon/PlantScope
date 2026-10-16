from django.db import migrations


def recalculate_areas(apps, schema_editor):
    # Historical models don't carry custom methods, so borrow the current one.
    from sites.models import Sites as CurrentSites

    HistoricalSites = apps.get_model("sites", "Sites")
    for site in HistoricalSites.objects.exclude(polygon_coordinates__isnull=True).only(
        "site_id", "polygon_coordinates"
    ):
        area = CurrentSites(
            polygon_coordinates=site.polygon_coordinates
        ).calculate_area_from_polygon()
        HistoricalSites.objects.filter(site_id=site.site_id).update(
            total_area_hectares=area
        )


class Migration(migrations.Migration):

    dependencies = [
        ("sites", "0012_alter_sites_reforestation_area"),
    ]

    operations = [
        migrations.RunPython(recalculate_areas, migrations.RunPython.noop),
    ]
