# Generated manually for cache optimization changes

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("results", "0001_initial"),
    ]

    operations = [
        # Add cache_status and cache_built_at to ResultSet
        migrations.AddField(
            model_name="resultset",
            name="cache_status",
            field=models.CharField(
                choices=[
                    ("none", "No Cache"),
                    ("building", "Building"),
                    ("ready", "Ready"),
                    ("stale", "Stale"),
                ],
                default="none",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="resultset",
            name="cache_built_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        # Add aggregate columns to GlobalResultsCache
        migrations.AddField(
            model_name="globalresultscache",
            name="avg_value",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="globalresultscache",
            name="max_value",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="globalresultscache",
            name="min_value",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="globalresultscache",
            name="load_case_count",
            field=models.IntegerField(default=0),
        ),
        # Add unique constraint to GlobalResultsCache
        migrations.AddConstraint(
            model_name="globalresultscache",
            constraint=models.UniqueConstraint(
                fields=["project", "result_set", "result_type", "story"],
                name="unique_global_cache_row",
            ),
        ),
        # Add aggregate columns to ElementResultsCache
        migrations.AddField(
            model_name="elementresultscache",
            name="avg_value",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="elementresultscache",
            name="max_value",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="elementresultscache",
            name="min_value",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="elementresultscache",
            name="load_case_count",
            field=models.IntegerField(default=0),
        ),
        # Add unique constraint to ElementResultsCache
        migrations.AddConstraint(
            model_name="elementresultscache",
            constraint=models.UniqueConstraint(
                fields=["project", "result_set", "result_type", "element", "story"],
                name="unique_element_cache_row",
            ),
        ),
        # Add aggregate columns to JointResultsCache
        migrations.AddField(
            model_name="jointresultscache",
            name="avg_value",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="jointresultscache",
            name="max_value",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="jointresultscache",
            name="min_value",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="jointresultscache",
            name="load_case_count",
            field=models.IntegerField(default=0),
        ),
    ]
