package audio

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
)

func setupSpliceTest(t *testing.T) (*SpliceOperations, string) {
	ffmpegMgr, err := ffmpeg.NewManager("ffmpeg", "ffprobe")
	if err != nil {
		t.Skipf("Skipping test: FFmpeg not available: %v", err)
	}
	ops := NewSpliceOperations(ffmpegMgr)

	testDir := filepath.Join(os.TempDir(), "mcp-splice-test")
	os.MkdirAll(testDir, 0755)

	return ops, testDir
}

func createSpliceTestAudio(t *testing.T, path string, duration float64, frequency int) {
	// Create a test audio with specific frequency and proper duration metadata
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi",
		"-i", fmt.Sprintf("sine=frequency=%d:duration=%.1f", frequency, duration),
		"-c:a", "libmp3lame",
		"-b:a", "128k",
		"-ar", "44100",
		"-ac", "2",
		"-y",
		path,
	)

	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to create test audio: %v", err)
	}
}

func TestReplaceSegmentMiddle(t *testing.T) {
	ops, testDir := setupSpliceTest(t)
	defer cleanup(testDir)

	// Create test audio files with sufficient duration using MP3 format
	inputAudio := filepath.Join(testDir, "input.mp3")
	replacementAudio := filepath.Join(testDir, "replacement.mp3")
	outputPath := filepath.Join(testDir, "spliced.mp3")

	ctx := context.Background()

	// Create input audio as MP3 with proper encoding
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi",
		"-i", "sine=frequency=440:duration=10.0",
		"-c:a", "libmp3lame",
		"-b:a", "128k",
		"-ar", "44100",
		"-ac", "2",
		"-t", "10",
		"-y",
		inputAudio,
	)
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to create input audio: %v", err)
	}

	// Create replacement audio as MP3 with proper encoding
	cmd = exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi",
		"-i", "sine=frequency=880:duration=2.0",
		"-c:a", "libmp3lame",
		"-b:a", "128k",
		"-ar", "44100",
		"-ac", "2",
		"-t", "2",
		"-y",
		replacementAudio,
	)
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to create replacement audio: %v", err)
	}

	// Verify files were created
	if _, err := os.Stat(inputAudio); os.IsNotExist(err) {
		t.Fatal("Input audio file was not created")
	}
	if _, err := os.Stat(replacementAudio); os.IsNotExist(err) {
		t.Fatal("Replacement audio file was not created")
	}

	// Replace segment in the middle (4.0 to 6.0)
	err := ops.ReplaceSegment(ctx, SpliceOptions{
		InputAudio:      inputAudio,
		OutputAudio:     outputPath,
		ReplacementPath: replacementAudio,
		StartTime:       4.0,
		EndTime:         6.0,
		CrossfadeDur:    0.05,
	})

	if err != nil {
		t.Fatalf("ReplaceSegment failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestConcatenateWithCrossfade(t *testing.T) {
	ops, testDir := setupSpliceTest(t)
	defer cleanup(testDir)

	// Create three test audio files
	before := filepath.Join(testDir, "before.mp3")
	middle := filepath.Join(testDir, "middle.mp3")
	after := filepath.Join(testDir, "after.mp3")
	createSpliceTestAudio(t, before, 2.0, 440)
	createSpliceTestAudio(t, middle, 1.0, 880)
	createSpliceTestAudio(t, after, 2.0, 440)

	outputPath := filepath.Join(testDir, "concatenated.mp3")
	ctx := context.Background()

	// Test the concatenation with crossfade
	err := ops.concatenateWithCrossfade(ctx, before, middle, after, outputPath, 0.05, 2.0, 3.0, 5.0)

	if err != nil {
		t.Fatalf("concatenateWithCrossfade failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}
