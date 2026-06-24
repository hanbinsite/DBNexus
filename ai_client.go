package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type AIConfig struct {
	Provider  string `json:"provider"`
	APIKey    string `json:"apiKey"`
	BaseURL   string `json:"baseUrl"`
	Model     string `json:"model"`
	EnableAI  bool   `json:"enableAI"`
}

type LLMClient interface {
	Complete(ctx context.Context, systemPrompt, userPrompt string) (string, error)
}

type OpenAIClient struct {
	apiKey  string
	baseURL string
	model   string
}

type OllamaClient struct {
	baseURL string
	model   string
}

func (c *OpenAIClient) Complete(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	reqBody := map[string]interface{}{
		"model": c.model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"temperature": 0.0,
		"max_tokens":  4096,
	}
	jsonBody, _ := json.Marshal(reqBody)

	url := c.baseURL + "/v1/chat/completions"
	if !strings.HasPrefix(c.baseURL, "http") {
		url = "https://api.openai.com/v1/chat/completions"
		if c.baseURL != "" {
			url = c.baseURL + "/v1/chat/completions"
		}
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("AI request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("AI API error %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("AI returned no choices")
	}
	return result.Choices[0].Message.Content, nil
}

func (c *OllamaClient) Complete(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	fullPrompt := systemPrompt + "\n\n" + userPrompt
	reqBody := map[string]interface{}{
		"model":  c.model,
		"prompt": fullPrompt,
		"stream": false,
	}
	jsonBody, _ := json.Marshal(reqBody)

	url := c.baseURL + "/api/generate"
	if c.baseURL == "" {
		url = "http://localhost:11434/api/generate"
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("Ollama request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Ollama error %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Response string `json:"response"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return result.Response, nil
}

func (a *App) getAIClient() (LLMClient, error) {
	config, err := a.getAIConfig()
	if err != nil {
		return nil, err
	}
	if !config.EnableAI {
		return nil, fmt.Errorf("AI is not enabled")
	}

	switch config.Provider {
	case "openai":
		return &OpenAIClient{
			apiKey:  config.APIKey,
			baseURL: config.BaseURL,
			model:   config.Model,
		}, nil
	case "ollama":
		return &OllamaClient{
			baseURL: config.BaseURL,
			model:   config.Model,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported AI provider: %s", config.Provider)
	}
}

func (a *App) getAIConfig() (*AIConfig, error) {
	homeDir, _ := os.UserHomeDir()
	configFile := filepath.Join(homeDir, ".db-client", "config.json")

	data, err := os.ReadFile(configFile)
	if err != nil {
		return &AIConfig{Provider: "ollama", Model: "llama3", EnableAI: false}, nil
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return &AIConfig{Provider: "ollama", Model: "llama3", EnableAI: false}, nil
	}

	config := &AIConfig{Provider: "ollama", Model: "llama3", EnableAI: false}
	if ai, ok := raw["ai"].(map[string]interface{}); ok {
		if p, ok := ai["provider"].(string); ok {
			config.Provider = p
		}
		if k, ok := ai["apiKey"].(string); ok && k != "" {
			decrypted, err := decryptPassword(k)
			if err == nil {
				config.APIKey = decrypted
			}
		}
		if u, ok := ai["baseUrl"].(string); ok {
			config.BaseURL = u
		}
		if m, ok := ai["model"].(string); ok {
			config.Model = m
		}
		if e, ok := ai["enableAI"].(bool); ok {
			config.EnableAI = e
		}
	}
	return config, nil
}

func (a *App) SetAIConfig(provider, apiKey, baseURL, model string, enableAI bool) error {
	homeDir, _ := os.UserHomeDir()
	configDir := filepath.Join(homeDir, ".db-client")
	os.MkdirAll(configDir, 0700)
	configFile := filepath.Join(configDir, "config.json")

	raw := make(map[string]interface{})
	data, err := os.ReadFile(configFile)
	if err == nil {
		json.Unmarshal(data, &raw)
	}

	encryptedKey := ""
	if apiKey != "" {
		encryptedKey, err = encryptPassword(apiKey)
		if err != nil {
			return fmt.Errorf("failed to encrypt API key: %w", err)
		}
	}

	raw["ai"] = map[string]interface{}{
		"provider": provider,
		"apiKey":   encryptedKey,
		"baseUrl":  baseURL,
		"model":    model,
		"enableAI": enableAI,
	}

	data, err = json.MarshalIndent(raw, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configFile, data, 0600)
}

func (a *App) TestAIConnection() (bool, string) {
	client, err := a.getAIClient()
	if err != nil {
		return false, err.Error()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	resp, err := client.Complete(ctx, "You are a helpful assistant.", "Say 'connection ok' in one word.")
	if err != nil {
		return false, err.Error()
	}
	return true, resp
}
