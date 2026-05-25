export interface GoProject {
  id: string;
  path: string;
  name: string;
  created_at?: number;
  last_accessed_at?: number;
  custom_instructions?: string;
}

export interface GoSession {
  ID: string;
  Name: string;
  CreatedAt: string;
  SkillID: string;
  Mode: string;
  Messages: GoMessage[];
}

export interface GoMessage {
  role: string;
  content: string;
  reasoning?: string;
}

/** Convert GoMessage from backend to frontend Message with stable ID */
export function toMessage(gm: GoMessage): import('../store/types').Message {
  return {
    id: crypto.randomUUID(),
    role: gm.role as 'user' | 'assistant',
    content: gm.content,
    reasoning: gm.reasoning,
    timestamp: Date.now(),
  };
}

/** Convert GoSession to frontend Session (adds IDs to messages) */
export function toSession(gs: GoSession): import('../store/types').Session {
  return {
    ID: gs.ID,
    Name: gs.Name,
    CreatedAt: gs.CreatedAt,
    SkillID: gs.SkillID,
    Mode: (gs.Mode as 'coding' | 'daily' | '') || '',
    Messages: (gs.Messages || []).map(toMessage),
  };
}

export interface GoSkill {
  id: string;
  name: string;
  description: string;
  prompt: string;
  type: string;
  createdAt: number;
}

export interface GoTask {
  id: string;
  name: string;
  description: string;
  command: string;
  schedule: string;
  enabled: boolean;
  lastRun: number;
  nextRun: number;
  status: string;
  lastError: string;
}

export interface GoMCPServer {
  id: string;
  name: string;
  url: string;
  command: string;
  args: string[];
  type: string;
  enabled: boolean;
  builtin: boolean;
}

export interface GoEnvVar {
  key: string;
  value: string;
}

export interface GoSlashCommand {
  id: string;
  name: string;
  description: string;
  fill_text: string;
}

export interface GoEditorInfo {
  ID: string;
  Name: string;
  Command: string;
}

export interface GoFileEntry {
  Name: string;
  Path: string;
  IsDir: boolean;
  Size: number;
  ModTime: string;
}

export interface GoSettings {
  theme?: string;
  font_size?: 'small' | 'medium' | 'large';
  api_key?: string;
  preferred_editor?: string;
  blocked_domains?: string[];
  allowed_domains?: string[];
  always_on_top?: boolean;
  [key: string]: string | string[] | boolean | undefined;
}
