import { describe, it, expect, vi } from 'vitest';
import { PluginPermission, PluginManifest, PluginAPI } from '../PluginTypes';

describe('PluginTypes', () => {
  describe('PluginPermission', () => {
    it('should have all required permissions', () => {
      expect(PluginPermission.READ_FILES).toBe('read:files');
      expect(PluginPermission.WRITE_FILES).toBe('write:files');
      expect(PluginPermission.EXECUTE_COMMANDS).toBe('execute:commands');
      expect(PluginPermission.ACCESS_GIT).toBe('access:git');
      expect(PluginPermission.MODIFY_UI).toBe('modify:ui');
      expect(PluginPermission.NETWORK_ACCESS).toBe('network:access');
      expect(PluginPermission.READ_SETTINGS).toBe('read:settings');
      expect(PluginPermission.WRITE_SETTINGS).toBe('write:settings');
    });
  });

  describe('PluginManifest Validation', () => {
    it('should create valid manifest', () => {
      const manifest: PluginManifest = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test Author',
        entry: './index.js',
        permissions: [PluginPermission.READ_FILES],
        minAppVersion: '1.0.0'
      };

      expect(manifest.id).toBe('test-plugin');
      expect(manifest.name).toBe('Test Plugin');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.permissions).toContain(PluginPermission.READ_FILES);
    });

    it('should support optional fields', () => {
      const manifest: PluginManifest = {
        id: 'plugin-with-options',
        name: 'Plugin with Options',
        version: '2.0.0',
        description: 'Test optional fields',
        author: 'Author',
        entry: './main.js',
        permissions: [],
        minAppVersion: '1.5.0',
        icon: 'icon.png',
        homepage: 'https://example.com',
        dependencies: ['core-plugin']
      };

      expect(manifest.icon).toBe('icon.png');
      expect(manifest.homepage).toBe('https://example.com');
      expect(manifest.dependencies).toContain('core-plugin');
    });
  });
});
