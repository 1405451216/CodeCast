/**
 * AES-GCM encryption for sensitive settings stored in localStorage.
 *
 * Key derivation uses PBKDF2 with a per-device random salt.
 * Legacy _dk keys in localStorage are automatically migrated.
 *
 * TODO: Migrate encryption to Go backend which has proper OS keychain support.
 */
export class StorageEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static cryptoKey: CryptoKey | null = null;

  private static readonly PBKDF2_ITERATIONS = 100000;
  private static readonly SALT_STORAGE_KEY = '_cc_salt';
  private static readonly MATERIAL_STORAGE_KEY = '_cc_material';

  /** Get or create a per-device random salt (persisted in localStorage) */
  private static getOrCreateSalt(): Uint8Array {
    const stored = localStorage.getItem(StorageEncryption.SALT_STORAGE_KEY);
    if (stored) {
      return new Uint8Array(stored.split(',').map(Number));
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(StorageEncryption.SALT_STORAGE_KEY, Array.from(salt).join(','));
    return salt;
  }

  /** Get or create a per-device random key material (persisted in localStorage) */
  private static getOrCreateMaterial(): string {
    let material = localStorage.getItem(StorageEncryption.MATERIAL_STORAGE_KEY);
    if (material) {
      return material;
    }
    // Generate 32 bytes of random material and encode as base64
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    material = btoa(String.fromCharCode(...bytes));
    localStorage.setItem(StorageEncryption.MATERIAL_STORAGE_KEY, material);
    return material;
  }

  private static async getDeviceKey(): Promise<CryptoKey> {
    if (StorageEncryption.cryptoKey) {
      return StorageEncryption.cryptoKey;
    }

    // Check for legacy _dk key in localStorage — migrate if found
    const legacyKey = localStorage.getItem('_dk');
    if (legacyKey) {
      try {
        const keyData = new Uint8Array(legacyKey.split(',').map(Number));
        StorageEncryption.cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: StorageEncryption.ALGORITHM, length: StorageEncryption.KEY_LENGTH },
          false,
          ['encrypt', 'decrypt']
        );
        // Remove legacy key after successful import
        localStorage.removeItem('_dk');
        return StorageEncryption.cryptoKey;
      } catch {
        localStorage.removeItem('_dk');
      }
    }

    // Derive key using PBKDF2 with per-device random material and salt
    const material = StorageEncryption.getOrCreateMaterial();
    const salt = StorageEncryption.getOrCreateSalt();

    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(material),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    StorageEncryption.cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as unknown as ArrayBuffer,
        iterations: StorageEncryption.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: StorageEncryption.ALGORITHM, length: StorageEncryption.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );

    return StorageEncryption.cryptoKey;
  }

  static async encrypt(data: string): Promise<string> {
    try {
      const key = await StorageEncryption.getDeviceKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();

      const encrypted = await crypto.subtle.encrypt(
        { name: StorageEncryption.ALGORITHM, iv },
        key,
        encoder.encode(data)
      );

      const timestamp = Date.now().toString(36);
      const result = {
        t: timestamp,
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted))
      };

      return btoa(JSON.stringify(result));
    } catch (error) {
      // Log the error so developers can diagnose encryption failures
      console.warn('[StorageEncryption] Encrypt failed, using degraded encoding:', error);
      // Prefix with marker so decrypt knows this is not AES-GCM encrypted
      return 'PLAIN:' + btoa(encodeURIComponent(data));
    }
  }

  static async decrypt(encoded: string): Promise<string> {
    // Handle degraded PLAIN: prefix (encrypt failed, fell back to base64)
    if (encoded.startsWith('PLAIN:')) {
      try {
        return decodeURIComponent(atob(encoded.slice(6)));
      } catch {
        return encoded.slice(6);
      }
    }

    try {
      const jsonStr = atob(encoded);
      const { iv, data } = JSON.parse(jsonStr);

      if (!iv || !data) {
        throw new Error('Invalid format');
      }

      const key = await StorageEncryption.getDeviceKey();
      const decrypted = await crypto.subtle.decrypt(
        { name: StorageEncryption.ALGORITHM, iv: new Uint8Array(iv), length: 128 },
        key,
        new Uint8Array(data)
      );

      return new TextDecoder().decode(decrypted);
    } catch {
      // Legacy fallback: try plain base64 decoding (for data encrypted before PLAIN: prefix)
      try {
        return decodeURIComponent(atob(encoded));
      } catch {
        return encoded;
      }
    }
  }
}
