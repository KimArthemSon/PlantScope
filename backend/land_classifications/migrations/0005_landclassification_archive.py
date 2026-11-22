from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('land_classifications', '0004_alter_classified_areas_land_classification'),
    ]

    operations = [
        migrations.AddField(
            model_name='landclassification',
            name='is_archived',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='landclassification',
            name='archived_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
