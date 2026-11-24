create table if not exists codes (
  code        text primary key,
  brand       text not null,
  state       text not null default 'pending',
  attempts    int  not null default 0,
  first_seen  timestamptz not null default now(),
  checked_at  timestamptz,
  note        text
);

create index if not exists codes_state_brand on codes (state, brand, first_seen);

alter table codes add column if not exists attempts int not null default 0;
