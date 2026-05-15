alter table health_activities
  add column if not exists avg_cadence int,
  add column if not exists elevation_gain float,
  add column if not exists calories_active int,
  add column if not exists vo2max float,
  add column if not exists hr_zone1_seconds int,
  add column if not exists hr_zone2_seconds int,
  add column if not exists hr_zone3_seconds int,
  add column if not exists hr_zone4_seconds int,
  add column if not exists hr_zone5_seconds int;
