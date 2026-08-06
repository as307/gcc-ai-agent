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
