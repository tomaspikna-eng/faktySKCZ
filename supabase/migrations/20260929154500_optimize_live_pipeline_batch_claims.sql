create or replace function public.detektor_retime_batch_claims(
  p_session_id uuid,
  p_results jsonb,
  p_audio_duration_ms integer default 40000
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_item jsonb;
  v_seq integer;
  v_claim_id uuid;
  v_segment_id uuid;
  v_updated integer := 0;
begin
  if p_session_id is null then
    return jsonb_build_object('updated',0);
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_results,'[]'::jsonb))
  loop
    begin
      v_seq := greatest(0,(v_item->>'sourceSequenceNo')::integer);
    exception when others then
      continue;
    end;

    select ts.id into v_segment_id
    from public.transcript_segments ts
    where ts.session_id=p_session_id and ts.sequence_no=v_seq
    limit 1;

    select c.id into v_claim_id
    from public.claims c
    where c.session_id=p_session_id
      and c.claim_text=coalesce(v_item->>'claim','')
    order by c.created_at desc
    limit 1;

    if v_claim_id is not null then
      update public.claims
      set transcript_segment_id=coalesce(v_segment_id,transcript_segment_id),
          video_seconds=floor((v_seq * greatest(1,p_audio_duration_ms))/1000.0)::integer,
          metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
            'sourceSequenceNo',v_seq,
            'batchedAnalysis',true
          )
      where id=v_claim_id;
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object('updated',v_updated);
end
$function$;

revoke all on function public.detektor_retime_batch_claims(uuid,jsonb,integer) from public, anon, authenticated;
grant execute on function public.detektor_retime_batch_claims(uuid,jsonb,integer) to service_role;
