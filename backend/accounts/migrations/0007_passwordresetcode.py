from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_alter_notification_title'),
    ]

    operations = [
        migrations.CreateModel(
            name='PasswordResetCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code_hash', models.CharField(max_length=64)),
                ('reset_token_hash', models.CharField(blank=True, default='', max_length=64)),
                ('failed_attempts', models.PositiveSmallIntegerField(default=0)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='password_reset_codes', to='accounts.user')),
            ],
            options={
                'verbose_name': 'Password Reset Code',
                'verbose_name_plural': 'Password Reset Codes',
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['user', 'created_at'], name='accounts_pa_user_id_8b0b73_idx')],
            },
        ),
    ]
