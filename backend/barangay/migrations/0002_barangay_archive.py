from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('barangay', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='barangay',
            name='is_archived',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='barangay',
            name='archived_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
