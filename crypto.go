package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sync"
)

var (
	encryptionKey  []byte
	encryptionOnce sync.Once
	encryptionErr  error
)

func initEncryptionKey() error {
	encryptionOnce.Do(func() {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			encryptionErr = err
			return
		}

		keyPath := filepath.Join(homeDir, ".db-client", ".key")

		data, err := os.ReadFile(keyPath)
		if err == nil {
			decoded, err := base64.StdEncoding.DecodeString(string(data))
			if err == nil && len(decoded) == 32 {
				encryptionKey = decoded
				return
			}
		}

		key := make([]byte, 32)
		if _, err := rand.Read(key); err != nil {
			encryptionErr = err
			return
		}

		encryptionKey = key

		configDir := filepath.Dir(keyPath)
		os.MkdirAll(configDir, 0700)
		encoded := base64.StdEncoding.EncodeToString(key)
		encryptionErr = os.WriteFile(keyPath, []byte(encoded), 0600)
	})
	return encryptionErr
}

func encryptPassword(password string) (string, error) {
	if password == "" {
		return "", nil
	}

	if err := initEncryptionKey(); err != nil {
		return "", err
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := aesGCM.Seal(nonce, nonce, []byte(password), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func decryptPassword(encrypted string) (string, error) {
	if encrypted == "" {
		return "", nil
	}

	if err := initEncryptionKey(); err != nil {
		return "", err
	}

	data, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return "", errors.New("invalid encrypted password format")
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := aesGCM.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("encrypted password too short")
	}

	plaintext, err := aesGCM.Open(nil, data[:nonceSize], data[nonceSize:], nil)
	if err != nil {
		return "", errors.New("failed to decrypt password")
	}

	return string(plaintext), nil
}
