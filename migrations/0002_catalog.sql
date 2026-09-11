-- Shared boutique catalog: public to browse, signed-in owners edit.
create table if not exists store_settings (
  id          text primary key default 'default',
  brand       text not null default 'Mi Catálogo',
  tagline     text not null default '',
  currency    text not null default 'RD$',
  whatsapp    text not null default '',
  updated_at  timestamptz not null default now()
);

create table if not exists products (
  id          text primary key,
  name        text not null,
  category    text not null default '',
  price       numeric not null default 0,
  sizes       text not null default '',
  description text not null default '',
  discount    integer not null default 0,
  featured    boolean not null default false,
  sold_out    boolean not null default false,
  images      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  text
);

create index if not exists products_category_idx on products (category);
create index if not exists products_created_at_idx on products (created_at desc);
