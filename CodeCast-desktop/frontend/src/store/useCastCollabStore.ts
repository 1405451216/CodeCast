import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  CollabWorkspace,
  CollaborativeDocument,
  SyncChange,
  ActivityItem,
  CollaborationRole,
  ExportPackage,
  SyncStatus
} from '../types/cast-collab';
import {
  castCollab
} from '../utils/cast/cast-collab-engine';

interface CastCollabState {
  workspace: CollabWorkspace | null;
  documents: CollaborativeDocument[];
  members: ReturnType<typeof castCollab.getMembers>;
  changes: SyncChange[];
  activityFeed: ActivityItem[];
  isMultiWindowSyncEnabled: boolean;
  syncStatus: SyncStatus;
  unresolvedConflicts: number;

  initWorkspace: (name: string, description?: string) => void;
  getWorkspace: () => CollabWorkspace | null;
  updateWorkspace: (updates: Partial<CollabWorkspace>) => void;

  addMember: (member: Omit<import('../types/cast-collab').CollabUser, 'id' | 'online' | 'lastActiveAt'>) => string;
  removeMember: (userId: string) => void;
  updateRole: (userId: string, role: CollaborationRole) => void;
  getMembers: () => CastCollabState['members'];

  createDoc: (doc: Omit<CollaborativeDocument, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'status' | 'ownerId'>) => string;
  updateDoc: (id: string, updates: Partial<CollaborativeDocument>) => void;
  deleteDoc: (id: string) => void;
  getDocuments: (filter?: { type?: CollaborativeDocument['type']; author?: string }) => CollaborativeDocument[];
  getDocument: (id: string) => CollaborativeDocument | undefined;
  acquireLock: (docId: string) => boolean;
  releaseLock: (docId: string) => void;
  hasLock: (docId: string) => { userId: string; expiresAt: number } | null;

  enableMultiWindowSync: () => void;
  disableMultiWindowSync: () => void;
  exportPackage: () => Promise<ExportPackage>;
  importPackage: (pkg: ExportPackage) => Promise<{ merged: number; conflicts: number; errors: string[] }>;
  resolveConflict: (changeId: string, strategy: 'keep-mine' | 'keep-theirs') => void;
  getUnresolvedConflicts: () => SyncChange[];

  getActivity: (limit?: number) => ActivityItem[];
  generateInviteLink: () => string;

  loadFromStorage: () => void;
  saveToStorage: () => void;
  clearAll: () => void;
  refreshState: () => void;
}

export const useCastCollabStore = create<CastCollabState>()(
  devtools(
    (set, get) => ({
      workspace: null,
      documents: [],
      members: [],
      changes: [],
      activityFeed: [],
      isMultiWindowSyncEnabled: false,
      syncStatus: 'synced',
      unresolvedConflicts: 0,

      initWorkspace: (name, description) => {
        const ws = castCollab.createWorkspace(name, description);
        set({
          workspace: ws,
          members: castCollab.getMembers(),
          syncStatus: 'synced'
        });
        get().saveToStorage();
      },

      getWorkspace: () => {
        return castCollab.getWorkspace();
      },

      updateWorkspace: (updates) => {
        castCollab.updateWorkspace(updates);
        get().refreshState();
        get().saveToStorage();
      },

      addMember: (member) => {
        const id = castCollab.addMember(member);
        get().refreshState();
        get().saveToStorage();
        return id;
      },

      removeMember: (userId) => {
        castCollab.removeMember(userId);
        get().refreshState();
        get().saveToStorage();
      },

      updateRole: (userId, role) => {
        castCollab.updateMemberRole(userId, role);
        get().refreshState();
        get().saveToStorage();
      },

      getMembers: () => {
        return castCollab.getMembers();
      },

      createDoc: (doc) => {
        const id = castCollab.createDocument(doc);
        get().refreshState();
        get().saveToStorage();
        return id;
      },

      updateDoc: (id, updates) => {
        castCollab.updateDocument(id, updates);
        get().refreshState();
        get().saveToStorage();
      },

      deleteDoc: (id) => {
        castCollab.deleteDocument(id);
        get().refreshState();
        get().saveToStorage();
      },

      getDocuments: (filter) => {
        return castCollab.getDocuments(filter);
      },

      getDocument: (id) => {
        return castCollab.getDocument(id);
      },

      acquireLock: (docId) => {
        return castCollab.acquireLock(docId, castCollab.getCurrentUser.id);
      },

      releaseLock: (docId) => {
        castCollab.releaseLock(docId, castCollab.getCurrentUser.id);
        get().refreshState();
      },

      hasLock: (docId) => {
        return castCollab.hasLock(docId);
      },

      enableMultiWindowSync: () => {
        castCollab.enableMultiWindowSync();
        castCollab.onRemoteChange(() => {
          get().refreshState();
        });
        set({ isMultiWindowSyncEnabled: true });
      },

      disableMultiWindowSync: () => {
        castCollab.disableMultiWindowSync();
        set({ isMultiWindowSyncEnabled: false });
      },

      exportPackage: async () => {
        return castCollab.exportSyncPackage();
      },

      importPackage: async (pkg) => {
        const result = await castCollab.importSyncPackage(pkg);
        get().refreshState();
        get().saveToStorage();
        return result;
      },

      resolveConflict: (changeId, strategy) => {
        castCollab.resolveConflict(changeId, strategy);
        get().refreshState();
        get().saveToStorage();
      },

      getUnresolvedConflicts: () => {
        const docs = get().documents;
        const conflicts: SyncChange[] = [];
        for (const doc of docs) {
          const docConflicts = castCollab.detectConflicts(doc.id);
          conflicts.push(...docConflicts);
        }
        return conflicts;
      },

      getActivity: (limit = 20) => {
        return castCollab.getActivityFeed(limit);
      },

      generateInviteLink: () => {
        return castCollab.generateInviteLink();
      },

      loadFromStorage: () => {
        castCollab.loadFromStorage();
        get().refreshState();
      },

      saveToStorage: () => {
        castCollab.saveToStorage();
      },

      clearAll: () => {
        castCollab.clearAll();
        set({
          workspace: null,
          documents: [],
          members: [],
          changes: [],
          activityFeed: [],
          isMultiWindowSyncEnabled: false,
          syncStatus: 'offline',
          unresolvedConflicts: 0
        });
      },

      refreshState: () => {
        const stats = castCollab.getStats();
        set({
          workspace: castCollab.getWorkspace(),
          documents: castCollab.getDocuments(),
          members: castCollab.getMembers(),
          changes: castCollab.getChanges(undefined, Date.now() - 86400000),
          activityFeed: castCollab.getActivityFeed(50),
          syncStatus: stats.unresolvedConflicts > 0 ? 'conflict' : 'synced',
          unresolvedConflicts: stats.unresolvedConflicts
        });
      }
    }),
    { name: 'cast-collab-store' }
  )
);
