import type { SupabaseClient } from '@supabase/supabase-js';

interface LogMessageParams {
  orgId: string;
  sessionId: string;
  role: 'customer' | 'agent';
  body: string;
}

/**
 * Persists one turn of a conversation to chat_messages, so later replies
 * can be grounded in what was actually said and so the conversation has
 * an audit trail. Called once for the inbound customer message and once
 * for Murshed's outbound reply.
 */
export async function logMessage(supabase: SupabaseClient, params: LogMessageParams): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .insert({
      org_id: params.orgId,
      session_id: params.sessionId,
      role: params.role,
      body: params.body,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to log message: ${error.message}`);
  }
}
