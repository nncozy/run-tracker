-- Run Tracker: Initial Schema
-- Execute this in Supabase SQL Editor

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id uuid references auth.users primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles_select_all" on profiles
  for select using (auth.uid() is not null);

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- ROOMS
-- ============================================================
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_token text unique default encode(gen_random_bytes(16), 'hex'),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- ROOM_MEMBERS
-- ============================================================
create table if not exists room_members (
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz default now(),
  primary key (room_id, user_id)
);

-- Helper function (security definer bypasses RLS to avoid recursion)
create or replace function get_my_room_ids()
returns setof uuid
language sql security definer stable set search_path = public as $$
  select room_id from room_members where user_id = auth.uid()
$$;

-- Rooms RLS
alter table rooms enable row level security;

create policy "rooms_select" on rooms
  for select using (
    created_by = auth.uid()
    or id = any(array(select get_my_room_ids()))
  );
create policy "rooms_insert" on rooms
  for insert with check (created_by = auth.uid());
create policy "rooms_update" on rooms
  for update using (created_by = auth.uid());
create policy "rooms_delete" on rooms
  for delete using (created_by = auth.uid());

-- Room Members RLS
alter table room_members enable row level security;

create policy "room_members_select" on room_members
  for select using (room_id = any(array(select get_my_room_ids())));
create policy "room_members_insert" on room_members
  for insert with check (
    user_id = auth.uid()
    or exists (select 1 from rooms where id = room_id and created_by = auth.uid())
  );
create policy "room_members_delete" on room_members
  for delete using (user_id = auth.uid());

-- ============================================================
-- EVENTS
-- ============================================================
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  distance_meters int,
  is_preset boolean default false,
  created_by uuid references profiles(id),
  room_id uuid references rooms(id) on delete cascade,
  created_at timestamptz default now()
);

alter table events enable row level security;

create policy "events_select" on events
  for select using (
    is_preset = true
    or created_by = auth.uid()
    or (room_id is not null and room_id = any(array(select get_my_room_ids())))
  );
create policy "events_insert" on events
  for insert with check (auth.uid() = created_by);
create policy "events_update" on events
  for update using (auth.uid() = created_by);
create policy "events_delete" on events
  for delete using (auth.uid() = created_by);

-- ============================================================
-- RECORDS
-- ============================================================
create table if not exists records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  room_id uuid references rooms(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  time_ms int not null,
  recorded_at date not null,
  avg_heart_rate int,
  max_heart_rate int,
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table records enable row level security;

create policy "records_select" on records
  for select using (
    user_id = auth.uid()
    or (room_id is not null and room_id = any(array(select get_my_room_ids())))
  );
create policy "records_insert" on records
  for insert with check (auth.uid() = user_id);
create policy "records_update" on records
  for update using (auth.uid() = user_id);
create policy "records_delete" on records
  for delete using (auth.uid() = user_id);

-- updated_at trigger
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists records_updated_at on records;
create trigger records_updated_at
  before update on records
  for each row execute function update_updated_at();

-- ============================================================
-- HEALTH_ACTIVITIES
-- ============================================================
create table if not exists health_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  external_id text,
  workout_date date not null,
  duration_seconds int,
  distance_meters float,
  avg_pace_sec_per_km int,
  avg_heart_rate int,
  max_heart_rate int,
  synced_at timestamptz default now(),
  unique(user_id, external_id)
);

alter table health_activities enable row level security;

create policy "health_activities_all" on health_activities
  for all using (auth.uid() = user_id);

-- ============================================================
-- PRESET EVENTS
-- (runs as superuser in SQL Editor, bypasses RLS)
-- ============================================================
insert into events (name, distance_meters, is_preset, created_by, room_id) values
  ('200m',   200,   true, null, null),
  ('400m',   400,   true, null, null),
  ('1km',    1000,  true, null, null),
  ('3km',    3000,  true, null, null),
  ('5km',    5000,  true, null, null),
  ('10km',   10000, true, null, null)
on conflict do nothing;
