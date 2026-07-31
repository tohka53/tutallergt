export type DeliveryChannel = 'email' | 'whatsapp';
export type DeliveryResult = 'simulated' | 'opened-client' | 'shared' | 'failed';

export interface DeliveryLog {
  id: string;
  quotationId: string;
  quotationNumber: string;
  channel: DeliveryChannel;
  recipient: string;
  result: DeliveryResult;
  message: string;
  createdAt: string; // ISO
  userId: string;
  userName: string;
}
