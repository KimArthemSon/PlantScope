from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tree_species', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='tree_species',
            name='is_archived',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='tree_species',
            name='archived_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
