-- 007_new_schema_migration.sql
-- 新スキーマ: users / user_distances / records をゼロから構築

BEGIN;

-- ============================================================
-- 1. users テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    nickname TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_all" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_select_all" ON users FOR SELECT USING (true);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- 2. handle_new_user トリガー（新規登録時に users へ自動挿入）
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.users (id, nickname)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 3. rooms テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_my_room_ids()
RETURNS SETOF UUID
LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT room_id FROM room_members WHERE user_id = auth.uid()
$$;

DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "rooms_insert" ON rooms;
DROP POLICY IF EXISTS "rooms_update" ON rooms;
DROP POLICY IF EXISTS "rooms_delete" ON rooms;
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (
    created_by = auth.uid() OR id = ANY(ARRAY(SELECT get_my_room_ids()))
);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "rooms_delete" ON rooms FOR DELETE USING (created_by = auth.uid());

-- ============================================================
-- 4. room_members テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS room_members (
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    PRIMARY KEY (room_id, user_id)
);

ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_members_select" ON room_members;
DROP POLICY IF EXISTS "room_members_insert" ON room_members;
DROP POLICY IF EXISTS "room_members_delete" ON room_members;
CREATE POLICY "room_members_select" ON room_members
    FOR SELECT USING (room_id = ANY(ARRAY(SELECT get_my_room_ids())));
CREATE POLICY "room_members_insert" ON room_members
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM rooms WHERE id = room_id AND created_by = auth.uid())
    );
CREATE POLICY "room_members_delete" ON room_members
    FOR DELETE USING (user_id = auth.uid());

-- join_room_by_token RPC
CREATE OR REPLACE FUNCTION join_room_by_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_room rooms%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN json_build_object('error', '認証が必要です');
    END IF;
    SELECT * INTO v_room FROM rooms WHERE invite_token = p_token;
    IF NOT FOUND THEN
        RETURN json_build_object('error', '招待リンクが見つかりません');
    END IF;
    INSERT INTO room_members (room_id, user_id, role)
    VALUES (v_room.id, auth.uid(), 'member')
    ON CONFLICT (room_id, user_id) DO NOTHING;
    RETURN json_build_object(
        'room_id',      v_room.id,
        'room_name',    v_room.name,
        'invite_token', v_room.invite_token,
        'created_by',   v_room.created_by,
        'created_at',   v_room.created_at
    );
END;
$$;
GRANT EXECUTE ON FUNCTION join_room_by_token(TEXT) TO authenticated;

-- ============================================================
-- 5. user_distances テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS user_distances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    distance_km NUMERIC(5, 2) NOT NULL,
    usage_count INT DEFAULT 0,
    last_used_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE user_distances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_distances_all_own" ON user_distances;
CREATE POLICY "user_distances_all_own" ON user_distances
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 6. records テーブル（新スキーマ）
-- ============================================================
DROP TABLE IF EXISTS records CASCADE;

CREATE TABLE records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    distance_id UUID REFERENCES user_distances(id) ON DELETE SET NULL,
    time_ms BIGINT NOT NULL,
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_records_custom_fields ON records USING GIN (custom_fields);
CREATE INDEX IF NOT EXISTS idx_records_user_id ON records (user_id);
CREATE INDEX IF NOT EXISTS idx_records_run_date ON records (run_date DESC);

ALTER TABLE records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "records_select" ON records FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM room_members rm1
        JOIN room_members rm2 ON rm1.room_id = rm2.room_id
        WHERE rm1.user_id = auth.uid() AND rm2.user_id = records.user_id
    )
);
CREATE POLICY "records_insert" ON records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "records_update" ON records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "records_delete" ON records FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 7. health_activities テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS health_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    external_id TEXT,
    workout_date DATE NOT NULL,
    start_time TEXT,
    duration_seconds INT,
    distance_meters FLOAT,
    avg_pace_sec_per_km INT,
    avg_heart_rate INT,
    max_heart_rate INT,
    avg_cadence INT,
    elevation_gain FLOAT,
    calories_active FLOAT,
    vo2max FLOAT,
    hr_zone1_seconds INT,
    hr_zone2_seconds INT,
    hr_zone3_seconds INT,
    hr_zone4_seconds INT,
    hr_zone5_seconds INT,
    status TEXT DEFAULT 'pending',
    record_id UUID REFERENCES records(id) ON DELETE SET NULL,
    synced_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    UNIQUE(user_id, external_id)
);

ALTER TABLE health_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "health_activities_all" ON health_activities;
CREATE POLICY "health_activities_all" ON health_activities
    FOR ALL USING (auth.uid() = user_id);

COMMIT;
