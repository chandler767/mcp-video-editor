package config

import (
	"os"
	"strings"
	"testing"
)

func TestWhisperBaseURLConfig(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("OPENAI_WHISPER_BASE_URL", "http://127.0.0.1:9000/v1")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.WhisperBaseURL != "http://127.0.0.1:9000/v1" {
		t.Fatalf("unexpected env whisper base URL: %q", cfg.WhisperBaseURL)
	}
	if got := cfg.ToMap()["whisperBaseURL"]; got != "http://127.0.0.1:9000/v1" {
		t.Fatalf("unexpected ToMap whisper base URL: %q", got)
	}

	if err := cfg.Update(map[string]interface{}{"openaiWhisperBaseURL": "http://127.0.0.1:9100/v1"}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	data, err := os.ReadFile(home + "/.mcp-video-config.json")
	if err != nil {
		t.Fatalf("read saved config: %v", err)
	}
	if !strings.Contains(string(data), `"whisperBaseURL": "http://127.0.0.1:9100/v1"`) {
		t.Fatalf("saved config missing whisperBaseURL: %s", data)
	}

	if err := cfg.Reset(); err != nil {
		t.Fatalf("Reset: %v", err)
	}
	if cfg.WhisperBaseURL != "" {
		t.Fatalf("reset kept whisper base URL: %q", cfg.WhisperBaseURL)
	}
}
