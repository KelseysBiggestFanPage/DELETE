create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null,
  is_live boolean not null default false,
  access_code_hash text,
  event_date date,
  owner_contact_email text,
  owner_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wishlists_slug_unique
on public.wishlists (lower(slug));

create index if not exists wishlists_owner_id_index
on public.wishlists (owner_id);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  product_url text not null,
  image_url text,
  price numeric(10, 2),
  description text,
  instructions text,
  shipping_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gifts_wishlist_id_index
on public.gifts (wishlist_id);

create index if not exists gifts_owner_id_index
on public.gifts (owner_id);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.gifts(id) on delete cascade,
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  reserver_user_id uuid references auth.users(id) on delete set null,
  reserver_name text not null,
  reserver_email text,
  reserver_phone text,
  receipt_code varchar(4) not null,
  receipt_url text,
  tracking_number text,
  order_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reservations_gift_unique
    unique (gift_id),

  constraint reservations_receipt_code_numeric
    check (receipt_code ~ '^[0-9]{4}$'),

  constraint reservations_contact_required
    check (
      nullif(trim(reserver_email), '') is not null
      or
      nullif(trim(reserver_phone), '') is not null
    )
);

create index if not exists reservations_wishlist_id_index
on public.reservations (wishlist_id);

create index if not exists reservations_gift_id_index
on public.reservations (gift_id);

create index if not exists reservations_reserver_user_id_index
on public.reservations (reserver_user_id);

alter table public.profiles
enable row level security;

alter table public.wishlists
enable row level security;

alter table public.gifts
enable row level security;

alter table public.reservations
enable row level security;

drop policy if exists
"Users can view their own profile"
on public.profiles;

create policy
"Users can view their own profile"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
);

drop policy if exists
"Users can create their own profile"
on public.profiles;

create policy
"Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
);

drop policy if exists
"Users can update their own profile"
on public.profiles;

create policy
"Users can update their own profile"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
)
with check (
  auth.uid() = id
);

drop policy if exists
"Users can view their own wishlists"
on public.wishlists;

create policy
"Users can view their own wishlists"
on public.wishlists
for select
to authenticated
using (
  auth.uid() = owner_id
);

drop policy if exists
"Users can create their own wishlists"
on public.wishlists;

create policy
"Users can create their own wishlists"
on public.wishlists
for insert
to authenticated
with check (
  auth.uid() = owner_id
);

drop policy if exists
"Users can update their own wishlists"
on public.wishlists;

create policy
"Users can update their own wishlists"
on public.wishlists
for update
to authenticated
using (
  auth.uid() = owner_id
)
with check (
  auth.uid() = owner_id
);

drop policy if exists
"Users can delete their own wishlists"
on public.wishlists;

create policy
"Users can delete their own wishlists"
on public.wishlists
for delete
to authenticated
using (
  auth.uid() = owner_id
);

drop policy if exists
"Users can view gifts in their own wishlists"
on public.gifts;

create policy
"Users can view gifts in their own wishlists"
on public.gifts
for select
to authenticated
using (
  auth.uid() = owner_id
);

drop policy if exists
"Users can add gifts to their own wishlists"
on public.gifts;

create policy
"Users can add gifts to their own wishlists"
on public.gifts
for insert
to authenticated
with check (
  auth.uid() = owner_id
  and exists (
    select 1
    from public.wishlists
    where wishlists.id = gifts.wishlist_id
    and wishlists.owner_id = auth.uid()
  )
);

drop policy if exists
"Users can update gifts in their own wishlists"
on public.gifts;

create policy
"Users can update gifts in their own wishlists"
on public.gifts
for update
to authenticated
using (
  auth.uid() = owner_id
)
with check (
  auth.uid() = owner_id
  and exists (
    select 1
    from public.wishlists
    where wishlists.id = gifts.wishlist_id
    and wishlists.owner_id = auth.uid()
  )
);

drop policy if exists
"Users can delete gifts in their own wishlists"
on public.gifts;

create policy
"Users can delete gifts in their own wishlists"
on public.gifts
for delete
to authenticated
using (
  auth.uid() = owner_id
);

drop policy if exists
"Owners can view reservations"
on public.reservations;

create policy
"Owners can view reservations"
on public.reservations
for select
to authenticated
using (
  exists (
    select 1
    from public.wishlists
    where wishlists.id = reservations.wishlist_id
    and wishlists.owner_id = auth.uid()
  )
);

drop policy if exists
"Owners can update reservations"
on public.reservations;

create policy
"Owners can update reservations"
on public.reservations
for update
to authenticated
using (
  exists (
    select 1
    from public.wishlists
    where wishlists.id = reservations.wishlist_id
    and wishlists.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.wishlists
    where wishlists.id = reservations.wishlist_id
    and wishlists.owner_id = auth.uid()
  )
);

drop policy if exists
"Owners can delete reservations"
on public.reservations;

create policy
"Owners can delete reservations"
on public.reservations
for delete
to authenticated
using (
  exists (
    select 1
    from public.wishlists
    where wishlists.id = reservations.wishlist_id
    and wishlists.owner_id = auth.uid()
  )
);

grant select, insert, update, delete
on table public.profiles
to service_role;

grant select, insert, update, delete
on table public.wishlists
to service_role;

grant select, insert, update, delete
on table public.gifts
to service_role;

grant select, insert, update, delete
on table public.reservations
to service_role;

-- GoWishlist notification system
-- Run this after the base wishlist schema. This file is idempotent.

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
    check (type in ('reservation_created'))
);

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

drop trigger if exists
reservation_created_notification
on public.reservations;

create trigger
reservation_created_notification
after insert on public.reservations
for each row
execute function public.create_reservation_notification();

