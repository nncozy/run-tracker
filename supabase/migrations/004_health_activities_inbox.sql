-- ワークアウト受信箱: health_activities に status と start_time を追加
alter table health_activities
  add column if not exists status text default 'done',
  add column if not exists start_time text,
  add column if not exists record_id uuid references records(id) on delete set null;

-- 新着ワークアウトの検索を高速化
create index if not exists health_activities_pending_idx
  on health_activities(user_id, status)
  where status = 'pending';

-- ショートカット認証用 API キー
alter table profiles
  add column if not exists api_key text unique default encode(gen_random_bytes(16), 'hex');

-- Edge Function から api_key で profiles を参照できるようにする
-- (service role key を使う Edge Function 側で直接 select するので RLS 不要)
