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
