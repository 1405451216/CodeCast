import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../index';
import type { Message, Session, TodoItem, Attachment, ImageAttachment } from '../types';

describe('MessagesStore', () => {
  beforeEach(() => {
    useAppStore.setState({ messages: [] });
  });

  it('should initialize with empty messages', () => {
    const messages = useAppStore.getState().messages;
    expect(messages).toEqual([]);
  });

  it('should add a message', () => {
    const message: Message = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now()
    };

    useAppStore.getState().addMessage(message);
    
    expect(useAppStore.getState().messages).toHaveLength(1);
    expect(useAppStore.getState().messages[0]).toEqual(message);
  });

  it('should add multiple messages', () => {
    const msg1: Message = { id: 'msg-1', role: 'user', content: 'First' };
    const msg2: Message = { id: 'msg-2', role: 'assistant', content: 'Second' };

    useAppStore.getState().addMessage(msg1);
    useAppStore.getState().addMessage(msg2);

    expect(useAppStore.getState().messages).toHaveLength(2);
  });

  it('should update last message', () => {
    const msg1: Message = { id: 'msg-1', role: 'user', content: 'Original' };
    const msg2: Message = { id: 'msg-2', role: 'assistant', content: 'Assistant' };

    useAppStore.getState().addMessage(msg1);
    useAppStore.getState().addMessage(msg2);

    useAppStore.getState().updateLastMessage((msg) => ({
      ...msg,
      content: 'Updated assistant message'
    }));

    expect(useAppStore.getState().messages[1].content).toBe('Updated assistant message');
    expect(useAppStore.getState().messages[0].content).toBe('Original');
  });

  it('should not update when no messages exist', () => {
    useAppStore.getState().updateLastMessage((msg) => ({
      ...msg,
      content: 'Should not happen'
    }));

    expect(useAppStore.getState().messages).toHaveLength(0);
  });

  it('should clear all messages', () => {
    const msg: Message = { id: 'msg-1', role: 'user', content: 'Test' };
    useAppStore.getState().addMessage(msg);

    useAppStore.getState().clearMessages();

    expect(useAppStore.getState().messages).toHaveLength(0);
  });

  it('should set messages with array', () => {
    const messages: Message[] = [
      { id: 'msg-1', role: 'user', content: 'Hello' },
      { id: 'msg-2', role: 'assistant', content: 'Hi there' }
    ];

    useAppStore.getState().setMessages(messages);

    expect(useAppStore.getState().messages).toHaveLength(2);
  });

  it('should set messages with function updater', () => {
    const msg1: Message = { id: 'msg-1', role: 'user', content: 'First' };
    useAppStore.getState().addMessage(msg1);

    useAppStore.getState().setMessages((prev) => [
      ...prev,
      { id: 'msg-2', role: 'assistant', content: 'Second' }
    ]);

    expect(useAppStore.getState().messages).toHaveLength(2);
  });

  it('should auto-generate ID for messages without ID', () => {
    const message: Message = {
      role: 'user',
      content: 'No ID message'
    };

    useAppStore.getState().addMessage(message);

    expect(useAppStore.getState().messages[0].id).toBeDefined();
    expect(typeof useAppStore.getState().messages[0].id).toBe('string');
  });
});

describe('SessionStore', () => {
  beforeEach(() => {
    useAppStore.setState({ sessions: [], currentSessionId: null });
  });

  it('should initialize with empty sessions', () => {
    expect(useAppStore.getState().sessions).toEqual([]);
    expect(useAppStore.getState().currentSessionId).toBeNull();
  });

  it('should add a session', () => {
    const session: Session = {
      ID: 'session-1',
      Name: 'Test Session',
      CreatedAt: new Date().toISOString(),
      SkillID: 'default',
      Mode: 'daily',
      Messages: []
    };

    useAppStore.getState().addSession(session);

    expect(useAppStore.getState().sessions).toHaveLength(1);
    expect(useAppStore.getState().sessions[0]).toEqual(session);
  });

  it('should remove a session', () => {
    const session1: Session = {
      ID: 'session-1',
      Name: 'Session 1',
      CreatedAt: new Date().toISOString(),
      SkillID: 'default',
      Mode: 'coding',
      Messages: []
    };
    const session2: Session = {
      ID: 'session-2',
      Name: 'Session 2',
      CreatedAt: new Date().toISOString(),
      SkillID: 'default',
      Mode: 'daily',
      Messages: []
    };

    useAppStore.getState().addSession(session1);
    useAppStore.getState().addSession(session2);
    useAppStore.getState().setCurrentSessionId('session-1');

    useAppStore.getState().removeSession('session-1');

    expect(useAppStore.getState().sessions).toHaveLength(1);
    expect(useAppStore.getState().sessions[0].ID).toBe('session-2');
    expect(useAppStore.getState().currentSessionId).toBeNull();
  });

  it('should not change currentSessionId when removing non-active session', () => {
    const session1: Session = {
      ID: 'session-1',
      Name: 'Session 1',
      CreatedAt: new Date().toISOString(),
      SkillID: 'default',
      Mode: 'daily',
      Messages: []
    };
    const session2: Session = {
      ID: 'session-2',
      Name: 'Session 2',
      CreatedAt: new Date().toISOString(),
      SkillID: 'default',
      Mode: 'daily',
      Messages: []
    };

    useAppStore.getState().addSession(session1);
    useAppStore.getState().addSession(session2);
    useAppStore.setState({ currentSessionId: 'session-1' });

    useAppStore.getState().removeSession('session-2');

    expect(useAppStore.getState().currentSessionId).toBe('session-1');
  });

  it('should set sessions', () => {
    const sessions: Session[] = [
      {
        ID: 's1',
        Name: 'S1',
        CreatedAt: new Date().toISOString(),
        SkillID: 'default',
        Mode: 'daily',
        Messages: []
      },
      {
        ID: 's2',
        Name: 'S2',
        CreatedAt: new Date().toISOString(),
        SkillID: 'default',
        Mode: 'coding',
        Messages: []
      }
    ];

    useAppStore.getState().setSessions(sessions);

    expect(useAppStore.getState().sessions).toHaveLength(2);
  });

  it('should set current session ID', () => {
    useAppStore.getState().setCurrentSessionId('session-123');

    expect(useAppStore.getState().currentSessionId).toBe('session-123');
  });

  it('should set current session ID to null', () => {
    useAppStore.setState({ currentSessionId: 'session-123' });
    useAppStore.getState().setCurrentSessionId(null);

    expect(useAppStore.getState().currentSessionId).toBeNull();
  });
});

describe('TodoStore', () => {
  beforeEach(() => {
    useAppStore.setState({ todoItems: [] });
  });

  it('should add todo item', () => {
    const todo: TodoItem = {
      id: 'todo-1',
      content: 'Test task',
      status: 'pending'
    };

    useAppStore.getState().addTodoItem(todo);

    expect(useAppStore.getState().todoItems).toHaveLength(1);
    expect(useAppStore.getState().todoItems[0]).toEqual(todo);
  });

  it('should update todo status', () => {
    const todo: TodoItem = {
      id: 'todo-1',
      content: 'Task',
      status: 'pending'
    };

    useAppStore.getState().addTodoItem(todo);
    useAppStore.getState().updateTodoItem('todo-1', { status: 'in_progress' });

    expect(useAppStore.getState().todoItems[0].status).toBe('in_progress');
  });

  it('should set todo items', () => {
    const todos: TodoItem[] = [
      { id: 'todo-1', content: 'Task 1', status: 'pending' },
      { id: 'todo-2', content: 'Task 2', status: 'in_progress' },
      { id: 'todo-3', content: 'Task 3', status: 'completed' }
    ];

    useAppStore.getState().setTodoItems(todos);

    expect(useAppStore.getState().todoItems).toHaveLength(3);
  });
});

describe('ModelStore', () => {
  it('should have selected model', () => {
    expect(useAppStore.getState().selectedModel).toBeDefined();
  });

  it('should set selected model', () => {
    useAppStore.getState().setSelectedModel('gpt-4');

    expect(useAppStore.getState().selectedModel).toBe('gpt-4');
  });

  it('should toggle thinking mode', () => {
    const initial = useAppStore.getState().thinkingMode;
    useAppStore.getState().toggleThinkingMode();

    expect(useAppStore.getState().thinkingMode).toBe(!initial);
  });
});

describe('AttachmentStore', () => {
  beforeEach(() => {
    useAppStore.setState({ attachments: [], images: [] });
  });

  it('should add file attachment', () => {
    const attachment: Attachment = {
      name: 'test.txt',
      path: '/path/to/test.txt'
    };

    useAppStore.getState().addAttachment(attachment);

    expect(useAppStore.getState().attachments).toHaveLength(1);
    expect(useAppStore.getState().attachments[0]).toEqual(attachment);
  });

  it('should add image attachment', () => {
    const imageAttachment: ImageAttachment = {
      id: 'img-1',
      name: 'test.png',
      dataUrl: 'data:image/png;base64,test',
      size: 1024,
      type: 'image/png'
    };

    useAppStore.getState().addImage(imageAttachment);

    expect(useAppStore.getState().images).toHaveLength(1);
  });

  it('should remove attachment by index', () => {
    const attachment1: Attachment = { name: 'test1.txt', path: '/path/test1.txt' };
    const attachment2: Attachment = { name: 'test2.txt', path: '/path/test2.txt' };

    useAppStore.getState().addAttachment(attachment1);
    useAppStore.getState().addAttachment(attachment2);
    useAppStore.getState().removeAttachment(0);

    expect(useAppStore.getState().attachments).toHaveLength(1);
    expect(useAppStore.getState().attachments[0].name).toBe('test2.txt');
  });

  it('should clear all attachments', () => {
    const attachment: Attachment = {
      name: 'test.txt',
      path: '/path/to/test.txt'
    };
    const imageAttachment: ImageAttachment = {
      id: 'img-1',
      name: 'test.png',
      dataUrl: 'data:image/png;base64,test',
      size: 1024,
      type: 'image/png'
    };

    useAppStore.getState().addAttachment(attachment);
    useAppStore.getState().addImage(imageAttachment);
    useAppStore.getState().clearAttachments();
    useAppStore.getState().clearImages();

    expect(useAppStore.getState().attachments).toHaveLength(0);
    expect(useAppStore.getState().images).toHaveLength(0);
  });
});

describe('UIStore', () => {
  it('should toggle sidebar', () => {
    const initial = useAppStore.getState().sidebarVisible;
    useAppStore.getState().toggleSidebar();

    expect(useAppStore.getState().sidebarVisible).toBe(!initial);
  });

  it('should set active panel', () => {
    useAppStore.getState().setActivePanel('plugins');

    expect(useAppStore.getState().activePanel).toBe('plugins');
  });

  it('should set view mode', () => {
    useAppStore.setState({ view: 'welcome' });
    useAppStore.getState().setView('chat');

    expect(useAppStore.getState().view).toBe('chat');
  });
});

describe('Streaming State', () => {
  it('should initialize with streaming off', () => {
    expect(useAppStore.getState().isStreaming).toBe(false);
  });

  it('should set streaming state to true', () => {
    useAppStore.getState().setIsStreaming(true);

    expect(useAppStore.getState().isStreaming).toBe(true);
  });

  it('should set streaming state to false', () => {
    useAppStore.setState({ isStreaming: true });
    useAppStore.getState().setIsStreaming(false);

    expect(useAppStore.getState().isStreaming).toBe(false);
  });
});
