# Generated by Django 3.2.19 on 2023-11-30 22:59

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("posthog", "0367_job_inputs"),
    ]

    operations = [
        migrations.AddField(
            model_name="externaldatasource",
            name="prefix",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
