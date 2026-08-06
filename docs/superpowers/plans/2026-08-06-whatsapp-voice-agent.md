# WhatsApp/Voice Client Agent (Module A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend service for "Murshed" — the 24/7 WhatsApp + voice lead-qualification agent for the GCC luxury real estate agency blueprint (Module A of `gcc-ai-agency-blueprint.md`), covering inbound WhatsApp triage, vector-grounded LLM replies in Khaleeji/Omani Arabic or English, and Vapi.ai voice tool-calling for booking confirmations.

**Architecture:** A single Fastify HTTP service exposes two webhooks — `POST /webhooks/whatsapp` (Meta WhatsApp Cloud API) and `POST /webhooks/vapi` (Vapi.ai tool-calling). Both webhooks share a small set of stateless services (session lookup/creation, knowledge-base vector search, LLM reply generation, booking creation) backed by a multi-tenant Supabase Postgres schema with pgvector. Every service takes its dependencies (Supabase client, Anthropic client, env config) as explicit parameters rather than reading globals, so each one is unit-testable in isolation with mocks — no test ever hits a real network or database.

**Tech Stack:** Node.js 20+, TypeScript (strict, ESM), Fastify 4, `@supabase/supabase-js` 2, `@anthropic-ai/sdk`, Voyage AI (`voyage-3`) for embeddings — Claude has no embeddings endpoint of its own — `zod` for env validation, Vitest for tests.

## Global Constraints

- Node.js >= 20, TypeScript `strict: true`, ESM modules (`"type": "module"`) throughout.
- Package manager: npm. Test runner: Vitest (`npm test`). No test may perform real network I/O — every external call (Supabase, Anthropic, Voyage, WhatsApp Graph API, Vapi) is mocked at the unit level.
- LLM model id: `claude-sonnet-5`. Embeddings model: `voyage-3` (1024-dim vectors) via Voyage AI — do not substitute an OpenAI embeddings call; Anthropic does not offer one.
- Secrets only ever live in `.env` (git-ignored); `.env.example` documents every required variable with no real values.
- All Arabic source strings are UTF-8, written in natural Khaleeji/Omani register per the blueprint's Section 4 persona rules — no transliteration, no Fus'ha-only fallback text.
- Every service function takes its external dependencies (Supabase client, Anthropic client, env slice) as parameters — no module-level singletons — so tests can inject mocks without `vi.mock`-ing entire SDKs where a plain object mock will do.
- Scope is Module A only: WhatsApp text triage + Vapi tool-calling for bookings. Out of scope for this plan: Vapi's STT/TTS voice configuration itself (Section 5 of the blueprint), the outbound scraping/outreach pipeline (Module B — flagged with real compliance risk in the prior review and needs its own, differently-scoped plan), and the Softr/Airtable dashboard (Section 3).

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `src/types.ts`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `Session`, `KnowledgeChunk`, `LlmReply`, `Booking` types from `src/types.ts`, imported by every later task.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "gcc-ai-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "dev": "tsx src/server.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.0",
    "@supabase/supabase-js": "^2.45.0",
    "fastify": "^4.28.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write `.env.example`**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...
WHATSAPP_TOKEN=your-meta-cloud-api-token
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_VERIFY_TOKEN=choose-a-random-string
VAPI_WEBHOOK_SECRET=choose-a-random-string
PORT=3000
DEFAULT_ORG_ID=
DEFAULT_ORG_NAME=
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 6: Write `src/types.ts`**

```ts
export interface Session {
  id: string;
  orgId: string;
  customerPhone: string;
  channel: 'whatsapp' | 'voice';
  createdAt: string;
}

export interface KnowledgeChunk {
  id: string;
  orgId: string;
  content: string;
  similarity: number;
}

export interface LlmReply {
  text: string;
}

export interface Booking {
  id: string;
  orgId: string;
  sessionId: string;
  customerName?: string;
  propertyRef?: string;
  scheduledAt: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}
```

- [ ] **Step 7: Write smoke test `tests/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('project scaffold', () => {
  it('runs a trivial assertion so the test pipeline is proven end to end', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Install dependencies and run the test suite**

Run: `npm install && npm test`
Expected: 1 passing test (`project scaffold > runs a trivial assertion...`).

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .env.example .gitignore src/types.ts tests/smoke.test.ts package-lock.json
git commit -m "chore: scaffold TypeScript/Fastify project"
```

---

### Task 2: Environment config

**Files:**
- Create: `src/config/env.ts`
- Test: `tests/config/env.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Env` type and `loadEnv(source?): Env`, used by every service/route from Task 3 onward.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const validEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  VOYAGE_API_KEY: 'voyage-test',
  WHATSAPP_TOKEN: 'whatsapp-token',
  WHATSAPP_PHONE_NUMBER_ID: '1234567890',
  WHATSAPP_VERIFY_TOKEN: 'verify-token',
  VAPI_WEBHOOK_SECRET: 'vapi-secret',
  PORT: '3000',
};

describe('loadEnv', () => {
  it('parses a complete, valid environment', () => {
    const env = loadEnv(validEnv);
    expect(env.PORT).toBe(3000);
    expect(env.SUPABASE_URL).toBe('https://example.supabase.co');
  });

  it('throws a readable error when a required variable is missing', () => {
    const { SUPABASE_URL, ...rest } = validEnv;
    expect(() => loadEnv(rest)).toThrow(/SUPABASE_URL/);
  });

  it('defaults PORT to 3000 when not set', () => {
    const { PORT, ...rest } = validEnv;
    const env = loadEnv(rest);
    expect(env.PORT).toBe(3000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config/env.test.ts`
Expected: FAIL — `Cannot find module '../../src/config/env.js'`

- [ ] **Step 3: Write `src/config/env.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  VOYAGE_API_KEY: z.string().min(1),
  WHATSAPP_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  VAPI_WEBHOOK_SECRET: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and parses process.env into a typed Env object. Throws a
 * readable error listing every missing/invalid variable instead of
 * failing deep inside whichever service first touches it.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/config/env.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts tests/config/env.test.ts
git commit -m "feat: add validated environment config"
```

---

### Task 3: Supabase client factory

**Files:**
- Create: `src/lib/supabase.ts`
- Test: `tests/lib/supabase.test.ts`

**Interfaces:**
- Consumes: `Env` from Task 2.
- Produces: `getSupabaseClient(env): SupabaseClient`, used by every service that touches the database.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';

const createClientMock = vi.fn(() => ({ mocked: true }));
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

const { getSupabaseClient } = await import('../../src/lib/supabase.js');

describe('getSupabaseClient', () => {
  it('creates a client with the configured URL and service role key', () => {
    const client = getSupabaseClient({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    });

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      { auth: { persistSession: false } }
    );
    expect(client).toEqual({ mocked: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/supabase.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/supabase.js'`

- [ ] **Step 3: Write `src/lib/supabase.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../config/env.js';

export function getSupabaseClient(
  env: Pick<Env, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>
): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/supabase.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.ts tests/lib/supabase.test.ts
git commit -m "feat: add Supabase client factory"
```

---

### Task 4: Database schema

**Files:**
- Create: `src/db/schema.sql`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Produces: `organizations`, `users_and_customers`, `chat_sessions`, `chat_messages`, `agent_knowledge_base`, `scheduled_bookings` tables and the `match_knowledge_base` RPC function, which every later service assumes exist when run against a real Supabase project. (This task ships the DDL; running it against an actual Supabase instance via the Supabase CLI or SQL editor is a deployment step outside this plan's automated tests.)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/db/schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');

describe('schema.sql', () => {
  it.each([
    'organizations',
    'users_and_customers',
    'chat_sessions',
    'chat_messages',
    'agent_knowledge_base',
    'scheduled_bookings',
  ])('defines the %s table', (table) => {
    expect(schema).toMatch(new RegExp(`create table ${table}`));
  });

  it('defines the match_knowledge_base RPC function used for vector search', () => {
    expect(schema).toMatch(/create or replace function match_knowledge_base/);
  });

  it('enables the pgvector extension', () => {
    expect(schema).toMatch(/create extension if not exists vector/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open '.../src/db/schema.sql'`

- [ ] **Step 3: Write `src/db/schema.sql`**

```sql
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.sql tests/db/schema.test.ts
git commit -m "feat: add multi-tenant Supabase schema with pgvector knowledge base"
```

---

### Task 5: Session service + Supabase test mock helper

**Files:**
- Create: `tests/helpers/supabaseMock.ts`
- Create: `src/services/sessionService.ts`
- Test: `tests/services/sessionService.test.ts`

**Interfaces:**
- Consumes: `chat_sessions` table shape from Task 4, `Session` type from Task 1.
- Produces: `findOrCreateSession(supabase, orgId, customerPhone, channel): Promise<Session>`, used by the WhatsApp webhook (Task 11). `createSupabaseMock()` test helper, reused by Tasks 7 and 12's tests.

- [ ] **Step 1: Write the chainable Supabase mock helper**

```ts
// tests/helpers/supabaseMock.ts
import { vi } from 'vitest';

/**
 * Builds a chainable Supabase query builder mock. Each chain method
 * (from/select/insert/eq/order/limit) returns the same object so calls
 * can be chained arbitrarily; reassign `.maybeSingle`, `.single`, or
 * `.rpc` in a test to control what the chain resolves to.
 */
export function createSupabaseMock() {
  const chain: any = {
    from: vi.fn(() => chain),
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
  return chain;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/services/sessionService.test.ts
import { describe, it, expect } from 'vitest';
import { findOrCreateSession } from '../../src/services/sessionService.js';
import { createSupabaseMock } from '../helpers/supabaseMock.js';

describe('findOrCreateSession', () => {
  it('returns the existing open session when one is found', async () => {
    const supabase = createSupabaseMock();
    supabase.maybeSingle = () =>
      Promise.resolve({
        data: {
          id: 'sess-1',
          org_id: 'org-1',
          customer_phone: '96890000000',
          channel: 'whatsapp',
          status: 'open',
          created_at: '2026-08-06T10:00:00.000Z',
        },
        error: null,
      });

    const session = await findOrCreateSession(supabase as any, 'org-1', '96890000000', 'whatsapp');

    expect(session).toEqual({
      id: 'sess-1',
      orgId: 'org-1',
      customerPhone: '96890000000',
      channel: 'whatsapp',
      createdAt: '2026-08-06T10:00:00.000Z',
    });
  });

  it('creates a new session when none is open', async () => {
    const supabase = createSupabaseMock();
    supabase.maybeSingle = () => Promise.resolve({ data: null, error: null });
    supabase.single = () =>
      Promise.resolve({
        data: {
          id: 'sess-2',
          org_id: 'org-1',
          customer_phone: '96890000001',
          channel: 'whatsapp',
          status: 'open',
          created_at: '2026-08-06T10:05:00.000Z',
        },
        error: null,
      });

    const session = await findOrCreateSession(supabase as any, 'org-1', '96890000001', 'whatsapp');

    expect(supabase.insert).toHaveBeenCalledWith({
      org_id: 'org-1',
      customer_phone: '96890000001',
      channel: 'whatsapp',
      status: 'open',
    });
    expect(session.id).toBe('sess-2');
  });

  it('throws a readable error when the lookup query fails', async () => {
    const supabase = createSupabaseMock();
    supabase.maybeSingle = () => Promise.resolve({ data: null, error: { message: 'connection reset' } });

    await expect(findOrCreateSession(supabase as any, 'org-1', '96890000002', 'whatsapp')).rejects.toThrow(
      'Failed to look up chat session: connection reset'
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/services/sessionService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/sessionService.js'`

- [ ] **Step 4: Write `src/services/sessionService.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Session } from '../types.js';

interface ChatSessionRow {
  id: string;
  org_id: string;
  customer_phone: string;
  channel: 'whatsapp' | 'voice';
  status: 'open' | 'closed';
  created_at: string;
}

function mapRow(row: ChatSessionRow): Session {
  return {
    id: row.id,
    orgId: row.org_id,
    customerPhone: row.customer_phone,
    channel: row.channel,
    createdAt: row.created_at,
  };
}

/**
 * Finds the customer's open chat session for this org/channel, or
 * creates a new one if none exists. This is the single entry point
 * both the WhatsApp and voice webhooks use to resolve which
 * conversation thread an inbound message belongs to.
 */
export async function findOrCreateSession(
  supabase: SupabaseClient,
  orgId: string,
  customerPhone: string,
  channel: 'whatsapp' | 'voice'
): Promise<Session> {
  const existing = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('org_id', orgId)
    .eq('customer_phone', customerPhone)
    .eq('channel', channel)
    .eq('status', 'open')
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Failed to look up chat session: ${existing.error.message}`);
  }

  if (existing.data) {
    return mapRow(existing.data as ChatSessionRow);
  }

  const created = await supabase
    .from('chat_sessions')
    .insert({ org_id: orgId, customer_phone: customerPhone, channel, status: 'open' })
    .select('*')
    .single();

  if (created.error || !created.data) {
    throw new Error(`Failed to create chat session: ${created.error?.message}`);
  }

  return mapRow(created.data as ChatSessionRow);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/services/sessionService.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/supabaseMock.ts src/services/sessionService.ts tests/services/sessionService.test.ts
git commit -m "feat: add chat session find-or-create service"
```

---

### Task 6: Embedding service (Voyage AI)

**Files:**
- Create: `src/services/embeddingService.ts`
- Test: `tests/services/embeddingService.test.ts`

**Interfaces:**
- Consumes: `Env` (`VOYAGE_API_KEY`) from Task 2.
- Produces: `embedText(env, text): Promise<number[]>`, used by the knowledge base service (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { embedText } from '../../src/services/embeddingService.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('embedText', () => {
  it('returns the embedding vector from Voyage AI', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const embedding = await embedText({ VOYAGE_API_KEY: 'test-key' }, 'أبحث عن فيلا مطلة على الجولف');

    expect(embedding).toEqual([0.1, 0.2, 0.3]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.voyageai.com/v1/embeddings',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when the Voyage API responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' })
    );

    await expect(embedText({ VOYAGE_API_KEY: 'bad-key' }, 'test')).rejects.toThrow(
      'Voyage embeddings request failed: 401 unauthorized'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/embeddingService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/embeddingService.js'`

- [ ] **Step 3: Write `src/services/embeddingService.ts`**

```ts
import type { Env } from '../config/env.js';

const VOYAGE_ENDPOINT = 'https://api.voyageai.com/v1/embeddings';

/**
 * Converts text into a vector embedding via Voyage AI (Anthropic's
 * recommended embeddings partner — Claude has no embeddings endpoint
 * of its own). Used to turn an inbound customer message into a query
 * vector for agent_knowledge_base similarity search.
 */
export async function embedText(env: Pick<Env, 'VOYAGE_API_KEY'>, text: string): Promise<number[]> {
  const response = await fetch(VOYAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: 'voyage-3', input: [text] }),
  });

  if (!response.ok) {
    throw new Error(`Voyage embeddings request failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { data: { embedding: number[] }[] };
  return payload.data[0].embedding;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/embeddingService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/embeddingService.ts tests/services/embeddingService.test.ts
git commit -m "feat: add Voyage AI embedding service"
```

---

### Task 7: Knowledge base service

**Files:**
- Create: `src/services/knowledgeService.ts`
- Test: `tests/services/knowledgeService.test.ts`

**Interfaces:**
- Consumes: `embedText` from Task 6, `match_knowledge_base` RPC shape from Task 4, `createSupabaseMock` from Task 5, `KnowledgeChunk` type from Task 1.
- Produces: `searchKnowledgeBase(supabase, env, orgId, queryText, matchCount?): Promise<KnowledgeChunk[]>`, used by the WhatsApp webhook (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createSupabaseMock } from '../helpers/supabaseMock.js';

vi.mock('../../src/services/embeddingService.js', () => ({
  embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

const { searchKnowledgeBase } = await import('../../src/services/knowledgeService.js');

describe('searchKnowledgeBase', () => {
  it('embeds the query and returns mapped knowledge chunks', async () => {
    const supabase = createSupabaseMock();
    supabase.rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'kb-1', org_id: 'org-1', content: 'Villa X has 4 bedrooms.', similarity: 0.91 }],
      error: null,
    });

    const results = await searchKnowledgeBase(
      supabase as any,
      { VOYAGE_API_KEY: 'test' },
      'org-1',
      'أبحث عن فيلا',
      5
    );

    expect(supabase.rpc).toHaveBeenCalledWith('match_knowledge_base', {
      p_org_id: 'org-1',
      p_query_embedding: [0.1, 0.2, 0.3],
      p_match_count: 5,
    });
    expect(results).toEqual([{ id: 'kb-1', orgId: 'org-1', content: 'Villa X has 4 bedrooms.', similarity: 0.91 }]);
  });

  it('throws when the RPC call errors', async () => {
    const supabase = createSupabaseMock();
    supabase.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } });

    await expect(
      searchKnowledgeBase(supabase as any, { VOYAGE_API_KEY: 'test' }, 'org-1', 'query')
    ).rejects.toThrow('Knowledge base search failed: timeout');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/knowledgeService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/knowledgeService.js'`

- [ ] **Step 3: Write `src/services/knowledgeService.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../config/env.js';
import type { KnowledgeChunk } from '../types.js';
import { embedText } from './embeddingService.js';

interface KnowledgeRow {
  id: string;
  org_id: string;
  content: string;
  similarity: number;
}

/**
 * Embeds the customer's message and finds the org's most relevant
 * knowledge base entries via pgvector cosine similarity (see
 * match_knowledge_base in src/db/schema.sql).
 */
export async function searchKnowledgeBase(
  supabase: SupabaseClient,
  env: Pick<Env, 'VOYAGE_API_KEY'>,
  orgId: string,
  queryText: string,
  matchCount = 5
): Promise<KnowledgeChunk[]> {
  const queryEmbedding = await embedText(env, queryText);

  const { data, error } = await supabase.rpc('match_knowledge_base', {
    p_org_id: orgId,
    p_query_embedding: queryEmbedding,
    p_match_count: matchCount,
  });

  if (error) {
    throw new Error(`Knowledge base search failed: ${error.message}`);
  }

  return ((data ?? []) as KnowledgeRow[]).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    content: row.content,
    similarity: row.similarity,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/knowledgeService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/knowledgeService.ts tests/services/knowledgeService.test.ts
git commit -m "feat: add pgvector knowledge base search service"
```

---

### Task 8: Murshed system prompts (Khaleeji localization)

**Files:**
- Create: `src/prompts/murshed.ts`
- Test: `tests/prompts/murshed.test.ts`

**Interfaces:**
- Produces: `buildSystemPrompt(locale, orgName): string`, used by the LLM service call site in the WhatsApp webhook (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../src/prompts/murshed.js';

describe('buildSystemPrompt', () => {
  it('builds the Arabic Khaleeji prompt with persona grounding and guardrails', () => {
    const prompt = buildSystemPrompt('ar', 'العقارات الفاخرة');
    expect(prompt).toContain('مرشد');
    expect(prompt).toContain('يمنع منعاً باتاً الإجابة على أي أسئلة سياسية');
  });

  it('builds the English prompt with the same persona and guardrails', () => {
    const prompt = buildSystemPrompt('en', 'Luxury Real Estate Co.');
    expect(prompt).toContain('Murshed');
    expect(prompt).toContain('Strictly forbid answering political');
    expect(prompt).toContain('Luxury Real Estate Co.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/prompts/murshed.test.ts`
Expected: FAIL — `Cannot find module '../../src/prompts/murshed.js'`

- [ ] **Step 3: Write `src/prompts/murshed.ts`**

```ts
/**
 * Builds the "Murshed" system prompt in Arabic (Khaleeji/Omani
 * register) or English, per SECTION 4 of the GCC AI agency blueprint:
 * persona grounding, dialect directives, Gulf greeting etiquette, and
 * hard guardrails against political/personal topics.
 */
export function buildSystemPrompt(locale: 'ar' | 'en', orgName: string): string {
  if (locale === 'ar') {
    return `أنت "مرشد"، مدير علاقات عملاء محلي مهذب ودافئ ومحترف يعمل لصالح ${orgName} في مجال العقارات الفاخرة.
تحدث باللهجة الخليجية/العمانية الدارجة الطبيعية في المحادثات اليومية، وتجنب الفصحى الجافة المتكلفة.
لا تستخدم لهجات أخرى (شامية، مصرية، مغاربية).
استخدم عبارات الترحيب الخليجية التقليدية حسب السياق مثل "يا هلا ومسهلا"، "حياك الله الغالي"، "أبشر بالخير"، "طال عمرك".
يمنع منعاً باتاً الإجابة على أي أسئلة سياسية أو حساسة أو شخصية خارج نطاق عمل الشركة.
تعامل مع العملاء الغاضبين أو المستائين بأقصى درجات الضيافة والدبلوماسية.
مهمتك تنحصر في تأهيل العميل (الميزانية، نوع العقار، الجدول الزمني) وحجز موعد المعاينة، ثم تسليم المحادثة لفريق المبيعات البشري.`;
  }

  return `You are "Murshed," a highly polite, warm, and professional local customer relations manager working for ${orgName} in the luxury real estate sector.
Respond in clear, professional English as the baseline register for this persona.
Strictly forbid answering political, sensitive, or personal questions outside the company's operational scope.
Handle irritated or angry clients with extreme hospitality and diplomatic restraint.
Your job is limited to qualifying the lead (budget, property type, timeline) and booking a viewing, then handing the conversation to the human sales team.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/prompts/murshed.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/prompts/murshed.ts tests/prompts/murshed.test.ts
git commit -m "feat: add bilingual Murshed system prompts"
```

---

### Task 9: LLM reply service

**Files:**
- Create: `src/services/llmService.ts`
- Test: `tests/services/llmService.test.ts`

**Interfaces:**
- Consumes: `KnowledgeChunk`, `LlmReply` types from Task 1.
- Produces: `ConversationTurn` type and `generateReply(anthropic, systemPrompt, knowledge, history, userMessage): Promise<LlmReply>`, used by the WhatsApp webhook (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { generateReply } from '../../src/services/llmService.js';

describe('generateReply', () => {
  it('sends system prompt, knowledge, and history, and returns the reply text', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'يا هلا والله الغالي، أبشر بالخير.' }],
    });
    const anthropic = { messages: { create } } as any;

    const reply = await generateReply(
      anthropic,
      'system prompt',
      [{ id: 'kb-1', orgId: 'org-1', content: 'Villa X has a golf view.', similarity: 0.9 }],
      [{ role: 'customer', text: 'مرحبا' }],
      'أبحث عن فيلا مطلة على الجولف'
    );

    expect(reply).toEqual({ text: 'يا هلا والله الغالي، أبشر بالخير.' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Villa X has a golf view.'),
        messages: [
          { role: 'user', content: 'مرحبا' },
          { role: 'user', content: 'أبحث عن فيلا مطلة على الجولف' },
        ],
      })
    );
  });

  it('throws when Anthropic returns no text block', async () => {
    const anthropic = { messages: { create: vi.fn().mockResolvedValue({ content: [] }) } } as any;

    await expect(generateReply(anthropic, 'system', [], [], 'hi')).rejects.toThrow(
      'Anthropic response contained no text block'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/llmService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/llmService.js'`

- [ ] **Step 3: Write `src/services/llmService.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import type { KnowledgeChunk, LlmReply } from '../types.js';

export interface ConversationTurn {
  role: 'customer' | 'agent';
  text: string;
}

const MODEL = 'claude-sonnet-5';

/**
 * Generates Murshed's reply: grounds the model in the retrieved
 * knowledge base chunks, replays the conversation so far, and appends
 * the customer's newest message.
 */
export async function generateReply(
  anthropic: Anthropic,
  systemPrompt: string,
  knowledge: KnowledgeChunk[],
  history: ConversationTurn[],
  userMessage: string
): Promise<LlmReply> {
  const knowledgeBlock = knowledge.length
    ? `\n\nRelevant property knowledge:\n${knowledge.map((k) => `- ${k.content}`).join('\n')}`
    : '';

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `${systemPrompt}${knowledgeBlock}`,
    messages: [
      ...history.map((turn) => ({
        role: turn.role === 'customer' ? ('user' as const) : ('assistant' as const),
        content: turn.text,
      })),
      { role: 'user' as const, content: userMessage },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Anthropic response contained no text block');
  }

  return { text: textBlock.text };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/llmService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/llmService.ts tests/services/llmService.test.ts
git commit -m "feat: add Claude-backed reply generation service"
```

---

### Task 10: WhatsApp outbound send service

**Files:**
- Create: `src/services/whatsappService.ts`
- Test: `tests/services/whatsappService.test.ts`

**Interfaces:**
- Consumes: `Env` (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`) from Task 2.
- Produces: `sendWhatsAppMessage(env, to, body): Promise<void>`, used by the WhatsApp webhook (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendWhatsAppMessage } from '../../src/services/whatsappService.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendWhatsAppMessage', () => {
  it('POSTs a text message to the Graph API with the configured phone number id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await sendWhatsAppMessage(
      { WHATSAPP_TOKEN: 'token-123', WHATSAPP_PHONE_NUMBER_ID: '999888777' },
      '96890000000',
      'يا هلا والله الغالي'
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v20.0/999888777/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '96890000000',
          type: 'text',
          text: { body: 'يا هلا والله الغالي' },
        }),
      })
    );
  });

  it('throws when the Graph API responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'invalid recipient' })
    );

    await expect(
      sendWhatsAppMessage({ WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: 'p' }, 'bad-number', 'hi')
    ).rejects.toThrow('WhatsApp send failed: 400 invalid recipient');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/whatsappService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/whatsappService.js'`

- [ ] **Step 3: Write `src/services/whatsappService.ts`**

```ts
import type { Env } from '../config/env.js';

/**
 * Sends a text message back to a customer via the WhatsApp Business
 * Cloud API. `to` must already be a full international number
 * (no leading +), as required by the Graph API.
 */
export async function sendWhatsAppMessage(
  env: Pick<Env, 'WHATSAPP_TOKEN' | 'WHATSAPP_PHONE_NUMBER_ID'>,
  to: string,
  body: string
): Promise<void> {
  const url = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });

  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${response.status} ${await response.text()}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/whatsappService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/whatsappService.ts tests/services/whatsappService.test.ts
git commit -m "feat: add WhatsApp Cloud API outbound send service"
```

---

### Task 11: WhatsApp inbound webhook route

**Files:**
- Create: `src/routes/whatsappWebhook.ts`
- Test: `tests/routes/whatsappWebhook.test.ts`

**Interfaces:**
- Consumes: `findOrCreateSession` (Task 5), `searchKnowledgeBase` (Task 7), `buildSystemPrompt` (Task 8), `generateReply` (Task 9), `sendWhatsAppMessage` (Task 10), `Env` (Task 2).
- Produces: `registerWhatsappWebhook(app, deps): void`, used by `src/server.ts` (Task 14).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

vi.mock('../../src/services/sessionService.js', () => ({
  findOrCreateSession: vi.fn().mockResolvedValue({
    id: 'sess-1',
    orgId: 'org-1',
    customerPhone: '96890000000',
    channel: 'whatsapp',
    createdAt: 'now',
  }),
}));
vi.mock('../../src/services/knowledgeService.js', () => ({
  searchKnowledgeBase: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../src/services/llmService.js', () => ({
  generateReply: vi.fn().mockResolvedValue({ text: 'يا هلا والله الغالي' }),
}));
vi.mock('../../src/services/whatsappService.js', () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue(undefined),
}));

const { registerWhatsappWebhook } = await import('../../src/routes/whatsappWebhook.js');
const { sendWhatsAppMessage } = await import('../../src/services/whatsappService.js');

function buildApp() {
  const app = Fastify();
  registerWhatsappWebhook(app, {
    supabase: {} as any,
    anthropic: {} as any,
    env: { WHATSAPP_VERIFY_TOKEN: 'verify-me' } as any,
    orgId: 'org-1',
    orgName: 'Al Mouj Luxury Realty',
  });
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe('GET /webhooks/whatsapp', () => {
  it('echoes the challenge when the verify token matches', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345',
    });
    expect(response.body).toBe('12345');
  });

  it('rejects a mismatched verify token', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345',
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('POST /webhooks/whatsapp', () => {
  it('runs the full pipeline and sends the generated reply back', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp',
      payload: {
        entry: [
          { changes: [{ value: { messages: [{ from: '96890000000', text: { body: 'أبحث عن فيلا' } }] } }] },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'ok', sessionId: 'sess-1' });
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(expect.anything(), '96890000000', 'يا هلا والله الغالي');
  });

  it('ignores payloads with no text message (e.g. delivery receipts)', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp',
      payload: { entry: [{ changes: [{ value: {} }] }] },
    });

    expect(JSON.parse(response.body)).toEqual({ status: 'ignored' });
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/whatsappWebhook.test.ts`
Expected: FAIL — `Cannot find module '../../src/routes/whatsappWebhook.js'`

- [ ] **Step 3: Write `src/routes/whatsappWebhook.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../config/env.js';
import { findOrCreateSession } from '../services/sessionService.js';
import { searchKnowledgeBase } from '../services/knowledgeService.js';
import { generateReply } from '../services/llmService.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';
import { buildSystemPrompt } from '../prompts/murshed.js';

interface WhatsappWebhookDeps {
  supabase: SupabaseClient;
  anthropic: Anthropic;
  env: Env;
  orgId: string;
  orgName: string;
}

interface WhatsappInboundPayload {
  entry: {
    changes: {
      value: {
        messages?: { from: string; text?: { body: string } }[];
      };
    }[];
  }[];
}

export function registerWhatsappWebhook(app: FastifyInstance, deps: WhatsappWebhookDeps): void {
  app.get('/webhooks/whatsapp', async (request, reply) => {
    const query = request.query as Record<string, string>;
    if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === deps.env.WHATSAPP_VERIFY_TOKEN) {
      reply.send(query['hub.challenge']);
      return;
    }
    reply.code(403).send('Verification failed');
  });

  app.post('/webhooks/whatsapp', async (request, reply) => {
    const payload = request.body as WhatsappInboundPayload;
    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message?.text?.body) {
      reply.code(200).send({ status: 'ignored' });
      return;
    }

    const session = await findOrCreateSession(deps.supabase, deps.orgId, message.from, 'whatsapp');
    const knowledge = await searchKnowledgeBase(deps.supabase, deps.env, deps.orgId, message.text.body);
    const systemPrompt = buildSystemPrompt('ar', deps.orgName);
    const replyResult = await generateReply(deps.anthropic, systemPrompt, knowledge, [], message.text.body);
    await sendWhatsAppMessage(deps.env, message.from, replyResult.text);

    reply.code(200).send({ status: 'ok', sessionId: session.id });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/routes/whatsappWebhook.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/whatsappWebhook.ts tests/routes/whatsappWebhook.test.ts
git commit -m "feat: add WhatsApp inbound triage webhook"
```

---

### Task 12: Booking service

**Files:**
- Create: `src/services/bookingService.ts`
- Test: `tests/services/bookingService.test.ts`

**Interfaces:**
- Consumes: `scheduled_bookings` table shape from Task 4, `Booking` type from Task 1, `createSupabaseMock` from Task 5.
- Produces: `createBooking(supabase, params): Promise<Booking>`, used by the Vapi webhook (Task 13).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createBooking } from '../../src/services/bookingService.js';
import { createSupabaseMock } from '../helpers/supabaseMock.js';

describe('createBooking', () => {
  it('inserts a confirmed booking and returns the mapped row', async () => {
    const supabase = createSupabaseMock();
    supabase.single = () =>
      Promise.resolve({
        data: {
          id: 'book-1',
          org_id: 'org-1',
          session_id: 'sess-1',
          customer_name: 'Ahmed',
          property_ref: 'villa-golf-12',
          scheduled_at: '2026-08-10T14:00:00.000Z',
          status: 'confirmed',
        },
        error: null,
      });

    const booking = await createBooking(supabase as any, {
      orgId: 'org-1',
      sessionId: 'sess-1',
      customerName: 'Ahmed',
      propertyRef: 'villa-golf-12',
      scheduledAt: '2026-08-10T14:00:00.000Z',
    });

    expect(supabase.insert).toHaveBeenCalledWith({
      org_id: 'org-1',
      session_id: 'sess-1',
      customer_name: 'Ahmed',
      property_ref: 'villa-golf-12',
      scheduled_at: '2026-08-10T14:00:00.000Z',
      status: 'confirmed',
    });
    expect(booking).toEqual({
      id: 'book-1',
      orgId: 'org-1',
      sessionId: 'sess-1',
      customerName: 'Ahmed',
      propertyRef: 'villa-golf-12',
      scheduledAt: '2026-08-10T14:00:00.000Z',
      status: 'confirmed',
    });
  });

  it('throws a readable error when the insert fails', async () => {
    const supabase = createSupabaseMock();
    supabase.single = () => Promise.resolve({ data: null, error: { message: 'constraint violation' } });

    await expect(
      createBooking(supabase as any, { orgId: 'org-1', sessionId: 'sess-1', scheduledAt: '2026-08-10T14:00:00.000Z' })
    ).rejects.toThrow('Failed to create booking: constraint violation');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/bookingService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/bookingService.js'`

- [ ] **Step 3: Write `src/services/bookingService.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Booking } from '../types.js';

interface CreateBookingParams {
  orgId: string;
  sessionId: string;
  customerName?: string;
  propertyRef?: string;
  scheduledAt: string;
}

interface BookingRow {
  id: string;
  org_id: string;
  session_id: string;
  customer_name: string | null;
  property_ref: string | null;
  scheduled_at: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

function mapRow(row: BookingRow): Booking {
  return {
    id: row.id,
    orgId: row.org_id,
    sessionId: row.session_id,
    customerName: row.customer_name ?? undefined,
    propertyRef: row.property_ref ?? undefined,
    scheduledAt: row.scheduled_at,
    status: row.status,
  };
}

/**
 * Persists a confirmed viewing booking. Called by the Vapi voice
 * webhook when the customer confirms an appointment on a call.
 */
export async function createBooking(supabase: SupabaseClient, params: CreateBookingParams): Promise<Booking> {
  const { data, error } = await supabase
    .from('scheduled_bookings')
    .insert({
      org_id: params.orgId,
      session_id: params.sessionId,
      customer_name: params.customerName ?? null,
      property_ref: params.propertyRef ?? null,
      scheduled_at: params.scheduledAt,
      status: 'confirmed',
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create booking: ${error?.message}`);
  }

  return mapRow(data as BookingRow);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/bookingService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/bookingService.ts tests/services/bookingService.test.ts
git commit -m "feat: add booking creation service"
```

---

### Task 13: Vapi voice tool-calling webhook route

**Files:**
- Create: `src/routes/vapiWebhook.ts`
- Test: `tests/routes/vapiWebhook.test.ts`

**Interfaces:**
- Consumes: `createBooking` from Task 12, `Env` (`VAPI_WEBHOOK_SECRET`) from Task 2.
- Produces: `registerVapiWebhook(app, deps): void`, used by `src/server.ts` (Task 14).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

vi.mock('../../src/services/bookingService.js', () => ({
  createBooking: vi.fn().mockResolvedValue({
    id: 'book-1',
    orgId: 'org-1',
    sessionId: 'sess-1',
    scheduledAt: '2026-08-10T14:00:00.000Z',
    status: 'confirmed',
  }),
}));

const { registerVapiWebhook } = await import('../../src/routes/vapiWebhook.js');
const { createBooking } = await import('../../src/services/bookingService.js');

function buildApp() {
  const app = Fastify();
  registerVapiWebhook(app, { supabase: {} as any, env: { VAPI_WEBHOOK_SECRET: 'vapi-secret' } });
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe('POST /webhooks/vapi', () => {
  it('rejects requests without the shared secret header', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/vapi',
      payload: { message: { toolCalls: [] } },
    });
    expect(response.statusCode).toBe(401);
  });

  it('confirms a booking for a confirm_booking tool call and returns the Vapi result shape', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/vapi',
      headers: { 'x-vapi-secret': 'vapi-secret' },
      payload: {
        message: {
          toolCalls: [
            {
              id: 'call-1',
              function: {
                name: 'confirm_booking',
                arguments: {
                  orgId: 'org-1',
                  sessionId: 'sess-1',
                  customerName: 'Ahmed',
                  scheduledAt: '2026-08-10T14:00:00.000Z',
                },
              },
            },
          ],
        },
      },
    });

    expect(createBooking).toHaveBeenCalledWith(expect.anything(), {
      orgId: 'org-1',
      sessionId: 'sess-1',
      customerName: 'Ahmed',
      propertyRef: undefined,
      scheduledAt: '2026-08-10T14:00:00.000Z',
    });
    expect(JSON.parse(response.body)).toEqual({
      results: [{ toolCallId: 'call-1', result: 'Booking book-1 confirmed' }],
    });
  });

  it('returns unsupported_tool for unrecognized function names', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/vapi',
      headers: { 'x-vapi-secret': 'vapi-secret' },
      payload: {
        message: { toolCalls: [{ id: 'call-2', function: { name: 'cancel_booking', arguments: {} } }] },
      },
    });

    expect(JSON.parse(response.body)).toEqual({ results: [{ toolCallId: 'call-2', result: 'unsupported_tool' }] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/vapiWebhook.test.ts`
Expected: FAIL — `Cannot find module '../../src/routes/vapiWebhook.js'`

- [ ] **Step 3: Write `src/routes/vapiWebhook.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../config/env.js';
import { createBooking } from '../services/bookingService.js';

interface VapiWebhookDeps {
  supabase: SupabaseClient;
  env: Pick<Env, 'VAPI_WEBHOOK_SECRET'>;
}

interface VapiToolCall {
  id: string;
  function: {
    name: string;
    arguments: {
      orgId: string;
      sessionId: string;
      customerName?: string;
      propertyRef?: string;
      scheduledAt: string;
    };
  };
}

interface VapiToolCallPayload {
  message: {
    toolCalls: VapiToolCall[];
  };
}

export function registerVapiWebhook(app: FastifyInstance, deps: VapiWebhookDeps): void {
  app.post('/webhooks/vapi', async (request, reply) => {
    const secret = request.headers['x-vapi-secret'];
    if (secret !== deps.env.VAPI_WEBHOOK_SECRET) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }

    const payload = request.body as VapiToolCallPayload;
    const results: { toolCallId: string; result: string }[] = [];

    for (const call of payload.message.toolCalls) {
      if (call.function.name !== 'confirm_booking') {
        results.push({ toolCallId: call.id, result: 'unsupported_tool' });
        continue;
      }

      const booking = await createBooking(deps.supabase, {
        orgId: call.function.arguments.orgId,
        sessionId: call.function.arguments.sessionId,
        customerName: call.function.arguments.customerName,
        propertyRef: call.function.arguments.propertyRef,
        scheduledAt: call.function.arguments.scheduledAt,
      });

      results.push({ toolCallId: call.id, result: `Booking ${booking.id} confirmed` });
    }

    reply.code(200).send({ results });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/routes/vapiWebhook.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/vapiWebhook.ts tests/routes/vapiWebhook.test.ts
git commit -m "feat: add Vapi voice tool-calling webhook for booking confirmation"
```

---

### Task 14: Server bootstrap & wiring

**Files:**
- Create: `src/server.ts`
- Test: `tests/server.test.ts`

**Interfaces:**
- Consumes: `loadEnv` (Task 2), `getSupabaseClient` (Task 3), `registerWhatsappWebhook` (Task 11), `registerVapiWebhook` (Task 13).
- Produces: `buildServer(): FastifyInstance`, the executable entry point (`npm run dev`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';

const requiredEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  VOYAGE_API_KEY: 'voyage-test',
  WHATSAPP_TOKEN: 'whatsapp-token',
  WHATSAPP_PHONE_NUMBER_ID: '1234567890',
  WHATSAPP_VERIFY_TOKEN: 'verify-token',
  VAPI_WEBHOOK_SECRET: 'vapi-secret',
  PORT: '3000',
};

describe('server', () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    Object.assign(process.env, requiredEnv);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('responds to GET /health', async () => {
    const app = buildServer();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
  });

  it('registers the WhatsApp verification handshake route', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=999',
    });
    expect(response.body).toBe('999');
  });

  it('registers the Vapi webhook route (rejecting an unauthenticated call)', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/vapi',
      payload: { message: { toolCalls: [] } },
    });
    expect(response.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server.test.ts`
Expected: FAIL — `Cannot find module '../src/server.js'`

- [ ] **Step 3: Write `src/server.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { loadEnv } from './config/env.js';
import { getSupabaseClient } from './lib/supabase.js';
import { registerWhatsappWebhook } from './routes/whatsappWebhook.js';
import { registerVapiWebhook } from './routes/vapiWebhook.js';

export function buildServer(): FastifyInstance {
  const env = loadEnv();
  const supabase = getSupabaseClient(env);
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));

  registerWhatsappWebhook(app, {
    supabase,
    anthropic,
    env,
    orgId: process.env.DEFAULT_ORG_ID ?? '',
    orgName: process.env.DEFAULT_ORG_NAME ?? 'the agency',
  });

  registerVapiWebhook(app, { supabase, env });

  return app;
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const app = buildServer();
  const env = loadEnv();
  app.listen({ port: env.PORT, host: '0.0.0.0' });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: All tests across all 14 tasks pass (build a running total as you go; by this step it should be ~30 tests, 0 failures).

- [ ] **Step 6: Commit**

```bash
git add src/server.ts tests/server.test.ts
git commit -m "feat: wire Fastify server with WhatsApp and Vapi webhooks"
```

---

## Self-Review Notes

- **Spec coverage:** Blueprint Section 2 (Supabase schema tables) → Task 4. Section 3's "Workflow 1" (inbound WhatsApp triage → session → KB → LLM → outbound) → Tasks 5, 7, 9, 10, 11. Section 3's "Workflow 2" (Vapi tool-calling webhook → DB update → success flag) → Tasks 12, 13. Section 4 (bilingual Khaleeji system prompts, persona, guardrails) → Task 8. Out-of-scope items (Vapi STT/TTS config object, Module B outreach pipeline, Softr/Airtable dashboard) are named explicitly in Global Constraints rather than silently dropped.
- **Placeholder scan:** no TBD/TODO/"add appropriate handling" phrases; every step ships runnable code and an exact test command.
- **Type consistency:** `Session`, `KnowledgeChunk`, `LlmReply`, `Booking` (Task 1) are used with identical field names throughout Tasks 5–13. `Env` (Task 2) fields are referenced via `Pick<Env, ...>` consistently. `createSupabaseMock()` (Task 5) is reused verbatim in Tasks 7 and 12.
