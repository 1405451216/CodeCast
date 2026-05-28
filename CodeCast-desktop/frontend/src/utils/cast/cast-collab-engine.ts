import type {
  CollabUser,
  CollaborativeDocument,
  SyncChange,
  SyncSession,
  CollabWorkspace,
  ExportPackage,
  ActivityItem,
  CollaborationRole,
  ChangeType,
  SyncStatus
} from '../../types/cast-collab';
import {
  ROLE_PERMISSIONS,
  DEFAULT_WORKSPACE_SETTINGS,
  SYNC_PACKAGE_VERSION,
  COLLAB_STORAGE_KEY,
  BROADCAST_CHANNEL_NAME
} from '../../types/cast-collab';

function generateId(prefix = 'collab'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateColor(): string {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16',
    '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
    '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function computeChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function contentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

class CastCollabEngine {
  private localWorkspace: CollabWorkspace | null = null;
  private documents: Map<string, CollaborativeDocument> = new Map();
  private changes: SyncChange[] = [];
  private syncSessions: Map<string, SyncSession> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private remoteChangeHandlers: Array<(change: SyncChange) => void> = [];
  private currentUser: CollabUser;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private activityFeed: ActivityItem[] = [];

  constructor() {
    this.currentUser = {
      id: 'local-user',
      name: '你',
      color: '#f59e0b',
      role: 'owner',
      online: true,
      lastActiveAt: Date.now(),
      permissions: ROLE_PERMISSIONS['owner']
    };
  }

  get getCurrentUser(): CollabUser {
    return this.currentUser;
  }

  setCurrentUser(user: Partial<CollabUser>): void {
    this.currentUser = { ...this.currentUser, ...user };
  }

  createWorkspace(name: string, description = ''): CollabWorkspace {
    const workspace: CollabWorkspace = {
      id: generateId('ws'),
      name,
      description,
      ownerId: this.currentUser.id,
      members: [{
        ...this.currentUser,
        id: this.currentUser.id
      }],
      documents: [],
      sharedMemory: false,
      sharedKnowledge: false,
      sharedSchedule: false,
      settings: { ...DEFAULT_WORKSPACE_SETTINGS }
    };
    this.localWorkspace = workspace;
    this.addActivity({
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      action: '创建了工作空间',
      documentTitle: name,
      documentId: workspace.id,
      timestamp: Date.now()
    });
    return workspace;
  }

  getWorkspace(): CollabWorkspace | null {
    if (!this.localWorkspace) return null;
    return {
      ...this.localWorkspace,
      documents: Array.from(this.documents.values()),
      members: this.localWorkspace.members.map(m => ({
        ...m,
        online: m.id === this.currentUser.id ? true : m.online
      }))
    };
  }

  updateWorkspace(updates: Partial<CollabWorkspace>): void {
    if (!this.localWorkspace) return;
    if (!this.checkPermission(this.currentUser.id, 'manage_settings')) return;
    this.localWorkspace = { ...this.localWorkspace, ...updates };
  }

  addMember(member: Omit<CollabUser, 'id' | 'online' | 'lastActiveAt'>): string {
    if (!this.localWorkspace) throw new Error('工作空间未初始化');
    if (!this.checkPermission(this.currentUser.id, 'invite')) throw new Error('无权限邀请成员');
    if (this.localWorkspace.members.length >= this.localWorkspace.settings.maxMembers) {
      throw new Error(`成员数量已达上限 (${this.localWorkspace.settings.maxMembers})`);
    }
    const id = generateId('user');
    const newMember: CollabUser = {
      ...member,
      id,
      online: false,
      lastActiveAt: Date.now(),
      permissions: ROLE_PERMISSIONS[member.role]
    };
    this.localWorkspace = {
      ...this.localWorkspace,
      members: [...this.localWorkspace.members, newMember]
    };
    this.addActivity({
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      action: `邀请了 ${member.name} 加入`,
      documentTitle: this.localWorkspace.name,
      documentId: this.localWorkspace.id,
      timestamp: Date.now()
    });
    return id;
  }

  removeMember(userId: string): void {
    if (!this.localWorkspace) return;
    if (userId === this.localWorkspace.ownerId) throw new Error('不能移除所有者');
    if (!this.checkPermission(this.currentUser.id, 'manage_members')) return;
    this.localWorkspace = {
      ...this.localWorkspace,
      members: this.localWorkspace.members.filter(m => m.id !== userId)
    };
    this.addActivity({
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      action: '移除了成员',
      documentTitle: '',
      documentId: userId,
      timestamp: Date.now()
    });
  }

  updateMemberRole(userId: string, role: CollaborationRole): void {
    if (!this.localWorkspace) return;
    if (!this.checkPermission(this.currentUser.id, 'manage_members')) return;
    this.localWorkspace = {
      ...this.localWorkspace,
      members: this.localWorkspace.members.map(m =>
        m.id === userId ? { ...m, role, permissions: ROLE_PERMISSIONS[role] } : m
      )
    };
  }

  getMembers(): CollabUser[] {
    if (!this.localWorkspace) return [];
    return this.localWorkspace.members;
  }

  createDocument(doc: Omit<CollaborativeDocument, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'status' | 'ownerId'>): string {
    if (!this.localWorkspace) throw new Error('工作空间未初始化');
    if (!this.checkPermission(this.currentUser.id, 'write')) throw new Error('无写入权限');
    const id = generateId('doc');
    const now = Date.now();
    const newDoc: CollaborativeDocument = {
      ...doc,
      id,
      ownerId: this.currentUser.id,
      collaborators: [this.currentUser],
      version: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy: this.currentUser.id,
      status: 'synced',
      tags: doc.tags ?? [],
      metadata: doc.metadata ?? {}
    };
    this.documents.set(id, newDoc);
    this.recordChange({
      documentId: id,
      type: 'create',
      userId: this.currentUser.id,
      data: { content: doc.content }
    });
    this.addActivity({
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      action: '创建了文档',
      documentTitle: doc.title,
      documentId: id,
      timestamp: now
    });
    return id;
  }

  updateDocument(documentId: string, updates: Partial<Pick<CollaborativeDocument, 'content' | 'title' | 'tags' | 'metadata'>>, userId?: string): CollaborativeDocument {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error(`文档不存在: ${documentId}`);
    const actorId = userId ?? this.currentUser.id;
    if (!this.checkPermission(actorId, 'write', documentId)) throw new Error('无写入权限');
    if (doc.lock && doc.lock.userId !== actorId && doc.lock.expiresAt > Date.now()) {
      throw new Error('文档已被其他用户锁定');
    }
    const oldContentHash = contentHash(doc.content);
    const updatedDoc: CollaborativeDocument = {
      ...doc,
      ...updates,
      version: doc.version + 1,
      updatedAt: Date.now(),
      updatedBy: actorId,
      status: 'synced'
    };
    this.documents.set(documentId, updatedDoc);
    this.recordChange({
      documentId,
      type: 'update',
      userId: actorId,
      data: {
        ...(updates.content !== undefined ? { content: updates.content } : {}),
        ...(updates.title !== undefined ? { value: updates.title, oldValue: doc.title, path: 'title' } : {})
      }
    });
    this.broadcastChange(this.changes[this.changes.length - 1]);
    this.addActivity({
      userId: actorId,
      userName: this.getMemberName(actorId),
      action: '编辑了',
      documentTitle: updatedDoc.title,
      documentId,
      timestamp: Date.now()
    });
    return updatedDoc;
  }

  deleteDocument(documentId: string): boolean {
    const doc = this.documents.get(documentId);
    if (!doc) return false;
    if (!this.checkPermission(this.currentUser.id, 'delete', documentId)) return false;
    this.recordChange({
      documentId,
      type: 'delete',
      userId: this.currentUser.id,
      data: { content: doc.content, oldValue: doc.title }
    });
    this.documents.delete(documentId);
    this.addActivity({
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      action: '删除了文档',
      documentTitle: doc.title,
      documentId,
      timestamp: Date.now()
    });
    return true;
  }

  getDocuments(filter?: { type?: CollaborativeDocument['type']; author?: string }): CollaborativeDocument[] {
    let docs = Array.from(this.documents.values());
    if (filter?.type) {
      docs = docs.filter(d => d.type === filter.type);
    }
    if (filter?.author) {
      docs = docs.filter(d => d.ownerId === filter.author || d.updatedBy === filter.author);
    }
    return docs.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getDocument(documentId: string): CollaborativeDocument | undefined {
    return this.documents.get(documentId);
  }

  recordChange(change: Omit<SyncChange, 'id' | 'timestamp' | 'applied'>): string {
    const id = generateId('chg');
    const syncChange: SyncChange = {
      ...change,
      id,
      timestamp: Date.now(),
      applied: true
    };
    this.changes.push(syncChange);
    return id;
  }

  getChanges(documentId?: string, since?: number): SyncChange[] {
    let result = this.changes;
    if (documentId) {
      result = result.filter(c => c.documentId === documentId);
    }
    if (since) {
      result = result.filter(c => c.timestamp >= since);
    }
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }

  undoChange(changeId: string): boolean {
    const idx = this.changes.findIndex(c => c.id === changeId);
    if (idx === -1) return false;
    const change = this.changes[idx];
    if (change.type === 'create') {
      this.documents.delete(change.documentId);
    } else if (change.type === 'delete') {
      // Cannot fully undo delete without storing full snapshot
      return false;
    } else if (change.type === 'update') {
      const doc = this.documents.get(change.documentId);
      if (!doc) return false;
      if (change.data.path === 'title' && change.data.oldValue !== undefined) {
        this.documents.set(change.documentId, {
          ...doc,
          title: change.data.oldValue as string,
          version: doc.version + 1
        });
      }
    }
    this.changes[idx] = { ...change, applied: false };
    return true;
  }

  detectConflicts(documentId: string): SyncChange[] {
    const docChanges = this.changes.filter(
      c => c.documentId === documentId && c.applied
    );
    const conflicts: SyncChange[] = [];
    for (let i = 0; i < docChanges.length; i++) {
      for (let j = i + 1; j < docChanges.length; j++) {
        const a = docChanges[i];
        const b = docChanges[j];
        if (
          a.userId !== b.userId &&
          a.type === 'update' &&
          b.type === 'update' &&
          Math.abs(a.timestamp - b.timestamp) < 5000 &&
          !a.conflictWith &&
          !b.conflictWith
        ) {
          conflicts.push(b);
        }
      }
    }
    return conflicts;
  }

  resolveConflict(changeId: string, strategy: 'keep-mine' | 'keep-theirs' | 'merge'): boolean {
    const changeIdx = this.changes.findIndex(c => c.id === changeId);
    if (changeIdx === -1) return false;
    const change = this.changes[changeIdx];
    switch (strategy) {
      case 'keep-mine':
        break;
      case 'keep-theirs':
        this.changes[changeIdx] = { ...change, applied: false };
        break;
      case 'merge': {
        const doc = this.documents.get(change.documentId);
        if (doc && change.data.content !== undefined) {
          const merged = this.mergeText(doc.content, change.data.content);
          this.documents.set(change.documentId, {
            ...doc,
            content: merged,
            version: doc.version + 1
          });
        }
        break;
      }
    }
    this.changes[changeIdx] = {
      ...this.changes[changeIdx],
      conflictWith: undefined
    };
    return true;
  }

  private mergeText(base: string, incoming: string): string {
    const baseLines = base.split('\n');
    const incomingLines = incoming.split('\n');
    const baseSet = new Set(baseLines);
    const merged = [...baseLines];
    for (const line of incomingLines) {
      if (!baseSet.has(line)) {
        merged.push(line);
      }
    }
    return merged.join('\n');
  }

  acquireLock(documentId: string, userId: string, durationMs = 300000): boolean {
    const doc = this.documents.get(documentId);
    if (!doc) return false;
    if (doc.lock && doc.lock.expiresAt > Date.now() && doc.lock.userId !== userId) {
      return false;
    }
    const now = Date.now();
    this.documents.set(documentId, {
      ...doc,
      lock: {
        userId,
        acquiredAt: now,
        expiresAt: now + durationMs
      }
    });
    return true;
  }

  releaseLock(documentId: string, userId: string): boolean {
    const doc = this.documents.get(documentId);
    if (!doc || !doc.lock || doc.lock.userId !== userId) return false;
    this.documents.set(documentId, {
      ...doc,
      lock: undefined
    });
    return true;
  }

  hasLock(documentId: string): { userId: string; expiresAt: number } | null {
    const doc = this.documents.get(documentId);
    if (!doc?.lock || doc.lock.expiresAt <= Date.now()) return null;
    return { userId: doc.lock.userId, expiresAt: doc.lock.expiresAt };
  }

  checkPermission(userId: string, action: 'read' | 'write' | 'delete' | 'invite' | 'manage_settings' | 'manage_members' | 'comment', resource?: string): boolean {
    const member = this.localWorkspace?.members.find(m => m.id === userId);
    if (!member) return false;
    if (member.role === 'owner') return true;
    return member.permissions.includes(action);
  }

  enableMultiWindowSync(): void {
    if (this.broadcastChannel) return;
    try {
      this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.broadcastChannel.onmessage = (event) => {
        const change = event.data as SyncChange;
        if (change.userId !== this.currentUser.id) {
          this.remoteChangeHandlers.forEach(handler => handler(change));
        }
      };
    } catch {
      console.warn('[CastCollab] BroadcastChannel not supported in this context');
    }
  }

  disableMultiWindowSync(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }

  broadcastChange(change: SyncChange): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(change);
      } catch {
        // Cross-origin or other error, silently ignore
      }
    }
  }

  onRemoteChange(handler: (change: SyncChange) => void): () => void {
    this.remoteChangeHandlers.push(handler);
    return () => {
      this.remoteChangeHandlers = this.remoteChangeHandlers.filter(h => h !== handler);
    };
  }

  async exportSyncPackage(): Promise<ExportPackage> {
    if (!this.localWorkspace) throw new Error('工作空间未初始化');
    const payload = {
      version: SYNC_PACKAGE_VERSION,
      exportedAt: Date.now(),
      exportedBy: this.currentUser.id,
      workspace: this.getWorkspace()!,
      documents: this.getDocuments(),
      changesSinceLastSync: this.changes.slice(-100),
      checksum: ''
    };
    const serialized = JSON.stringify(payload);
    payload.checksum = await computeChecksum(serialized);
    return payload;
  }

  async importSyncPackage(pkg: ExportPackage): Promise<{ merged: number; conflicts: number; errors: string[] }> {
    const result: { merged: number; conflicts: number; errors: string[] } = {
      merged: 0,
      conflicts: 0,
      errors: []
    };

    try {
      const serialized = JSON.stringify({ ...pkg, checksum: '' });
      const computedChecksum = await computeChecksum(serialized);
      if (computedChecksum !== pkg.checksum) {
        result.errors.push('校验和不匹配，数据可能已损坏');
        return result;
      }

      if (!this.localWorkspace) {
        this.localWorkspace = pkg.workspace;
      }

      for (const doc of pkg.documents) {
        const existing = this.documents.get(doc.id);
        if (existing) {
          if (doc.version > existing.version) {
            this.documents.set(doc.id, doc);
            result.merged++;
          } else if (doc.version === existing.version && existing.content !== doc.content) {
            result.conflicts++;
            const conflictChange: SyncChange = {
              id: generateId('conflict'),
              documentId: doc.id,
              type: 'merge',
              userId: pkg.exportedBy,
              timestamp: Date.now(),
              data: { content: doc.content, oldValue: existing.content },
              applied: false,
              conflictWith: existing.id
            };
            this.changes.push(conflictChange);
          } else {
            result.merged++;
          }
        } else {
          this.documents.set(doc.id, doc);
          result.merged++;
        }
      }

      for (const change of pkg.changesSinceLastSync) {
        if (!this.changes.find(c => c.id === change.id)) {
          this.changes.push(change);
        }
      }
    } catch (e) {
      result.errors.push(String(e));
    }

    return result;
  }

  generateInviteLink(): string {
    if (!this.localWorkspace) return '';
    const token = generateId('invite').replace(/-/g, '');
    const link = `cast://collab/invite?workspace=${this.localWorkspace.id}&token=${token}`;
    this.localWorkspace.inviteLink = link;
    return link;
  }

  enableAutoSave(intervalMs = 30000): void {
    this.disableAutoSave();
    this.autoSaveTimer = setInterval(() => {
      this.saveToStorage();
    }, intervalMs);
  }

  disableAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  setOnlineStatus(online: boolean): void {
    this.currentUser.online = online;
    this.currentUser.lastActiveAt = Date.now();
    if (this.localWorkspace) {
      this.localWorkspace.members = this.localWorkspace.members.map(m =>
        m.id === this.currentUser.id ? { ...m, online, lastActiveAt: Date.now() } : m
      );
    }
  }

  getActivityFeed(limit = 50): ActivityItem[] {
    return this.activityFeed.slice(0, limit);
  }

  private addActivity(item: ActivityItem): void {
    this.activityFeed.unshift(item);
    if (this.activityFeed.length > 200) {
      this.activityFeed = this.activityFeed.slice(0, 200);
    }
  }

  private getMemberName(userId: string): string {
    const member = this.localWorkspace?.members.find(m => m.id === userId);
    return member?.name ?? userId;
  }

  saveToStorage(): void {
    try {
      const data = {
        workspace: this.localWorkspace,
        documents: Array.from(this.documents.entries()),
        changes: this.changes,
        activityFeed: this.activityFeed,
        currentUser: this.currentUser
      };
      localStorage.setItem(COLLAB_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('[CastCollab] Failed to save to storage:', e);
    }
  }

  loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(COLLAB_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.workspace) this.localWorkspace = data.workspace;
      if (data.documents) this.documents = new Map(data.documents);
      if (data.changes) this.changes = data.changes;
      if (data.activityFeed) this.activityFeed = data.activityFeed;
      if (data.currentUser) this.currentUser = data.currentUser;
    } catch (e) {
      console.error('[CastCollab] Failed to load from storage:', e);
    }
  }

  clearAll(): void {
    this.disableAutoSave();
    this.disableMultiWindowSync();
    this.localWorkspace = null;
    this.documents.clear();
    this.changes = [];
    this.syncSessions.clear();
    this.activityFeed = [];
    localStorage.removeItem(COLLAB_STORAGE_KEY);
  }

  getStats(): { memberCount: number; documentCount: number; changeCount: number; unresolvedConflicts: number; isOnline: boolean } {
    let unresolvedConflicts = 0;
    for (const change of this.changes) {
      if (change.conflictWith) unresolvedConflicts++;
    }
    return {
      memberCount: this.localWorkspace?.members.length ?? 0,
      documentCount: this.documents.size,
      changeCount: this.changes.length,
      unresolvedConflicts,
      isOnline: this.currentUser.online
    };
  }
}

export const castCollab = new CastCollabEngine();
export { generateId as collabGenerateId, generateColor as collabGenerateColor };
