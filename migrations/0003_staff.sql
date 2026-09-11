-- Store staff: only these accounts can edit the catalog or create more accounts.
create table if not exists store_staff (
  user_id    text primary key,
  role       text not null default 'staff',
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists store_staff_role_idx on store_staff (role);
