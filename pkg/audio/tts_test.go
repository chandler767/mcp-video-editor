package audio

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/chandler-mayo/mcp-video-editor/pkg/config"
)

func setupTTSTest(t *testing.T) (*TTSOperations, *config.Config, string) {
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	if cfg.ElevenLabsKey == "" {
		t.Fatal("ElevenLabs API key not configured - set it in ~/.mcp-video-config.json")
	}

	ops := NewTTSOperations(cfg.ElevenLabsKey, cfg)

	testDir := filepath.Join(os.TempDir(), "mcp-tts-test")
	os.MkdirAll(testDir, 0755)

	return ops, cfg, testDir
}

func createTestAudioForTTS(t *testing.T, path string) {
	// Create a 5 second test audio with sine wave (simulating voice)
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi",
		"-i", "sine=frequency=440:duration=5",
		"-f", "lavfi",
		"-i", "sine=frequency=880:duration=5",
		"-filter_complex", "[0][1]amix=inputs=2:duration=first",
		"-ar", "44100",
		"-ac", "1",
		"-b:a", "128k",
		"-y",
		path,
	)

	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to create test audio: %v", err)
	}
}

func TestNewTTSOperations(t *testing.T) {
	// Test that TTS operations can be created without API key
	cfg := &config.Config{}
	ops := NewTTSOperations("", cfg)

	if ops == nil {
		t.Error("NewTTSOperations should not return nil")
	}
}

func TestCloneVoice(t *testing.T) {
	ops, cfg, testDir := setupTTSTest(t)
	defer os.RemoveAll(testDir)

	// Create a test audio sample
	audioPath := filepath.Join(testDir, "voice_sample.mp3")
	createTestAudioForTTS(t, audioPath)

	ctx := context.Background()

	voiceID, err := ops.CloneVoice(ctx, VoiceCloneOptions{
		Name:        "Test Voice",
		AudioPath:   audioPath,
		Description: "Test voice for automated testing",
	})

	if err != nil {
		t.Fatalf("CloneVoice failed: %v", err)
	}

	if voiceID == "" {
		t.Error("Expected non-empty voice ID")
	}

	// Verify voice was cached
	if cfg.ElevenLabsVoices == nil {
		t.Error("Voice cache not initialized")
	}

	t.Logf("Successfully cloned voice with ID: %s", voiceID)
}

func TestGenerateSpeech(t *testing.T) {
	ops, _, testDir := setupTTSTest(t)
	defer os.RemoveAll(testDir)

	// First, create a test voice
	audioPath := filepath.Join(testDir, "voice_sample.mp3")
	createTestAudioForTTS(t, audioPath)

	ctx := context.Background()

	// Clone voice to get a valid voice ID
	voiceID, err := ops.CloneVoice(ctx, VoiceCloneOptions{
		Name:      "Test Voice for Speech",
		AudioPath: audioPath,
	})
	if err != nil {
		t.Fatalf("Failed to clone voice: %v", err)
	}

	// Generate speech with the cloned voice
	outputPath := filepath.Join(testDir, "generated_speech.mp3")
	err = ops.GenerateSpeech(ctx, SpeechOptions{
		Text:       "Hello, this is a test of text to speech generation.",
		VoiceID:    voiceID,
		Stability:  0.5,
		Similarity: 0.75,
	}, outputPath)

	if err != nil {
		t.Fatalf("GenerateSpeech failed: %v", err)
	}

	// Verify output file was created
	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Generated speech file was not created")
	}

	// Verify file has content
	info, err := os.Stat(outputPath)
	if err != nil {
		t.Fatalf("Failed to stat output file: %v", err)
	}
	if info.Size() == 0 {
		t.Error("Generated speech file is empty")
	}

	t.Logf("Successfully generated speech, file size: %d bytes", info.Size())
}

func TestGetOrCreateVoiceID(t *testing.T) {
	ops, _, testDir := setupTTSTest(t)
	defer os.RemoveAll(testDir)

	// Create test audio
	audioPath := filepath.Join(testDir, "voice_sample.mp3")
	createTestAudioForTTS(t, audioPath)

	ctx := context.Background()

	// First call should create the voice
	voiceID1, err := ops.GetOrCreateVoiceID(ctx, audioPath, "Test Speaker")
	if err != nil {
		t.Fatalf("GetOrCreateVoiceID (create) failed: %v", err)
	}

	if voiceID1 == "" {
		t.Error("Expected non-empty voice ID")
	}

	// Second call with same audio should return cached voice ID
	voiceID2, err := ops.GetOrCreateVoiceID(ctx, audioPath, "Test Speaker")
	if err != nil {
		t.Fatalf("GetOrCreateVoiceID (cached) failed: %v", err)
	}

	if voiceID1 != voiceID2 {
		t.Errorf("Expected cached voice ID to match: got %s, want %s", voiceID2, voiceID1)
	}

	t.Logf("Successfully tested voice caching, voice ID: %s", voiceID1)
}

func TestVoiceCaching(t *testing.T) {
	// Test that voice caching logic works without API calls
	cfg := &config.Config{
		ElevenLabsVoices: map[string]string{
			"test-hash-123": "voice-id-456",
		},
	}
	ops := NewTTSOperations("fake-key", cfg)

	// Verify cache is accessible
	if ops.config.ElevenLabsVoices["test-hash-123"] != "voice-id-456" {
		t.Error("Voice cache not properly initialized")
	}
}
