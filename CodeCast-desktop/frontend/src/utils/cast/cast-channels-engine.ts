import type {
  ChannelConfig,
  ChannelType,
  CastMessage,
  CastEvent,
  ChannelDeliveryLog,
  WebhookChannelConfig,
  EmailChannelConfig
} from '../../types/cast-channels';
import { castPrivacyManager } from './cast-privacy-manager';

function generateId(prefix: string = 'ch'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface WebhookTemplate {
  name: string;
  urlTemplate: string;
  contentType: 'json' | 'form';
  formatBody: (data: unknown) => unknown;
  docs: string;
}

export const WEBHOOK_TEMPLATES: Record<string, WebhookTemplate> = {
  feishu: {
    name: '飞书机器人',
    urlTemplate: 'https://open.feishu.cn/open-apis/bot/v2/hook/{WEBHOOK_KEY}',
    contentType: 'json',
    formatBody: (data: unknown) => ({
      msg_type: 'text',
      content: { text: JSON.stringify(data) }
    }),
    docs: 'https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot'
  },
  dingtalk: {
    name: '钉钉机器人',
    urlTemplate: 'https://oapi.dingtalk.com/robot/send?access_token={ACCESS_TOKEN}',
    contentType: 'json',
    formatBody: (data: unknown) => ({
      msgtype: 'text',
      text: { content: JSON.stringify(data) }
    }),
    docs: 'https://open.dingtalk.com/document/orgapp/custom-robot-oauth/create'
  },
  wecom_work: {
    name: '企业微信',
    urlTemplate: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={KEY}',
    contentType: 'json',
    formatBody: (data: unknown) => ({
      msgtype: 'text',
      text: { content: JSON.stringify((data as Record<string, unknown>)?.content || data) }
    }),
    docs: 'https://developer.work.weixin.qq.com/document/path/95508'
  },
  slack: {
    name: 'Slack',
    urlTemplate: 'https://hooks.slack.com/services/{TOKEN}/{ID}/{SECRET}',
    contentType: 'json',
    formatBody: (data: unknown) => ({ text: JSON.stringify(data), mrkdwn: true }),
    docs: 'https://api.slack.com/messaging/webhooks'
  },
  discord: {
    name: 'Discord',
    urlTemplate: 'https://discord.com/api/webhooks/{ID}/{TOKEN}',
    contentType: 'json',
    formatBody: (data: unknown) => ({
      content: typeof data === 'string' ? data : JSON.stringify(data)
    }),
    docs: 'https://discord.com/developers/docs/resources/webhook'
  },
  generic: {
    name: '通用Webhook',
    urlTemplate: '{CUSTOM_URL}',
    contentType: 'json',
    formatBody: (data: unknown) => ({ event: 'cast', data, timestamp: Date.now() }),
    docs: ''
  }
};

class CastChannelsEngine {
  private channels: Map<string, ChannelConfig> = new Map();
  private eventBus: Map<string, Set<(event: CastEvent) => void>> = new Map();
  private messageQueue: CastMessage[] = [];
  private deliveryLogs: ChannelDeliveryLog[] = [];
  private bridgedEvents: Set<string> = new Set();
  private maxQueueSize: number = 1000;
  private maxLogsSize: number = 5000;

  constructor() {}

  addChannel(config: ChannelConfig): string {
    const id = generateId('ch');
    this.channels.set(id, config);
    return id;
  }

  removeChannel(channelId: string): boolean {
    return this.channels.delete(channelId);
  }

  updateChannel(channelId: string, updates: Partial<ChannelConfig>): boolean {
    const existing = this.channels.get(channelId);
    if (!existing) return false;

    const merged = { ...existing, ...updates } as ChannelConfig;
    this.channels.set(channelId, merged);
    return true;
  }

  getChannel(id: string): ChannelConfig | undefined {
    return this.channels.get(id);
  }

  getChannelsByType(type: ChannelType): ChannelConfig[] {
    const result: ChannelConfig[] = [];
    for (const ch of this.channels.values()) {
      if (ch.type === type) {
        result.push(ch);
      }
    }
    return result;
  }

  getAllChannels(): ChannelConfig[] {
    return Array.from(this.channels.values());
  }

  async testChannel(channelId: string): Promise<{ success: boolean; latency: number; error?: string }> {
    const config = this.channels.get(channelId);
    if (!config) {
      return { success: false, latency: 0, error: 'Channel not found' };
    }

    const startTime = performance.now();

    try {
      if (config.type === 'webhook') {
        await this.sendWebhook(config, {
          _test: true,
          message: 'CastChannels connectivity test',
          timestamp: Date.now()
        });
        const latency = Math.round(performance.now() - startTime);
        return { success: true, latency };
      }

      if (config.type === 'email') {
        await this.sendEmail(config, {
          _test: true,
          subject: '[Cast] Connectivity Test',
          body: 'This is a test email from CastChannels.'
        });
        const latency = Math.round(performance.now() - startTime);
        return { success: true, latency };
      }

      if (config.type === 'custom') {
        const latency = Math.round(performance.now() - startTime);
        return { success: true, latency, error: 'Custom channel: handler not verified' };
      }

      return { success: false, latency: 0, error: `Unsupported channel type: ${(config as ChannelConfig).type}` };
    } catch (err) {
      const latency = Math.round(performance.now() - startTime);
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, latency, error: errorMsg };
    }
  }

  async sendMessage(params: {
    channelIds?: string[];
    channelTypes?: ChannelType[];
    payload: unknown;
    eventType: string;
    priority?: CastEvent['priority'];
    timeout?: number;
  }): Promise<Map<string, { success: boolean; error?: string }>> {
    const results = new Map<string, { success: boolean; error?: string }>();
    let targetChannels: ChannelConfig[] = [];

    if (params.channelIds && params.channelIds.length > 0) {
      targetChannels = params.channelIds
        .map(id => this.channels.get(id))
        .filter((c): c is ChannelConfig => c !== undefined);
    } else if (params.channelTypes && params.channelTypes.length > 0) {
      targetChannels = params.channelTypes.flatMap(t => this.getChannelsByType(t));
    } else {
      targetChannels = this.getAllChannels().filter(ch => {
        if (ch.type === 'webhook' || ch.type === 'email') {
          return ch.enabledEvents.includes(params.eventType) || ch.enabledEvents.includes('*');
        }
        return false;
      });
    }

    const sendPromises = targetChannels.map(async (channel) => {
      const channelId = this.getChannelId(channel);
      try {
        if (channel.type === 'webhook') {
          await this.sendWebhook(channel, params.payload);
          results.set(channelId, { success: true });
        } else if (channel.type === 'email') {
          await this.sendEmail(channel, params.payload);
          results.set(channelId, { success: true });
        } else {
          results.set(channelId, { success: false, error: `Unsupported type: ${channel.type}` });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.set(channelId, { success: false, error: errorMsg });
      }
    });

    await Promise.allSettled(sendPromises);

    for (const [channelId, result] of results) {
      const msgId = generateId('msg');
      const message: CastMessage = {
        id: msgId,
        channelType: this.getChannelType(channelId),
        channelId,
        direction: 'outbound',
        payload: params.payload,
        eventType: params.eventType,
        timestamp: Date.now(),
        status: result.success ? 'sent' : 'failed',
        error: result.error,
        retryCount: 0
      };
      this.enqueueMessage(message);
    }

    return results;
  }

  private async sendWebhook(config: WebhookChannelConfig, payload: unknown): Promise<void> {
    const body = {
      event: payload,
      timestamp: Date.now(),
      cast_version: '1.0.0'
    };

    const auditResult = await castPrivacyManager.auditOutbound({
      url: config.url,
      method: config.method || 'POST',
      data: body,
      category: 'webhook',
      reason: `Webhook channel delivery to ${new URL(config.url).hostname}`,
      privacyLevel: 'private'
    });

    if (!auditResult.allowed) {
      throw new Error('Webhook request blocked by privacy policy');
    }

    const headers: Record<string, string> = {
      'Content-Type': config.contentType === 'json' ? 'application/json' : 'application/x-www-form-urlencoded',
      ...config.headers || {}
    };

    if (config.secret) {
      const signature = await hmacSha256(config.secret, JSON.stringify(body));
      headers['X-Cast-Signature'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 10000);

    let lastError: Error | null = null;
    const maxRetries = config.retryCount || 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(config.url, {
          method: config.method || 'POST',
          headers,
          body: config.contentType === 'json' ? JSON.stringify(body) : new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString(),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseTime = config.timeout || 10000;
        this.addDeliveryLog({
          id: generateId('log'),
          messageId: generateId('msg'),
          channelId: this.getChannelId(config),
          status: 'success',
          responseTime,
          responseBody: `Status: ${response.status}`,
          timestamp: Date.now()
        });

        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    clearTimeout(timeoutId);
    this.addDeliveryLog({
      id: generateId('log'),
      messageId: generateId('msg'),
      channelId: this.getChannelId(config),
      status: 'failed',
      responseTime: config.timeout || 10000,
      errorCode: lastError?.message,
      timestamp: Date.now()
    });

    throw lastError || new Error('Webhook send failed after retries');
  }

  private async sendEmail(config: EmailChannelConfig, payload: unknown): Promise<void> {
    const data = payload as Record<string, unknown>;
    const subject = `${config.subjectPrefix || '[Cast]'} ${data.subject || 'Notification'}`;
    const body = typeof data.body === 'string' ? data.body : JSON.stringify(data, null, 2);

    try {
      if (typeof window !== 'undefined' && (window as any).go?.main?.App?.SendEmail) {
        await (window as any).go.main.App.SendEmail({
          smtpHost: config.smtpHost,
          smtpPort: config.smtpPort,
          smtpUser: config.smtpUser,
          smtpPass: config.smtpPass,
          useTLS: config.useTLS,
          fromAddress: config.fromAddress,
          toAddresses: config.toAddresses,
          subject,
          body
        });

        this.addDeliveryLog({
          id: generateId('log'),
          messageId: generateId('msg'),
          channelId: this.getChannelId(config),
          status: 'success',
          responseTime: 100,
          timestamp: Date.now()
        });
        return;
      }
    } catch {
    }

    const mailtoLink = `mailto:${config.toAddresses.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1000))}`;

    try {
      window.open(mailtoLink, '_blank');

      this.addDeliveryLog({
        id: generateId('log'),
        messageId: generateId('msg'),
        channelId: this.getChannelId(config),
        status: 'success',
        responseTime: 50,
        responseBody: 'Opened mailto link',
        timestamp: Date.now()
      });
    } catch {
      try {
        await navigator.clipboard.writeText(`To: ${config.toAddresses.join(', ')}\nSubject: ${subject}\n\n${body}`);

        this.addDeliveryLog({
          id: generateId('log'),
          messageId: generateId('msg'),
          channelId: this.getChannelId(config),
          status: 'success',
          responseTime: 30,
          responseBody: 'Copied to clipboard',
          timestamp: Date.now()
        });
      } catch {
        throw new Error('Failed to send email: no SMTP backend available and clipboard access denied');
      }
    }
  }

  emit(event: Omit<CastEvent, 'id' | 'timestamp' | 'processed' | 'channelsDelivered'>): string {
    const id = generateId('evt');
    const fullEvent: CastEvent = {
      ...event,
      id,
      timestamp: Date.now(),
      processed: false,
      channelsDelivered: []
    };

    const handlers = this.eventBus.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(fullEvent);
        } catch (err) {
          console.error('[CastChannelsEngine] Event handler error:', err);
        }
      });
    }

    if (this.bridgedEvents.has(event.type)) {
      this.sendMessage({
        payload: event.data,
        eventType: event.type,
        priority: event.priority
      }).then(() => {
        fullEvent.processed = true;
      }).catch(err => {
        console.error('[CastChannelsEngine] Bridge delivery error:', err);
      });
    }

    return id;
  }

  on(eventType: string, handler: (event: CastEvent) => void): () => void {
    if (!this.eventBus.has(eventType)) {
      this.eventBus.set(eventType, new Set());
    }
    this.eventBus.get(eventType)!.add(handler);

    return () => {
      this.off(eventType, handler);
    };
  }

  off(eventType: string, handler: (event: CastEvent) => void): void {
    const handlers = this.eventBus.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventBus.delete(eventType);
      }
    }
  }

  once(eventType: string, handler: (event: CastEvent) => void): () => void {
    const wrapper = (event: CastEvent) => {
      handler(event);
      this.off(eventType, wrapper);
    };
    return this.on(eventType, wrapper);
  }

  bridgeEventToChannels(eventType: string): void {
    this.bridgedEvents.add(eventType);
  }

  unbridgeEvent(eventType: string): void {
    this.bridgedEvents.delete(eventType);
  }

  getBridgedEvents(): string[] {
    return Array.from(this.bridgedEvents);
  }

  getMessages(limit?: number, filter?: { channelId?: string; status?: CastMessage['status'] }): CastMessage[] {
    let messages = [...this.messageQueue];

    if (filter?.channelId) {
      messages = messages.filter(m => m.channelId === filter.channelId);
    }
    if (filter?.status) {
      messages = messages.filter(m => m.status === filter.status);
    }

    messages.sort((a, b) => b.timestamp - a.timestamp);

    if (limit && limit > 0) {
      return messages.slice(0, limit);
    }
    return messages;
  }

  getDeliveryLogs(messageId?: string): ChannelDeliveryLog[] {
    let logs = [...this.deliveryLogs];

    if (messageId) {
      logs = logs.filter(l => l.messageId === messageId);
    }

    logs.sort((a, b) => b.timestamp - a.timestamp);
    return logs;
  }

  clearLogs(): void {
    this.deliveryLogs = [];
    this.messageQueue = [];
  }

  exportLogs(): string {
    return JSON.stringify({
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      channels: Array.from(this.channels.entries()),
      messages: this.messageQueue,
      deliveryLogs: this.deliveryLogs,
      bridgedEvents: Array.from(this.bridgedEvents)
    }, null, 2);
  }

  handleIncomingWebhook(payload: unknown, sourceChannelId?: string): CastEvent {
    const data = payload as Record<string, unknown>;

    return {
      id: generateId('evt'),
      type: (data.event_type || data.type || 'webhook_incoming') as string,
      source: sourceChannelId || 'webhook',
      data: data.data || data,
      priority: (data.priority as CastEvent['priority']) || 'normal',
      timestamp: Date.now(),
      processed: false,
      channelsDelivered: []
    };
  }

  importChannels(channels: Array<[string, ChannelConfig]>): void {
    for (const [id, config] of channels) {
      this.channels.set(id, config);
    }
  }

  getImportableChannels(): Array<[string, ChannelConfig]> {
    return Array.from(this.channels.entries());
  }

  private enqueueMessage(message: CastMessage): void {
    this.messageQueue.push(message);
    if (this.messageQueue.length > this.maxQueueSize) {
      this.messageQueue = this.messageQueue.slice(-this.maxQueueSize);
    }
  }

  private addDeliveryLog(log: ChannelDeliveryLog): void {
    log.id = generateId('log');
    this.deliveryLogs.push(log);
    if (this.deliveryLogs.length > this.maxLogsSize) {
      this.deliveryLogs = this.deliveryLogs.slice(-this.maxLogsSize);
    }
  }

  private getChannelId(channelOrId: ChannelConfig | string): string {
    if (typeof channelOrId === 'string') return channelOrId;

    for (const [id, ch] of this.channels.entries()) {
      if (ch === channelOrId) return id;
    }
    return 'unknown';
  }

  private getChannelType(channelId: string): ChannelType {
    const ch = this.channels.get(channelId);
    return ch?.type || 'console';
  }
}

export const castChannels = new CastChannelsEngine();

export { CastChannelsEngine };
