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
