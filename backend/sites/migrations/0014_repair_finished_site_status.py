from django.db import migrations


def repair_site_status(apps, schema_editor):
    """
    Finishing a program used to overwrite the GIS approval field (status) with
    'completed'/'failed'. Those aren't valid status choices and they hide the
    site from official lists and from tree growers even after it is re-opened.
    The program outcome lives in monitoring_status, so restore status='accepted'.
    """
    Sites = apps.get_model('sites', 'Sites')
    Sites.objects.filter(status__in=['completed', 'failed', 'under_monitoring']).update(status='accepted')


class Migration(migrations.Migration):

    dependencies = [
        ('sites', '0013_recalculate_site_area_hectares'),
    ]

    operations = [
        migrations.RunPython(repair_site_status, migrations.RunPython.noop),
    ]
