create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wishlist_id uuid references public.wishlists(id) on delete cascade,
  gift_id uuid references public.gifts(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_type_check
    check (type in ('reservation_created', 'gift_receipt_updated'))
);

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check
check (type in ('reservation_created', 'gift_receipt_updated'));

create index if not exists notifications_user_read_created_index
on public.notifications (user_id, read_at, created_at desc);

create index if not exists notifications_wishlist_created_index
on public.notifications (wishlist_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists
"Users can view their own notifications"
on public.notifications;

create policy
"Users can view their own notifications"
on public.notifications
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists
"Users can update their own notifications"
on public.notifications;

create policy
"Users can update their own notifications"
on public.notifications
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists
"Users can delete their own notifications"
on public.notifications;

create policy
"Users can delete their own notifications"
on public.notifications
for delete
to authenticated
using (
  auth.uid() = user_id
);

grant select, update, delete
on table public.notifications
to authenticated;

grant select, insert, update, delete
on table public.notifications
to service_role;

create or replace function public.create_reservation_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wishlist_owner_id uuid;
  gift_name text;
  wishlist_title text;
begin
  select w.owner_id, w.title, g.name
  into wishlist_owner_id, wishlist_title, gift_name
  from public.wishlists w
  join public.gifts g on g.wishlist_id = w.id
  where w.id = new.wishlist_id
    and g.id = new.gift_id;

  if wishlist_owner_id is null then
    return new;
  end if;

  insert into public.notifications (
    user_id,
    wishlist_id,
    gift_id,
    reservation_id,
    type,
    title,
    message
  ) values (
    wishlist_owner_id,
    new.wishlist_id,
    new.gift_id,
    new.id,
    'reservation_created',
    'Gift reserved!',
    case
      when gift_name is not null and trim(gift_name) <> '' then
        'Someone reserved "' || left(trim(gift_name), 180) || '" on ' || left(wishlist_title, 140) || '.'
      else
        'Someone reserved a gift from your wishlist.'
    end
  );

  return new;
end;
$$;

create or replace function public.create_gift_receipt_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wishlist_owner_id uuid;
  gift_name text;
  wishlist_title text;
begin
  select w.owner_id, w.title, g.name
  into wishlist_owner_id, wishlist_title, gift_name
  from public.wishlists w
  join public.gifts g on g.wishlist_id = w.id
  where w.id = new.wishlist_id
    and g.id = new.gift_id;

  if wishlist_owner_id is null then
    return new;
  end if;

  insert into public.notifications (
    user_id,
    wishlist_id,
    gift_id,
    reservation_id,
    type,
    title,
    message
  ) values (
    wishlist_owner_id,
    new.wishlist_id,
    new.gift_id,
    new.id,
    'gift_receipt_updated',
    'Gift Receipt updated!',
    case
      when gift_name is not null and trim(gift_name) <> '' then
        'Someone updated the Gift Receipt information for "' || left(trim(gift_name), 180) || '" on ' || left(wishlist_title, 140) || '.'
      else
        'Someone updated the Gift Receipt information for a gift on your wishlist.'
    end
  );

  return new;
end;
$$;

drop trigger if exists
gift_receipt_updated_notification
on public.reservations;

create trigger
gift_receipt_updated_notification
after update on public.reservations
for each row
when (
  old.tracking_number is distinct from new.tracking_number
  or old.order_url is distinct from new.order_url
  or old.receipt_url is distinct from new.receipt_url
)
execute function public.create_gift_receipt_notification();

drop trigger if exists
reservation_created_notification
on public.reservations;

create trigger
reservation_created_notification
after insert on public.reservations
for each row
execute function public.create_reservation_notification();
