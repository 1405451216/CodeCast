import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// ==================== 全局测试环境配置 (使用 fake-indexeddb) ====================

// 1. File System Access API Mock (解决 FileSystemVectorStore 依赖)
const createFileSystemAccessMock = () => ({
  showDirectoryPicker: vi.fn().mockResolvedValue({
    getFileHandle: vi.fn(),
    getDirectoryHandle: vi.fn(),
    removeEntry: vi.fn(),
    keys: vi.fn(),
    values: vi.fn(),
    entries: vi.fn(),
    requestPermission: vi.fn()
  })
});

// 2. Logger Mock (解决全局 logger 依赖)
const createLoggerMock = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
});

beforeEach(() => {
  // File System Access API
  if (typeof window !== 'undefined') {
    (window as any).showDirectoryPicker = createFileSystemAccessMock().showDirectoryPicker;
  }
  
  // Global logger (匹配实际 API: logger.info(module, message, data))
  (global as any).logger = createLoggerMock();
  
  // ResizeObserver mock
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }));
  
  // IntersectionObserver mock
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }));
  
  // MutationObserver mock
  global.MutationObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => [])
  }));
  
  // matchMedia mock
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  
  // scrollTo mock
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  
  // getComputedStyle mock
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = vi.fn((elt: any, pseudoElt?: string | null) => ({
    ...originalGetComputedStyle(elt, pseudoElt),
    getPropertyValue: (prop: string) => ''
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
