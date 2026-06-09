import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Smoke tests: verify that all page files exist at expected paths
// and can be resolved by the module system.

const pagesDir = path.resolve(__dirname, '..');
const expectedPages = [
  'CastKnotePage.tsx',
  'CastSchedulePage.tsx',
  'CastTranslationPage.tsx',
  'CastWritingPage.tsx',
  'CastEmailPage.tsx',
  'CastToolsPage.tsx',
  'CastEmptyState.tsx',
  'CodeEmptyState.tsx',
  'ChatPage.tsx',
  'InferenceConfigPage.tsx',
  'SettingsPage.tsx',
];

describe('Page File Existence', () => {
  expectedPages.forEach((filename) => {
    it(`${filename} exists`, () => {
      const filePath = path.join(pagesDir, filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});

describe('Page Module Loading', () => {
  // Verify component modules load without runtime errors
  const pagesToImport = [
    'CastKnotePage',
    'CastSchedulePage',
    'CastTranslationPage',
    'CastWritingPage',
    'CastEmailPage',
    'CastToolsPage',
    'CastEmptyState',
    'CodeEmptyState',
    'ChatPage',
    'InferenceConfigPage',
    'SettingsPage',
  ];

  pagesToImport.forEach((pageName) => {
    it(`${pageName} exports a default component`, async () => {
      const mod = await import(`../${pageName}`);
      expect(mod.default || mod[pageName]).toBeDefined();
    });
  });
});
