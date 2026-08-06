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

  it('adds org_id column to chat_messages for direct tenant scoping', () => {
    expect(schema).toMatch(/create table chat_messages[\s\S]*org_id uuid/);
  });

  it('defines the check_session_org_match trigger function', () => {
    expect(schema).toMatch(/create or replace function check_session_org_match/);
  });

  it('attaches triggers to enforce org_id matching on child tables', () => {
    expect(schema).toMatch(/create trigger/);
  });
});
