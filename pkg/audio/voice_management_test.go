package audio

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/chandler-mayo/mcp-video-editor/pkg/config"
)

func setupVoiceManagementTest(t *testing.T) (*TTSOperations, *config.Config, string) {
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	if cfg.ElevenLabsKey == "" {
		t.Fatal("ElevenLabs API key not configured - set it in ~/.mcp-video-config.json")
	}

	ops := NewTTSOperations(cfg.ElevenLabsKey, cfg)

	testDir := filepath.Join(os.TempDir(), "mcp-voice-mgmt-test")
	os.MkdirAll(testDir, 0755)

	return ops, cfg, testDir
}

func createTestVoice(t *testing.T, path string) {
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi",
		"-i", "sine=frequency=440:duration=3",
		"-f", "lavfi",
		"-i", "sine=frequency=880:duration=3",
		"-filter_complex", "[0][1]amix=inputs=2:duration=first",
		"-ar", "44100",
		"-ac", "1",
		"-b:a", "128k",
		"-y",
		path,
	)

	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to create test voice: %v", err)
	}
}

func TestListCachedVoices(t *testing.T) {
	ops, _, testDir := setupVoiceManagementTest(t)
	defer os.RemoveAll(testDir)

	// Create and clone a test voice
	audioPath := filepath.Join(testDir, "voice.mp3")
	createTestVoice(t, audioPath)

	ctx := context.Background()
	voiceID, err := ops.CloneVoice(ctx, VoiceCloneOptions{
		Name:        "Test Voice Management",
		AudioPath:   audioPath,
		Description: "Voice for testing management features",
	})
	if err != nil {
		t.Fatalf("Failed to clone voice: %v", err)
	}

	// List cached voices
	voices, err := ops.ListCachedVoices(ctx)
	if err != nil {
		t.Fatalf("Failed to list cached voices: %v", err)
	}

	if len(voices) == 0 {
		t.Error("Expected at least one cached voice")
	}

	// Verify the voice we just created is in the list
	found := false
	for _, voice := range voices {
		if voice.VoiceID == voiceID {
			found = true
			if voice.Name != "Test Voice Management" {
				t.Errorf("Expected voice name 'Test Voice Management', got %s", voice.Name)
			}
			if !voice.IsValid {
				t.Error("Expected voice to be valid")
			}
			t.Logf("Found cached voice: ID=%s, Name=%s, Hash=%s", voice.VoiceID, voice.Name, voice.AudioHash)
		}
	}

	if !found {
		t.Error("Newly cloned voice not found in cache list")
	}
}

func TestClearCachedVoice(t *testing.T) {
	ops, _, testDir := setupVoiceManagementTest(t)
	defer os.RemoveAll(testDir)

	// Create and clone a test voice
	audioPath := filepath.Join(testDir, "voice.mp3")
	createTestVoice(t, audioPath)

	ctx := context.Background()
	_, err := ops.CloneVoice(ctx, VoiceCloneOptions{
		Name:      "Voice to Clear",
		AudioPath: audioPath,
	})
	if err != nil {
		t.Fatalf("Failed to clone voice: %v", err)
	}

	// Get the audio hash
	audioHash, err := ops.hashAudioFile(audioPath)
	if err != nil {
		t.Fatalf("Failed to hash audio file: %v", err)
	}

	// Verify it's cached
	initialCount := ops.GetCachedVoiceCount()
	if initialCount == 0 {
		t.Error("Expected at least one cached voice before clearing")
	}

	// Clear the specific voice
	err = ops.ClearCachedVoice(audioHash)
	if err != nil {
		t.Fatalf("Failed to clear cached voice: %v", err)
	}

	// Verify it was removed
	newCount := ops.GetCachedVoiceCount()
	if newCount >= initialCount {
		t.Errorf("Expected voice count to decrease, was %d, now %d", initialCount, newCount)
	}

	// Verify it's no longer in the cache
	voices, _ := ops.ListCachedVoices(ctx)
	for _, voice := range voices {
		if voice.AudioHash == audioHash {
			t.Error("Voice should have been removed from cache")
		}
	}

	t.Logf("Successfully cleared voice with hash %s", audioHash)
}

func TestClearAllCachedVoices(t *testing.T) {
	ops, cfg, testDir := setupVoiceManagementTest(t)
	defer os.RemoveAll(testDir)

	// Save initial cache state
	initialVoices := make(map[string]string)
	if cfg.ElevenLabsVoices != nil {
		for k, v := range cfg.ElevenLabsVoices {
			initialVoices[k] = v
		}
	}

	// Create and clone a test voice
	audioPath := filepath.Join(testDir, "voice.mp3")
	createTestVoice(t, audioPath)

	ctx := context.Background()
	_, err := ops.CloneVoice(ctx, VoiceCloneOptions{
		Name:      "Voice to Clear All",
		AudioPath: audioPath,
	})
	if err != nil {
		t.Fatalf("Failed to clone voice: %v", err)
	}

	// Verify we have at least one voice cached
	if ops.GetCachedVoiceCount() == 0 {
		t.Error("Expected at least one cached voice")
	}

	// Clear all cached voices
	err = ops.ClearAllCachedVoices()
	if err != nil {
		t.Fatalf("Failed to clear all cached voices: %v", err)
	}

	// Verify cache is empty
	if ops.GetCachedVoiceCount() != 0 {
		t.Errorf("Expected 0 cached voices, got %d", ops.GetCachedVoiceCount())
	}

	voices, _ := ops.ListCachedVoices(ctx)
	if len(voices) != 0 {
		t.Errorf("Expected empty voice list, got %d voices", len(voices))
	}

	// Restore initial cache state for other tests
	cfg.ElevenLabsVoices = initialVoices
	cfg.Save()

	t.Log("Successfully cleared all cached voices")
}

func TestGetCachedVoiceCount(t *testing.T) {
	ops, _, testDir := setupVoiceManagementTest(t)
	defer os.RemoveAll(testDir)

	initialCount := ops.GetCachedVoiceCount()

	// Create and clone a test voice
	audioPath := filepath.Join(testDir, "voice.mp3")
	createTestVoice(t, audioPath)

	ctx := context.Background()
	_, err := ops.CloneVoice(ctx, VoiceCloneOptions{
		Name:      "Count Test Voice",
		AudioPath: audioPath,
	})
	if err != nil {
		t.Fatalf("Failed to clone voice: %v", err)
	}

	newCount := ops.GetCachedVoiceCount()
	if newCount != initialCount+1 {
		t.Errorf("Expected count to increase by 1, was %d, now %d", initialCount, newCount)
	}

	t.Logf("Voice count: %d -> %d after cloning", initialCount, newCount)
}
