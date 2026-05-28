import { describe, it, expect } from 'vitest';
import { zhCN } from '../locales/zh-CN';
import { enUS } from '../locales/en-US';

describe('Internationalization (i18n)', () => {
  describe('Locale Loading', () => {
    it('should have en-US locale', () => {
      expect(enUS).toBeDefined();
      expect(typeof enUS).toBe('object');
    });

    it('should have zh-CN locale', () => {
      expect(zhCN).toBeDefined();
      expect(typeof zhCN).toBe('object');
    });
  });

  describe('Translation Keys', () => {
    it('should have common translation keys in en-US', () => {
      expect(Object.keys(enUS).length).toBeGreaterThan(0);
    });

    it('should have matching keys in both locales', () => {
      const enKeys = Object.keys(enUS);
      const zhKeys = Object.keys(zhCN);

      expect(new Set(enKeys)).toEqual(new Set(zhKeys));
    });
  });

  describe('Translation Values', () => {
    it('should have string values in en-US', () => {
      for (const key of Object.keys(enUS)) {
        const value = (enUS as any)[key];
        if (typeof value === 'string') {
          expect(value.length).toBeGreaterThan(0);
        }
      }
    });

    it('should have string values in zh-CN', () => {
      for (const key of Object.keys(zhCN)) {
        const value = (zhCN as any)[key];
        if (typeof value === 'string') {
          expect(value.length).toBeGreaterThan(0);
        }
      }
    });

    it('should have different values between locales for same key', () => {
      let hasDifference = false;
      
      for (const key of Object.keys(enUS)) {
        const enValue = JSON.stringify((enUS as any)[key]);
        const zhValue = JSON.stringify((zhCN as any)[key]);
        
        if (enValue !== zhValue) {
          hasDifference = true;
          break;
        }
      }

      expect(hasDifference).toBe(true);
    });
  });
});
