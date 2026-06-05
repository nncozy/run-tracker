# 新しい要件定義
このプロジェクトはGoogleログインを廃止し、独自のPIN認証を用いたシステムにリファクタリングします。

## 1. 認証システム
- Google Authは使用しません。
- ユーザーは「ニックネーム」と「4桁のPIN」を入力します。
- 裏側でダミーのEmail (`ニックネーム@app.local`) を生成し、SupabaseのEmail/Password認証として処理してください。

## 2. データベース構造
- user_distances: ユーザー固有の「コース名・距離」マスタ
- records: time_ms(整数)と、JSONB型の `custom_fields` を持つ記録テーブル

## 3. UIの流用方針
- TimeAttackTab.tsx にある `WheelPicker` はタイム入力UIとして優秀なので、新しい InputPage.tsx でも完全に流用してください。
- 既存のTailwind(インラインスタイル)と theme.ts はそのまま使用します。


-- ============================================================
-- 1. USERS (Googleログイン廃止 -> ニックネームベース)
-- ============================================================
CREATE TABLE users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    nickname TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- 新規登録時、auth.usersのメタデータから自動でusersテーブルにレコードを作成するトリガー
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, nickname)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. USER_DISTANCES (ユーザー固有の距離マスタ)
-- ============================================================
CREATE TABLE user_distances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    distance_km NUMERIC(5, 2) NOT NULL,
    usage_count INT DEFAULT 0,
    last_used_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE user_distances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own distances" ON user_distances FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 3. RECORDS (JSONBカスタムフィールド搭載)
-- ============================================================
CREATE TABLE records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    distance_id UUID REFERENCES user_distances(id) ON DELETE SET NULL,
    time_ms BIGINT NOT NULL, -- 既存の WheelPicker の ms出力をそのまま格納
    run_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    custom_fields JSONB DEFAULT '{}'::jsonb, -- 【新規】天気、ケイデンス等を自由に追加
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- JSONBデータの検索を高速化
CREATE INDEX idx_records_custom_fields ON records USING GIN (custom_fields);

ALTER TABLE records ENABLE ROW LEVEL SECURITY;
-- 閲覧権限: 自分の記録、または同じルームのメンバーの記録
CREATE POLICY "View own and room members records" ON records FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM room_members rm1
        JOIN room_members rm2 ON rm1.room_id = rm2.room_id
        WHERE rm1.user_id = auth.uid() AND rm2.user_id = records.user_id
    )
);
CREATE POLICY "Insert own records" ON records FOR INSERT WITH CHECK (auth.uid() = user_id);