from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('land_classifications', '0005_landclassification_archive'),
    ]

    operations = [
        migrations.AddField(
            model_name='classified_areas',
            name='is_archived',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='classified_areas',
            name='archived_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
