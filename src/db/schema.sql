-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists vector;

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  city text not null,
  country text not null,
  whatsapp_phone_number_id text,
  created_at timestamptz not null default now()
);

create table users_and_customers (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  phone text not null,
  full_name text,
  budget_omr numeric(12,2),
  created_at timestamptz not null default now(),
  unique (org_id, phone)
);

create table chat_sessions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  customer_phone text not null,
  channel text not null check (channel in ('whatsapp', 'voice')),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
create index chat_sessions_lookup_idx on chat_sessions (org_id, customer_phone, channel, status);

create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('customer', 'agent')),
  body text not null,
  created_at timestamptz not null default now()
);

create table agent_knowledge_base (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  content text not null,
  embedding vector(1024),
  created_at timestamptz not null default now()
);
create index agent_knowledge_base_embedding_idx
  on agent_knowledge_base using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table scheduled_bookings (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  session_id uuid not null references chat_sessions(id) on delete cascade,
  customer_name text,
  property_ref text,
  scheduled_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'pending', 'cancelled')),
  created_at timestamptz not null default now()
);

create or replace function match_knowledge_base(
  p_org_id uuid,
  p_query_embedding vector(1024),
  p_match_count int default 5
)
returns table (id uuid, org_id uuid, content text, similarity float)
language sql stable
as $$
  select
    id,
    org_id,
    content,
    1 - (embedding <=> p_query_embedding) as similarity
  from agent_knowledge_base
  where org_id = p_org_id
  order by embedding <=> p_query_embedding
  limit p_match_count;
$$;
