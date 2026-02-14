package audio

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/chandler-mayo/mcp-video-editor/pkg/config"
	elevenlabs "github.com/haguro/elevenlabs-go"
)

// TTSOperations handles ElevenLabs TTS and voice cloning
type TTSOperations struct {
	apiKey string
	client *elevenlabs.Client
	config *config.Config
}

// VoiceCloneOptions contains parameters for voice cloning
type VoiceCloneOptions struct {
	Name        string
	AudioPath   string
	Description string
}

// SpeechOptions contains parameters for TTS generation
type SpeechOptions struct {
	Text       string
	VoiceID    string
	ModelID    string  // defaults to "eleven_multilingual_v2"
	Stability  float64 // 0.0-1.0, default 0.5
	Similarity float64 // 0.0-1.0, default 0.75
}

// NewTTSOperations creates a new TTS operations handler
func NewTTSOperations(apiKey string, cfg *config.Config) *TTSOperations {
	var client *elevenlabs.Client
	if apiKey != "" {
		// Use 120 second timeout for API calls (voice cloning can take time)
		client = elevenlabs.NewClient(context.Background(), apiKey, 120*time.Second)
	}
	return &TTSOperations{
		apiKey: apiKey,
		client: client,
		config: cfg,
	}
}

// CloneVoice creates a voice clone from an audio sample
func (t *TTSOperations) CloneVoice(ctx context.Context, opts VoiceCloneOptions) (string, error) {
	if t.client == nil {
		return "", fmt.Errorf("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY environment variable or update config")
	}

	// Create voice clone request
	req := elevenlabs.AddEditVoiceRequest{
		Name:        opts.Name,
		FilePaths:   []string{opts.AudioPath},
		Description: opts.Description,
	}

	// Call ElevenLabs API
	voiceID, err := t.client.AddVoice(req)
	if err != nil {
		return "", fmt.Errorf("failed to clone voice: %w", err)
	}

	// Cache the voice ID
	audioHash, err := t.hashAudioFile(opts.AudioPath)
	if err == nil {
		if t.config.ElevenLabsVoices == nil {
			t.config.ElevenLabsVoices = make(map[string]string)
		}
		t.config.ElevenLabsVoices[audioHash] = voiceID
		t.config.Save()
	}

	return voiceID, nil
}

// GenerateSpeech generates TTS audio and saves to file
func (t *TTSOperations) GenerateSpeech(ctx context.Context, opts SpeechOptions, outputPath string) error {
	if t.client == nil {
		return fmt.Errorf("ElevenLabs API key not configured")
	}

	// Set defaults
	if opts.ModelID == "" {
		opts.ModelID = "eleven_multilingual_v2"
	}
	if opts.Stability == 0 {
		opts.Stability = 0.5
	}
	if opts.Similarity == 0 {
		opts.Similarity = 0.75
	}

	// Create TTS request
	ttsReq := elevenlabs.TextToSpeechRequest{
		Text:    opts.Text,
		ModelID: opts.ModelID,
	}

	// Set voice settings
	if opts.Stability > 0 || opts.Similarity > 0 {
		ttsReq.VoiceSettings = &elevenlabs.VoiceSettings{
			Stability:       float32(opts.Stability),
			SimilarityBoost: float32(opts.Similarity),
		}
	}

	// Generate speech
	audioData, err := t.client.TextToSpeech(opts.VoiceID, ttsReq)
	if err != nil {
		return fmt.Errorf("failed to generate speech: %w", err)
	}

	// Save to file
	if err := os.WriteFile(outputPath, audioData, 0644); err != nil {
		return fmt.Errorf("failed to write audio file: %w", err)
	}

	return nil
}

// GetOrCreateVoiceID checks cache for existing voice ID or creates a new clone
func (t *TTSOperations) GetOrCreateVoiceID(ctx context.Context, audioPath string, name string) (string, error) {
	// Check cache first
	audioHash, err := t.hashAudioFile(audioPath)
	if err == nil {
		if voiceID, exists := t.config.ElevenLabsVoices[audioHash]; exists {
			// Verify voice still exists
			if t.verifyVoiceExists(voiceID) {
				return voiceID, nil
			}
			// Voice doesn't exist anymore, remove from cache
			delete(t.config.ElevenLabsVoices, audioHash)
			t.config.Save()
		}
	}

	// Clone new voice
	return t.CloneVoice(ctx, VoiceCloneOptions{
		Name:        name,
		AudioPath:   audioPath,
		Description: fmt.Sprintf("Voice cloned from %s", audioPath),
	})
}

// hashAudioFile creates SHA256 hash of audio file for caching
func (t *TTSOperations) hashAudioFile(audioPath string) (string, error) {
	file, err := os.Open(audioPath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

// verifyVoiceExists checks if a voice ID still exists in ElevenLabs
func (t *TTSOperations) verifyVoiceExists(voiceID string) bool {
	if t.client == nil {
		return false
	}

	_, err := t.client.GetVoice(voiceID)
	return err == nil
}

// CachedVoiceInfo contains information about a cached voice
type CachedVoiceInfo struct {
	AudioHash   string `json:"audioHash"`
	VoiceID     string `json:"voiceId"`
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`
	IsValid     bool   `json:"isValid"`
}

// ListCachedVoices returns all cached voice clones
func (t *TTSOperations) ListCachedVoices(ctx context.Context) ([]CachedVoiceInfo, error) {
	var voices []CachedVoiceInfo

	if t.config.ElevenLabsVoices == nil {
		return voices, nil
	}

	for hash, voiceID := range t.config.ElevenLabsVoices {
		info := CachedVoiceInfo{
			AudioHash: hash,
			VoiceID:   voiceID,
			IsValid:   false,
		}

		// Try to get voice details from ElevenLabs
		if t.client != nil {
			if voice, err := t.client.GetVoice(voiceID); err == nil {
				info.Name = voice.Name
				info.Description = voice.Description
				info.IsValid = true
			}
		}

		voices = append(voices, info)
	}

	return voices, nil
}

// ClearCachedVoice removes a specific voice from cache
func (t *TTSOperations) ClearCachedVoice(audioHash string) error {
	if t.config.ElevenLabsVoices == nil {
		return nil
	}

	delete(t.config.ElevenLabsVoices, audioHash)
	return t.config.Save()
}

// ClearAllCachedVoices removes all cached voices
func (t *TTSOperations) ClearAllCachedVoices() error {
	t.config.ElevenLabsVoices = make(map[string]string)
	return t.config.Save()
}

// GetCachedVoiceCount returns the number of cached voices
func (t *TTSOperations) GetCachedVoiceCount() int {
	if t.config.ElevenLabsVoices == nil {
		return 0
	}
	return len(t.config.ElevenLabsVoices)
}
