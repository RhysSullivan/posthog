# Generated by Django 3.0.6 on 2020-08-18 12:10

from django.conf import settings
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("posthog", "0082_personalapikey"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("ee", "0001_initial"),
    ]

    operations = []
