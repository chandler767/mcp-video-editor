package audio

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/chandler-mayo/mcp-video-editor/pkg/config"
	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
	"github.com/chandler-mayo/mcp-video-editor/pkg/transcript"
	"github.com/chandler-mayo/mcp-video-editor/pkg/video"
)

func TestNewReplacementOperations(t *testing.T) {
	ffmpegMgr, err := ffmpeg.NewManager("ffmpeg", "ffprobe")
	if err != nil {
		t.Fatalf("FFmpeg not available: %v", err)
	}

	ttsOps := NewTTSOperations("", nil)
	spliceOps := NewSpliceOperations(ffmpegMgr)
	transOps := transcript.NewOperations("", ffmpegMgr)
	videoOps := video.NewOperations(ffmpegMgr)

	ops := NewReplacementOperations(ttsOps, spliceOps, transOps, videoOps)

	if ops == nil {
		t.Error("NewReplacementOperations should not return nil")
	}

	if ops.tts == nil {
		t.Error("TTS operations should be initialized")
	}

	if ops.splice == nil {
		t.Error("Splice operations should be initialized")
	}

	if ops.trans == nil {
		t.Error("Transcript operations should be initialized")
	}

	if ops.videoOps == nil {
		t.Error("Video operations should be initialized")
	}
}

func createTestVideoWithAudio(t *testing.T, path string) {
	// Create a test video with audio (5 seconds, 640x480, with sine wave audio)
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi",
		"-i", "testsrc=duration=5:size=640x480:rate=30",
		"-f", "lavfi",
		"-i", "sine=frequency=440:duration=5",
		"-c:v", "libx264",
		"-c:a", "aac",
		"-b:a", "128k",
		"-pix_fmt", "yuv420p",
		"-y",
		path,
	)

	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to create test video: %v", err)
	}
}

func TestReplaceWord(t *testing.T) {
	// Load config to check for API keys
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	if cfg.OpenAIKey == "" {
		t.Fatal("OpenAI API key not configured - set it in ~/.mcp-video-config.json")
	}

	if cfg.ElevenLabsKey == "" {
		t.Fatal("ElevenLabs API key not configured - set it in ~/.mcp-video-config.json")
	}

	// Setup
	ffmpegMgr, err := ffmpeg.NewManager("ffmpeg", "ffprobe")
	if err != nil {
		t.Fatalf("FFmpeg not available: %v", err)
	}

	ttsOps := NewTTSOperations(cfg.ElevenLabsKey, cfg)
	videoOps := video.NewOperations(ffmpegMgr)

	testDir := filepath.Join(os.TempDir(), "mcp-replacement-test")
	os.MkdirAll(testDir, 0755)
	defer os.RemoveAll(testDir)

	// Create test video with audio
	inputVideo := filepath.Join(testDir, "test_video.mp4")
	createTestVideoWithAudio(t, inputVideo)

	// Create voice sample for cloning
	voiceSample := filepath.Join(testDir, "voice_sample.mp3")
	// Use longer timeout for API calls
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi",
		"-i", "sine=frequency=440:duration=5",
		"-f", "lavfi",
		"-i", "sine=frequency=880:duration=5",
		"-filter_complex", "[0][1]amix=inputs=2:duration=first",
		"-c:a", "libmp3lame",
		"-b:a", "128k",
		"-y",
		voiceSample,
	)
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to create voice sample: %v", err)
	}

	// First clone a voice to get a voice ID
	voiceID, err := ttsOps.CloneVoice(ctx, VoiceCloneOptions{
		Name:        "Test Voice for Replacement",
		AudioPath:   voiceSample,
		Description: "Test voice for word replacement integration test",
	})
	if err != nil {
		t.Fatalf("Failed to clone voice: %v", err)
	}

	if voiceID == "" {
		t.Fatal("Voice ID is empty")
	}

	t.Logf("Cloned voice with ID: %s", voiceID)

	// Note: The actual word replacement test would need a real video with speech
	// and a transcript with actual words to replace. Since we're using synthetic
	// audio (sine waves), the transcription will likely return empty or nonsense.
	// For now, we verify the workflow is set up correctly by testing the
	// individual components have been initialized properly.

	// Test that we can extract audio from the video
	audioPath := filepath.Join(testDir, "extracted_audio.mp3")
	err = videoOps.ExtractAudio(ctx, video.ExtractAudioOptions{
		Input:  inputVideo,
		Output: audioPath,
	})
	if err != nil {
		t.Fatalf("Failed to extract audio: %v", err)
	}

	if _, err := os.Stat(audioPath); os.IsNotExist(err) {
		t.Fatal("Extracted audio file was not created")
	}

	// Test that we can generate TTS with the cloned voice
	ttsPath := filepath.Join(testDir, "tts_output.mp3")
	err = ttsOps.GenerateSpeech(ctx, SpeechOptions{
		Text:       "test replacement",
		VoiceID:    voiceID,
		Stability:  0.5,
		Similarity: 0.75,
	}, ttsPath)
	if err != nil {
		t.Fatalf("Failed to generate TTS: %v", err)
	}

	if _, err := os.Stat(ttsPath); os.IsNotExist(err) {
		t.Fatal("TTS output file was not created")
	}

	t.Log("Word replacement workflow components verified successfully")
	t.Log("Note: Full end-to-end test with real speech would require a test video with spoken words")
}
