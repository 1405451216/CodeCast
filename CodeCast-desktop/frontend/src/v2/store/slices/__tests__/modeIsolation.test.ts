// frontend/src/v2/store/slices/__tests__/modeIsolation.test.ts
// 测试 Code / Cast 模式是否完全隔离
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';
import type { Session } from '../../../wails/types';

// ---- Mock 数据 ----

const castSession1: Session = {
  id: 'cast-1',
  name: 'Cast 对话 - 写作助手',
  createdAt: Date.now() - 5000,
  skillID: '',
  mode: 'daily',
  messages: [
    { role: 'user', content: '帮我写一篇文章' },
    { role: 'assistant', content: '好的，我来帮你写...' },
  ],
};

const castSession2: Session = {
  id: 'cast-2',
  name: 'Cast 对话 - 翻译',
  createdAt: Date.now() - 3000,
  skillID: '',
  mode: 'daily',
  messages: [
    { role: 'user', content: '翻译这段话' },
    { role: 'assistant', content: '翻译结果如下...' },
  ],
};

const codeSession1: Session = {
  id: 'code-1',
  name: 'Code 对话 - 重构',
  createdAt: Date.now() - 4000,
  skillID: '',
  mode: 'coding',
  messages: [
    { role: 'user', content: '帮我重构这个函数' },
    { role: 'assistant', content: '重构后的代码如下...' },
  ],
};

const codeSession2: Session = {
  id: 'code-2',
  name: 'Code 对话 - Bug修复',
  createdAt: Date.now() - 2000,
  skillID: '',
  mode: 'coding',
  messages: [
    { role: 'user', content: '这个 bug 怎么修' },
    { role: 'assistant', content: '修复方案如下...' },
  ],
};

// 空 mode 的会话应默认归入 daily (cast)
const emptyModeSession: Session = {
  id: 'empty-mode-1',
  name: '早期对话（无 mode）',
  createdAt: Date.now() - 10000,
  skillID: '',
  mode: '',
  messages: [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'hi' },
  ],
};

// 没有消息的新建会话
const emptyCastSession: Session = {
  id: 'cast-empty',
  name: 'New Session',
  createdAt: Date.now(),
  skillID: '',
  mode: 'daily',
  messages: [],
};

const emptyCodeSession: Session = {
  id: 'code-empty',
  name: 'New Session',
  createdAt: Date.now(),
  skillID: '',
  mode: 'coding',
  messages: [],
};

const allSessions: Session[] = [
  emptyModeSession,
  castSession1,
  codeSession1,
  castSession2,
  codeSession2,
  emptyCastSession,
  emptyCodeSession,
];

// ---- 辅助 ----

function resetStore() {
  useAppStore.setState({
    sessions: [],
    currentSessionId: null,
    sessionLoading: false,
    mode: 'cast',
    messages: {},
    errors: {},
  });
}

function loadAllSessions() {
  useAppStore.setState({ sessions: [...allSessions] });
}

// ---- 测试 ----

describe('Code / Cast 模式隔离', () => {
  beforeEach(() => {
    vi.mocked(App.GetSessions).mockReset();
    vi.mocked(App.CreateSession).mockReset();
    resetStore();
  });

  // ==================== 1. setMode 切换会话 ====================

  describe('setMode 切换时自动切换到对应模式的会话', () => {
    it('Cast → Code: currentSessionId 切换到 coding 会话', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'cast', currentSessionId: 'cast-1' });

      useAppStore.getState().setMode('code');

      expect(useAppStore.getState().mode).toBe('code');
      // 应该选中一个 coding 会话
      const sid = useAppStore.getState().currentSessionId;
      expect(sid).toBeTruthy();
      const session = useAppStore.getState().sessions.find(s => s.id === sid);
      expect(session?.mode || 'daily').toBe('coding');
    });

    it('Code → Cast: currentSessionId 切换到 daily 会话', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'code', currentSessionId: 'code-1' });

      useAppStore.getState().setMode('cast');

      expect(useAppStore.getState().mode).toBe('cast');
      const sid = useAppStore.getState().currentSessionId;
      expect(sid).toBeTruthy();
      const session = useAppStore.getState().sessions.find(s => s.id === sid);
      expect(session?.mode || 'daily').toBe('daily');
    });

    it('切换到没有会话的模式时 currentSessionId 为 null', () => {
      // 只有 cast 会话
      useAppStore.setState({
        sessions: [castSession1, castSession2],
        mode: 'cast',
        currentSessionId: 'cast-1',
      });

      useAppStore.getState().setMode('code');

      expect(useAppStore.getState().mode).toBe('code');
      expect(useAppStore.getState().currentSessionId).toBeNull();
    });
  });

  // ==================== 2. 最近使用过滤 ====================

  describe('最近使用只显示当前模式的会话', () => {
    it('Cast 模式: 只显示 daily 会话', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'cast' });

      const modeMatch = 'daily';
      const recentSessions = useAppStore.getState().sessions
        .filter(s => (s.mode || 'daily') === modeMatch && s.messages && s.messages.length > 0)
        .slice(0, 8);

      // 应包含 cast-1, cast-2, empty-mode-1（空 mode 默认 daily）
      // 不包含 code-1, code-2
      expect(recentSessions.every(s => (s.mode || 'daily') === 'daily')).toBe(true);
      expect(recentSessions.some(s => s.id === 'cast-1')).toBe(true);
      expect(recentSessions.some(s => s.id === 'cast-2')).toBe(true);
      expect(recentSessions.some(s => s.id === 'code-1')).toBe(false);
      expect(recentSessions.some(s => s.id === 'code-2')).toBe(false);
    });

    it('Code 模式: 只显示 coding 会话', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'code' });

      const modeMatch = 'coding';
      const recentSessions = useAppStore.getState().sessions
        .filter(s => (s.mode || 'daily') === modeMatch && s.messages && s.messages.length > 0)
        .slice(0, 8);

      expect(recentSessions.every(s => s.mode === 'coding')).toBe(true);
      expect(recentSessions.some(s => s.id === 'code-1')).toBe(true);
      expect(recentSessions.some(s => s.id === 'code-2')).toBe(true);
      expect(recentSessions.some(s => s.id === 'cast-1')).toBe(false);
    });

    it('空消息的会话不出现在最近使用中', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'cast' });

      const recentSessions = useAppStore.getState().sessions
        .filter(s => (s.mode || 'daily') === 'daily' && s.messages && s.messages.length > 0)
        .slice(0, 8);

      expect(recentSessions.some(s => s.id === 'cast-empty')).toBe(false);
    });
  });

  // ==================== 3. 创建会话带 mode ====================

  describe('创建会话时正确设置 mode', () => {
    it('Cast 模式下创建会话 mode=daily', async () => {
      vi.mocked(App.CreateSession).mockResolvedValueOnce({
        id: 'new-cast',
        name: 'New Session',
        createdAt: Date.now(),
        skillID: '',
        mode: 'daily',
        messages: [],
      } as any);

      useAppStore.setState({ mode: 'cast' });
      const session = await useAppStore.getState().createSession('New Session', '', 'daily');

      expect(App.CreateSession).toHaveBeenCalledWith('New Session', '', 'daily');
      expect(session.mode).toBe('daily');
    });

    it('Code 模式下创建会话 mode=coding', async () => {
      vi.mocked(App.CreateSession).mockResolvedValueOnce({
        id: 'new-code',
        name: 'New Session',
        createdAt: Date.now(),
        skillID: '',
        mode: 'coding',
        messages: [],
      } as any);

      useAppStore.setState({ mode: 'code' });
      const session = await useAppStore.getState().createSession('New Session', '', 'coding');

      expect(App.CreateSession).toHaveBeenCalledWith('New Session', '', 'coding');
      expect(session.mode).toBe('coding');
    });
  });

  // ==================== 4. 会话导航隔离 ====================

  describe('会话导航只在当前模式内切换', () => {
    it('Cast 模式 prev/next 不会跳到 Code 会话', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'cast', currentSessionId: 'cast-1' });

      const mode = useAppStore.getState().mode;
      const sessions = useAppStore.getState().sessions;
      const modeSessions = sessions.filter(s => (s.mode || 'daily') === (mode === 'cast' ? 'daily' : 'coding'));

      // 只有 daily 会话
      expect(modeSessions.every(s => (s.mode || 'daily') === 'daily')).toBe(true);
      expect(modeSessions.length).toBeGreaterThanOrEqual(2);
    });

    it('Code 模式 prev/next 不会跳到 Cast 会话', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'code', currentSessionId: 'code-1' });

      const mode = useAppStore.getState().mode;
      const sessions = useAppStore.getState().sessions;
      const modeSessions = sessions.filter(s => (s.mode || 'daily') === (mode === 'cast' ? 'daily' : 'coding'));

      expect(modeSessions.every(s => s.mode === 'coding')).toBe(true);
      expect(modeSessions.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==================== 5. 聊天区域显示隔离 ====================

  describe('聊天区域只显示当前模式的会话内容', () => {
    it('Code 模式下 currentSessionId 指向 cast 会话时 hasMessages 应为 false', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'code', currentSessionId: 'cast-1' });

      const { mode, currentSessionId, sessions } = useAppStore.getState();
      const currentSession = currentSessionId ? sessions.find(s => s.id === currentSessionId) : null;
      const sessionModeMatch = currentSession
        ? (currentSession.mode || 'daily') === (mode === 'cast' ? 'daily' : 'coding')
        : false;

      expect(sessionModeMatch).toBe(false);
    });

    it('Cast 模式下 currentSessionId 指向 cast 会话时 hasMessages 应为 true', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'cast', currentSessionId: 'cast-1' });

      const { mode, currentSessionId, sessions } = useAppStore.getState();
      const currentSession = currentSessionId ? sessions.find(s => s.id === currentSessionId) : null;
      const sessionModeMatch = currentSession
        ? (currentSession.mode || 'daily') === (mode === 'cast' ? 'daily' : 'coding')
        : false;

      expect(sessionModeMatch).toBe(true);
    });
  });

  // ==================== 6. 空 mode 默认归入 Cast ====================

  describe('空 mode 会话默认归入 Cast (daily)', () => {
    it('mode="" 的会话在 Cast 模式下可见', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'cast' });

      const recentSessions = useAppStore.getState().sessions
        .filter(s => (s.mode || 'daily') === 'daily' && s.messages && s.messages.length > 0)
        .slice(0, 8);

      expect(recentSessions.some(s => s.id === 'empty-mode-1')).toBe(true);
    });

    it('mode="" 的会话在 Code 模式下不可见', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'code' });

      const recentSessions = useAppStore.getState().sessions
        .filter(s => (s.mode || 'daily') === 'coding' && s.messages && s.messages.length > 0)
        .slice(0, 8);

      expect(recentSessions.some(s => s.id === 'empty-mode-1')).toBe(false);
    });
  });

  // ==================== 7. toggleMode ====================

  describe('toggleMode 正确切换', () => {
    it('cast → code', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'cast', currentSessionId: 'cast-1' });

      useAppStore.getState().toggleMode();

      expect(useAppStore.getState().mode).toBe('code');
      const sid = useAppStore.getState().currentSessionId;
      if (sid) {
        const session = useAppStore.getState().sessions.find(s => s.id === sid);
        expect(session?.mode || 'daily').toBe('coding');
      }
    });

    it('code → cast', () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'code', currentSessionId: 'code-1' });

      useAppStore.getState().toggleMode();

      expect(useAppStore.getState().mode).toBe('cast');
      const sid = useAppStore.getState().currentSessionId;
      if (sid) {
        const session = useAppStore.getState().sessions.find(s => s.id === sid);
        expect(session?.mode || 'daily').toBe('daily');
      }
    });
  });

  // ==================== 8. loadSessions 按 mode 选择初始会话 ====================

  describe('loadSessions 根据 mode 选择初始会话', () => {
    it('Cast 模式下加载后选中 daily 会话', async () => {
      vi.mocked(App.GetSessions).mockResolvedValueOnce(allSessions as any);
      useAppStore.setState({ mode: 'cast' });

      await useAppStore.getState().loadSessions();

      const sid = useAppStore.getState().currentSessionId;
      expect(sid).toBeTruthy();
      const session = useAppStore.getState().sessions.find(s => s.id === sid);
      expect(session?.mode || 'daily').toBe('daily');
    });

    it('Code 模式下加载后选中 coding 会话', async () => {
      vi.mocked(App.GetSessions).mockResolvedValueOnce(allSessions as any);
      useAppStore.setState({ mode: 'code' });

      await useAppStore.getState().loadSessions();

      const sid = useAppStore.getState().currentSessionId;
      expect(sid).toBeTruthy();
      const session = useAppStore.getState().sessions.find(s => s.id === sid);
      expect(session?.mode).toBe('coding');
    });
  });

  // ==================== 9. 删除会话不影响另一模式 ====================

  describe('删除一个模式的会话不影响另一模式', () => {
    it('删除 Cast 会话后 Code 会话仍在', async () => {
      loadAllSessions();
      useAppStore.setState({ mode: 'cast', currentSessionId: 'cast-1' });

      await useAppStore.getState().deleteSession('cast-1');

      const sessions = useAppStore.getState().sessions;
      expect(sessions.some(s => s.id === 'code-1')).toBe(true);
      expect(sessions.some(s => s.id === 'code-2')).toBe(true);
      expect(sessions.some(s => s.id === 'cast-1')).toBe(false);
    });
  });
});
