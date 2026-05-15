-- Migration: 002_join_room_rpc.sql
-- Supabase SQL Editor で実行してください

-- invite_token でルームを検索し、現在のユーザーをメンバーに追加するRPC
-- security definer で実行されるため rooms テーブルの RLS をバイパスできる
create or replace function join_room_by_token(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms%rowtype;
begin
  if auth.uid() is null then
    return json_build_object('error', '認証が必要です');
  end if;

  -- トークンでルームを検索（RLS バイパス）
  select * into v_room
  from rooms
  where invite_token = p_token;

  if not found then
    return json_build_object('error', '招待リンクが見つかりません');
  end if;

  -- メンバーに追加（既に参加済みの場合は無視）
  insert into room_members (room_id, user_id, role)
  values (v_room.id, auth.uid(), 'member')
  on conflict (room_id, user_id) do nothing;

  return json_build_object(
    'room_id',      v_room.id,
    'room_name',    v_room.name,
    'invite_token', v_room.invite_token,
    'created_by',   v_room.created_by,
    'created_at',   v_room.created_at
  );
end;
$$;

-- 認証済みユーザーに実行権限を付与
grant execute on function join_room_by_token(text) to authenticated;
