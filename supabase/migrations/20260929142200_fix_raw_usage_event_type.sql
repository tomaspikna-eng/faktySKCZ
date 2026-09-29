create or replace function public.detektor_record_raw_usage(
  p_client_install_id text,
  p_session_id uuid,
  p_seconds integer,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_wallet public.detektor_wallets%rowtype;
  v_id uuid;
begin
  if nullif(btrim(p_client_install_id),'') is null then return null; end if;
  if p_seconds is null or p_seconds <= 0 then return null; end if;

  insert into public.detektor_wallets(client_install_id)
  values(btrim(p_client_install_id))
  on conflict(client_install_id) do nothing;

  select * into v_wallet
  from public.detektor_wallets
  where client_install_id=btrim(p_client_install_id);

  insert into public.usage_ledger(
    session_id,user_id,client_install_id,event_type,seconds_delta,metadata
  )
  values(
    p_session_id,
    v_wallet.user_id,
    v_wallet.client_install_id,
    'debit',
    p_seconds,
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('usageType','live_audio_processed')
  )
  returning id into v_id;

  return v_id;
end
$function$;
