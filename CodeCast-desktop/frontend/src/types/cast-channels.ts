export type ChannelType = 'webhook' | 'email' | 'custom' | 'console' | 'notification';
export type ChannelStatus = 'active' | 'inactive' | 'error' | 'pending_verification';

export interface WebhookChannelConfig {
  type: 'webhook';
  name: string;
  url: string;
  method: 'POST' | 'GET';
  headers?: Record<string, string>;
  secret?: string;
  contentType: 'json' | 'form';
  retryCount: number;
  timeout: number;
  enabledEvents: string[];
}

export interface EmailChannelConfig {
  type: 'email';
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  useTLS: boolean;
  fromAddress: string;
  toAddresses: string[];
  subjectPrefix: string;
  enabledEvents: string[];
}

export interface CustomChannelConfig {
  type: 'custom';
  name: string;
  handler: string;
  config: Record<string, unknown>;
}

export type ChannelConfig = WebhookChannelConfig | EmailChannelConfig | CustomChannelConfig;

export interface CastMessage {
  id: string;
  channelType: ChannelType;
  channelId: string;
  direction: 'inbound' | 'outbound';
  payload: unknown;
  eventType: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  error?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface CastEvent {
  id: string;
  type: string;
  source: string;
  data: unknown;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timestamp: number;
  processed: boolean;
  channelsDelivered: string[];
}

export interface ChannelDeliveryLog {
  id: string;
  messageId: string;
  channelId: string;
  status: 'success' | 'failed' | 'timeout';
  responseTime: number;
  responseBody?: string;
  errorCode?: string;
  timestamp: number;
}
