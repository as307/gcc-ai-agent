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
