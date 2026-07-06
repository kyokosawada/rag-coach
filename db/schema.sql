-- Enable pgvector
create extension if not exists vector;

create table if not exists chunks (
  id bigint generated always as identity primary key,
  doc_title text not null,
  doc_type text not null,
  content text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);

-- Cosine-similarity top-k retrieval, with optional doc_type filter
create or replace function match_chunks(
  query_embedding vector(1536),
  match_count int default 5,
  filter_type text default null
)
returns table (
  id bigint,
  doc_title text,
  doc_type text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.doc_title,
    c.doc_type,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where filter_type is null or c.doc_type = filter_type
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
