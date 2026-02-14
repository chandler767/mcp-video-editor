package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Config holds all configuration for the MCP video editor
type Config struct {
	OpenAIKey        string            `json:"openaiApiKey"`
	ElevenLabsKey    string            `json:"elevenLabsApiKey,omitempty"`
	ElevenLabsVoices map[string]string `json:"elevenLabsVoices,omitempty"`
	FFmpegPath       string            `json:"ffmpegPath,omitempty"`
	FFprobePath      string            `json:"ffprobePath,omitempty"`
	DefaultQuality   string            `json:"defaultQuality,omitempty"`
	TempDir          string            `json:"tempDir,omitempty"`
}

// Load reads configuration from ~/.mcp-video-config.json
func Load() (*Config, error) {
	cfg := &Config{
		DefaultQuality: "high",
		TempDir:        os.TempDir(),
	}

	// Try to load from home directory
	home, err := os.UserHomeDir()
	if err == nil {
		configPath := filepath.Join(home, ".mcp-video-config.json")
		data, err := os.ReadFile(configPath)
		if err == nil {
			if err := json.Unmarshal(data, cfg); err != nil {
				return nil, err
			}
		}
	}

	// Override with environment variables if set
	if key := os.Getenv("OPENAI_API_KEY"); key != "" {
		cfg.OpenAIKey = key
	}
	if key := os.Getenv("ELEVENLABS_API_KEY"); key != "" {
		cfg.ElevenLabsKey = key
	}
	if path := os.Getenv("FFMPEG_PATH"); path != "" {
		cfg.FFmpegPath = path
	}
	if path := os.Getenv("FFPROBE_PATH"); path != "" {
		cfg.FFprobePath = path
	}

	return cfg, nil
}

// Save writes configuration to ~/.mcp-video-config.json
func (c *Config) Save() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	configPath := filepath.Join(home, ".mcp-video-config.json")
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0600)
}

// Update updates specific configuration values
func (c *Config) Update(updates map[string]interface{}) error {
	for key, value := range updates {
		switch key {
		case "openaiKey", "openaiApiKey":
			if v, ok := value.(string); ok {
				c.OpenAIKey = v
			}
		case "elevenLabsKey", "elevenLabsApiKey":
			if v, ok := value.(string); ok {
				c.ElevenLabsKey = v
			}
		case "ffmpegPath":
			if v, ok := value.(string); ok {
				c.FFmpegPath = v
			}
		case "ffprobePath":
			if v, ok := value.(string); ok {
				c.FFprobePath = v
			}
		case "defaultQuality":
			if v, ok := value.(string); ok {
				c.DefaultQuality = v
			}
		case "tempDir":
			if v, ok := value.(string); ok {
				c.TempDir = v
			}
		}
	}
	return c.Save()
}

// Reset resets configuration to defaults
func (c *Config) Reset() error {
	c.OpenAIKey = ""
	c.ElevenLabsKey = ""
	c.ElevenLabsVoices = nil
	c.FFmpegPath = ""
	c.FFprobePath = ""
	c.DefaultQuality = "high"
	c.TempDir = os.TempDir()
	return c.Save()
}

// ToMap converts config to map for JSON output
func (c *Config) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"openaiKey":        maskAPIKey(c.OpenAIKey),
		"elevenLabsKey":    maskAPIKey(c.ElevenLabsKey),
		"elevenLabsVoices": c.ElevenLabsVoices,
		"ffmpegPath":       c.FFmpegPath,
		"ffprobePath":      c.FFprobePath,
		"defaultQuality":   c.DefaultQuality,
		"tempDir":          c.TempDir,
	}
}

func maskAPIKey(key string) string {
	if key == "" {
		return ""
	}
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}
