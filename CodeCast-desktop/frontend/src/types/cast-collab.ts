export type CollaborationRole = 'owner' | 'editor' | 'viewer' | 'commenter';
export type SyncStatus = 'synced' | 'syncing' | 'conflict' | 'offline' | 'error';
export type ChangeType = 'create' | 'update' | 'delete' | 'move' | 'merge';

export const COLLABORATION_ROLES: { key: CollaborationRole; label: string; color: string; permissions: string[] }[] = [
  {
    key: 'owner',
    label: '所有者',
    color: '#f59e0b',
    permissions: ['read', 'write', 'delete', 'invite', 'manage_settings', 'manage_members']
  },
  {
    key: 'editor',
    label: '编辑者',
    color: '#3b82f6',
    permissions: ['read', 'write', 'invite']
  },
  {
    key: 'commenter',
    label: '评论者',
    color: '#10b981',
    permissions: ['read', 'comment']
  },
  {
    key: 'viewer',
    label: '查看者',
    color: '#9ca3af',
    permissions: ['read']
  }
];

export const ROLE_PERMISSIONS: Record<CollaborationRole, string[]> = {
  owner: ['read', 'write', 'delete', 'invite', 'manage_settings', 'manage_members'],
  editor: ['read', 'write', 'invite'],
  commenter: ['read', 'comment'],
  viewer: ['read']
};

export interface CollabUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role: CollaborationRole;
  color: string;
  online: boolean;
  lastActiveAt: number;
  permissions: string[];
}

export interface CollaborativeDocument {
  id: string;
  type: 'note' | 'schedule' | 'memory' | 'email_draft' | 'document';
  title: string;
  content: string;
  ownerId: string;
  collaborators: CollabUser[];
  version: number;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
  status: SyncStatus;
  lock?: {
    userId: string;
    acquiredAt: number;
    expiresAt: number;
  };
  conflictResolution?: 'last-write-wins' | 'manual' | 'merge';
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface SyncChange {
  id: string;
  documentId: string;
  type: ChangeType;
  userId: string;
  timestamp: number;
  data: {
    path?: string;
    value?: unknown;
    oldValue?: unknown;
    content?: string;
  };
  applied: boolean;
  conflictWith?: string;
}

export interface SyncSession {
  id: string;
  documentId: string;
  participants: string[];
  startedAt: number;
  lastActivityAt: number;
  changes: SyncChange[];
  version: number;
}

export interface CollabWorkspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: CollabUser[];
  documents: CollaborativeDocument[];
  sharedMemory: boolean;
  sharedKnowledge: boolean;
  sharedSchedule: boolean;
  inviteLink?: string;
  settings: {
    allowComments: boolean;
    requireApproval: boolean;
    autoSaveInterval: number;
    maxMembers: number;
    retentionDays: number;
  };
}

export interface ExportPackage {
  version: string;
  exportedAt: number;
  exportedBy: string;
  workspace: CollabWorkspace;
  documents: CollaborativeDocument[];
  changesSinceLastSync: SyncChange[];
  checksum: string;
}

export interface ActivityItem {
  userId: string;
  userName: string;
  action: string;
  documentTitle: string;
  documentId: string;
  timestamp: number;
}

export const DOCUMENT_TYPE_ICONS: Record<CollaborativeDocument['type'], string> = {
  note: '📝',
  schedule: '📅',
  memory: '🧠',
  email_draft: '📧',
  document: '📄'
};

export const DOCUMENT_TYPE_LABELS: Record<CollaborativeDocument['type'], string> = {
  note: '笔记',
  schedule: '日程',
  memory: '记忆',
  email_draft: '邮件草稿',
  document: '文档'
};

export const DEFAULT_WORKSPACE_SETTINGS: CollabWorkspace['settings'] = {
  allowComments: true,
  requireApproval: false,
  autoSaveInterval: 30000,
  maxMembers: 10,
  retentionDays: 90
};

export const SYNC_PACKAGE_VERSION = '1.0.0';
export const COLLAB_STORAGE_KEY = 'cast_collab_data';
export const BROADCAST_CHANNEL_NAME = 'cast-collab-sync';
