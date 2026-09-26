-- CardPay payment foundation for DETEKTOR.
-- Live products remain inactive until merchant credentials and bank tests are complete.

create sequence if not exists public.detektor_cardpay_vs_seq
  as bigint start with 1 increment by 1 minvalue 1 maxvalue 99999999 no cycle;

create table if not exists public.detektor_payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  provider text not null default 'cardpay' check (provider in ('cardpay')),
  product_code text not null references public.detektor_credit_products(code) on update cascade,
  variable_symbol bigint not null unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR' check (currency='EUR'),
  status text not null default 'pending'
    check (status in ('pending','paid','failed','cancelled','expired')),
  provider_result text,
  provider_auth_code text,
  provider_tid text,
  provider_timestamp text,
  provider_ecdsa_key text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists detektor_payment_orders_user_created_idx
  on public.detektor_payment_orders(user_id,created_at desc);

alter table public.detektor_payment_orders enable row level security;

drop policy if exists detektor_payment_orders_select_own on public.detektor_payment_orders;
create policy detektor_payment_orders_select_own
on public.detektor_payment_orders for select to authenticated
using (user_id=(select auth.uid()));

create or replace function public.detektor_create_cardpay_order(p_user_id uuid,p_product_code text)
returns jsonb language plpgsql security definer set search_path='public','pg_temp'
as $function$
declare
  v_product public.detektor_credit_products%rowtype;
  v_order public.detektor_payment_orders%rowtype;
  v_vs bigint;
begin
  if current_user not in ('postgres','service_role') then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_user_id is null then raise exception 'USER_ID_REQUIRED'; end if;

  select * into v_product from public.detektor_credit_products
  where code=p_product_code and product_type='topup' and active=true;
  if not found then raise exception 'PRODUCT_NOT_AVAILABLE'; end if;

  v_vs:=200000000+nextval('public.detektor_cardpay_vs_seq');

  insert into public.detektor_payment_orders(user_id,product_code,variable_symbol,amount_cents,currency,metadata)
  values(p_user_id,v_product.code,v_vs,v_product.price_cents,v_product.currency,
    jsonb_build_object('productName',v_product.name,'creditsMilli',v_product.credits_milli))
  returning * into v_order;

  return jsonb_build_object('orderId',v_order.id,'variableSymbol',v_order.variable_symbol::text,
    'amountCents',v_order.amount_cents,'currency',v_order.currency,'productCode',v_order.product_code);
end
$function$;

create or replace function public.detektor_finalize_cardpay_order(
  p_variable_symbol bigint,p_amount_cents integer,p_currency text,p_result text,
  p_auth_code text,p_tid text,p_provider_timestamp text,p_ecdsa_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path='public','pg_temp'
as $function$
declare
  v_order public.detektor_payment_orders%rowtype;
  v_product public.detektor_credit_products%rowtype;
  v_grant jsonb;
  v_key text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'SERVICE_ROLE_REQUIRED'; end if;

  select * into v_order from public.detektor_payment_orders
  where variable_symbol=p_variable_symbol for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if v_order.status='paid' then
    return jsonb_build_object('ok',true,'duplicate',true,'status','paid','orderId',v_order.id);
  end if;

  if v_order.amount_cents<>p_amount_cents then raise exception 'AMOUNT_MISMATCH'; end if;
  if upper(v_order.currency)<>upper(p_currency) then raise exception 'CURRENCY_MISMATCH'; end if;

  update public.detektor_payment_orders
  set provider_result=p_result,provider_auth_code=nullif(p_auth_code,''),provider_tid=nullif(p_tid,''),
      provider_timestamp=nullif(p_provider_timestamp,''),provider_ecdsa_key=nullif(p_ecdsa_key,''),
      metadata=metadata||coalesce(p_metadata,'{}'::jsonb),
      status=case when upper(p_result)='OK' then 'paid' else 'failed' end,
      paid_at=case when upper(p_result)='OK' then coalesce(paid_at,now()) else paid_at end,
      updated_at=now()
  where id=v_order.id returning * into v_order;

  if v_order.status='paid' then
    select * into v_product from public.detektor_credit_products where code=v_order.product_code;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
    v_key:='user:'||v_order.user_id::text;
    v_grant:=public.detektor_grant_credits(
      v_key,v_product.credits_milli,'purchase',v_order.amount_cents,v_order.currency,
      'cardpay:'||v_order.id::text,
      jsonb_build_object('provider','cardpay','orderId',v_order.id,
        'variableSymbol',v_order.variable_symbol,'productCode',v_order.product_code,'tid',v_order.provider_tid)
    );
  end if;

  return jsonb_build_object('ok',true,'duplicate',false,'status',v_order.status,'orderId',v_order.id,'credits',v_grant);
end
$function$;

revoke all on function public.detektor_create_cardpay_order(uuid,text) from public,anon,authenticated;
revoke all on function public.detektor_finalize_cardpay_order(bigint,integer,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.detektor_create_cardpay_order(uuid,text) to service_role;
grant execute on function public.detektor_finalize_cardpay_order(bigint,integer,text,text,text,text,text,text,jsonb) to service_role;
