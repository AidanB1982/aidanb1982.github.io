-- Apply after 20261025_bp_reading.sql. Does not enable checkout or grant free access.
begin;
create table public.bp_reading_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  shopify_cart_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  access_until timestamptz
);
create index bp_reading_checkout_user_date on public.bp_reading_checkout_intents(user_id,created_at desc);
create table public.bp_reading_membership_receipts (
  payment_id text primary key check (length(payment_id) between 1 and 200),
  intent_id uuid not null references public.bp_reading_checkout_intents(id) on delete restrict,
  paid_at timestamptz not null,
  access_until timestamptz not null,
  revoked_at timestamptz
);
alter table public.bp_reading_checkout_intents enable row level security;
alter table public.bp_reading_membership_receipts enable row level security;
revoke all on public.bp_reading_checkout_intents,public.bp_reading_membership_receipts from anon,authenticated;
grant all on public.bp_reading_checkout_intents,public.bp_reading_membership_receipts to service_role;

create function public.bp_reading_checkout_status(p_intent_id uuid)
returns table(status text,access_until timestamptz)
language sql stable security definer set search_path = ''
as $$
  select i.status,i.access_until from public.bp_reading_checkout_intents i
  where i.id=p_intent_id and i.user_id=auth.uid();
$$;
revoke all on function public.bp_reading_checkout_status(uuid) from public,anon;
grant execute on function public.bp_reading_checkout_status(uuid) to authenticated;

-- SERVER ONLY. Call solely after validating Shopify's raw-body webhook signature,
-- the expected shop, paid transaction, GBP amount, variant and annual selling plan.
-- The payment timestamp must come from the verified payment, never browser input.
create function public.bp_reading_apply_membership_payment(p_intent_id uuid,p_payment_id text,p_paid_at timestamptz)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  checkout public.bp_reading_checkout_intents%rowtype;
  existing public.bp_reading_membership_receipts%rowtype;
  until_at timestamptz;
begin
  if p_payment_id is null or length(p_payment_id) not between 1 and 200 or p_paid_at is null or p_paid_at > now()+interval '5 minutes' then
    raise exception 'Invalid verified payment' using errcode='22023';
  end if;
  select * into checkout from public.bp_reading_checkout_intents where id=p_intent_id for update;
  if not found or checkout.status='failed' or checkout.shopify_cart_id is null or p_paid_at < checkout.created_at-interval '5 minutes' then
    raise exception 'Unknown checkout' using errcode='22023';
  end if;
  -- A calendar year in UTC, not 365 days or 12 fixed 30-day months.
  until_at := ((p_paid_at at time zone 'UTC') + interval '1 year') at time zone 'UTC';
  insert into public.bp_reading_membership_receipts(payment_id,intent_id,paid_at,access_until)
  values(p_payment_id,p_intent_id,p_paid_at,until_at) on conflict do nothing;
  if not found then
    select * into existing from public.bp_reading_membership_receipts where payment_id=p_payment_id;
    if existing.intent_id<>p_intent_id or existing.paid_at<>p_paid_at then
      raise exception 'Payment already assigned' using errcode='22023';
    end if;
    return existing.access_until;
  end if;
  insert into public.bp_reading_memberships(user_id,access_until,payment_reference)
  values(checkout.user_id,until_at,p_payment_id)
  on conflict(user_id) do update set
    access_until=greatest(bp_reading_memberships.access_until,excluded.access_until),
    payment_reference=case when excluded.access_until>=bp_reading_memberships.access_until then excluded.payment_reference else bp_reading_memberships.payment_reference end,
    revoked_at=null,updated_at=now();
  update public.bp_reading_checkout_intents set status='paid',
    paid_at=greatest(paid_at,p_paid_at),access_until=greatest(access_until,until_at)
    where id=p_intent_id;
  return until_at;
end;
$$;
revoke all on function public.bp_reading_apply_membership_payment(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.bp_reading_apply_membership_payment(uuid,text,timestamptz) to service_role;
-- Full refunds remove only receipt-backed access; unrelated manual grants are preserved.
create function public.bp_reading_revoke_membership_payment(p_payment_id text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  receipt public.bp_reading_membership_receipts%rowtype;
  account_id uuid;
  membership public.bp_reading_memberships%rowtype;
  remaining timestamptz;
begin
  select * into receipt from public.bp_reading_membership_receipts where payment_id=p_payment_id for update;
  if not found then return false; end if;
  select user_id into account_id from public.bp_reading_checkout_intents where id=receipt.intent_id;
  select * into membership from public.bp_reading_memberships where user_id=account_id for update;
  update public.bp_reading_membership_receipts set revoked_at=coalesce(revoked_at,now()) where payment_id=p_payment_id;
  if exists(select 1 from public.bp_reading_membership_receipts where payment_id=membership.payment_reference) then
    select max(r.access_until) into remaining from public.bp_reading_membership_receipts r
      join public.bp_reading_checkout_intents i on i.id=r.intent_id
      where i.user_id=account_id and r.revoked_at is null;
    update public.bp_reading_memberships set access_until=coalesce(remaining,now()),revoked_at=case when remaining is null then now() else null end,updated_at=now() where user_id=account_id;
  end if;
  -- Update browser confirmation to the remaining, nonrefunded period as well.
  select max(access_until) into remaining from public.bp_reading_membership_receipts
    where intent_id=receipt.intent_id and revoked_at is null;
  update public.bp_reading_checkout_intents set status=case when remaining is null then 'refunded' else 'paid' end,
    access_until=remaining where id=receipt.intent_id;
  return true;
end;
$$;
revoke all on function public.bp_reading_revoke_membership_payment(text) from public,anon,authenticated;
grant execute on function public.bp_reading_revoke_membership_payment(text) to service_role;
commit;
