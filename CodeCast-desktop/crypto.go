package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
)

const (
	keyLength       = 32
	nonceLength     = 12
	keyFileName     = ".encryption_key"
	encryptedPrefix = "enc:"
)

var (
	ErrInvalidCiphertext = errors.New("invalid ciphertext format")
	ErrDecryptionFailed  = errors.New("decryption failed")
)

func generateKey() ([]byte, error) {
	key := make([]byte, keyLength)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("failed to generate encryption key: %w", err)
	}
	return key, nil
}

func getKeyPath(settingsPath string) string {
	dir := filepath.Dir(settingsPath)
	return filepath.Join(dir, keyFileName)
}

func loadOrCreateKey(keyPath string) ([]byte, error) {
	data, err := os.ReadFile(keyPath)
	if err == nil {
		key, err := base64.StdEncoding.DecodeString(string(data))
		if err == nil && len(key) == keyLength {
			return key, nil
		}
	}

	key, err := generateKey()
	if err != nil {
		return nil, err
	}

	encoded := base64.StdEncoding.EncodeToString(key)

	// Use O_EXCL to atomically create the file, avoiding a TOCTOU race where
	// another process creates the file between our read and write.
	f, err := os.OpenFile(keyPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		if os.IsExist(err) {
			// Another process created it first; read their key instead.
			data, err := os.ReadFile(keyPath)
			if err != nil {
				return nil, fmt.Errorf("failed to read key after race: %w", err)
			}
			key, err := base64.StdEncoding.DecodeString(string(data))
			if err != nil || len(key) != keyLength {
				return nil, fmt.Errorf("key file exists but is invalid after race: %w", err)
			}
			return key, nil
		}
		return nil, fmt.Errorf("failed to save encryption key: %w", err)
	}
	if _, err := f.Write([]byte(encoded)); err != nil {
		f.Close()
		return nil, fmt.Errorf("failed to write encryption key: %w", err)
	}
	f.Close()

	if runtime.GOOS == "windows" {
		_ = restrictKeyFileAccess(keyPath)
	}

	return key, nil
}

func encryptAPIKey(plaintext string, key []byte) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher block: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, nonceLength)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := aesGCM.Seal(nil, nonce, []byte(plaintext), nil)

	result := append(nonce, ciphertext...)
	encoded := base64.StdEncoding.EncodeToString(result)

	return encryptedPrefix + encoded, nil
}

func decryptAPIKey(encrypted string, key []byte) (string, error) {
	if encrypted == "" {
		return "", nil
	}

	if len(encrypted) <= len(encryptedPrefix) || encrypted[:len(encryptedPrefix)] != encryptedPrefix {
		return encrypted, nil
	}

	encoded := encrypted[len(encryptedPrefix):]
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	if len(data) < nonceLength+aes.BlockSize {
		return "", ErrInvalidCiphertext
	}

	nonce := data[:nonceLength]
	ciphertext := data[nonceLength:]

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher block: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", ErrDecryptionFailed
	}

	return string(plaintext), nil
}

func isEncrypted(value string) bool {
	return len(value) > len(encryptedPrefix) && value[:len(encryptedPrefix)] == encryptedPrefix
}

var safeUsernameRe = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

func restrictKeyFileAccess(path string) error {
	username := os.Getenv("USERNAME")
	if !safeUsernameRe.MatchString(username) {
		return fmt.Errorf("invalid USERNAME for icacls: contains disallowed characters")
	}
	cmd := exec.Command("icacls", path, "/inheritance:r", "/grant:r", fmt.Sprintf("%s:(R)", username))
	return cmd.Run()
}
