// frontend/src/v2/test/setup.ts
import { vi, beforeEach } from 'vitest';
import * as App from '../wails/__mocks__/App';

vi.mock('@wailsjs/go/main/App', () => App);
vi.mock('@wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn((_topic: string, _cb: Function) => {}),
  EventsOff: vi.fn((_topic: string) => {}),
  EventsEmit: vi.fn(),
}));

beforeEach(() => {
  // 每个测试前清空所有 mock 调用记录
  Object.values(App).forEach((v) => {
    if (typeof v === 'function' && 'mockReset' in v) {
      (v as unknown as { mockReset: () => void }).mockReset();
    }
  });
});
