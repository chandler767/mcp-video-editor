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

func setupTest(t *testing.T) (*Operations, string) {
	ffmpegMgr, err := ffmpeg.NewManager("ffmpeg", "ffprobe")
	if err != nil {
		t.Skipf("Skipping test: FFmpeg not available: %v", err)
	}
	ops := NewOperations(ffmpegMgr)

	testDir := filepath.Join(os.TempDir(), "mcp-audio-test")
	os.MkdirAll(testDir, 0755)

	return ops, testDir
}

func cleanup(testDir string) {
	os.RemoveAll(testDir)
}

func createTestAudio(t *testing.T, path string, duration float64) {
	// Create a simple test audio using FFmpeg (sine wave)
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi",
		"-i", fmt.Sprintf("sine=frequency=440:duration=%.1f", duration),
		"-y",
		path,
	)

	if err := cmd.Run(); err != nil {
		t.Skipf("Skipping test: FFmpeg not available or failed to create test audio: %v", err)
	}
}

func TestTrimAudio(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testAudio := filepath.Join(testDir, "test.mp3")
	createTestAudio(t, testAudio, 5.0)

	outputPath := filepath.Join(testDir, "trimmed.mp3")
	ctx := context.Background()

	endTime := 3.0
	err := ops.TrimAudio(ctx, TrimOptions{
		Input:     testAudio,
		Output:    outputPath,
		StartTime: 1.0,
		EndTime:   &endTime,
	})

	if err != nil {
		t.Fatalf("TrimAudio failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestConcatenateAudio(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	// Create two test audio files
	audio1 := filepath.Join(testDir, "test1.mp3")
	audio2 := filepath.Join(testDir, "test2.mp3")
	createTestAudio(t, audio1, 2.0)
	createTestAudio(t, audio2, 2.0)

	outputPath := filepath.Join(testDir, "concatenated.mp3")
	ctx := context.Background()

	err := ops.ConcatenateAudio(ctx, ConcatenateOptions{
		Inputs: []string{audio1, audio2},
		Output: outputPath,
	})

	if err != nil {
		t.Fatalf("ConcatenateAudio failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestAdjustVolume(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testAudio := filepath.Join(testDir, "test.mp3")
	createTestAudio(t, testAudio, 3.0)

	outputPath := filepath.Join(testDir, "louder.mp3")
	ctx := context.Background()

	err := ops.AdjustVolume(ctx, VolumeOptions{
		Input:  testAudio,
		Output: outputPath,
		Volume: 3.0, // +3dB
	})

	if err != nil {
		t.Fatalf("AdjustVolume failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestNormalizeAudio(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testAudio := filepath.Join(testDir, "test.mp3")
	createTestAudio(t, testAudio, 3.0)

	outputPath := filepath.Join(testDir, "normalized.mp3")
	ctx := context.Background()

	err := ops.NormalizeAudio(ctx, testAudio, outputPath)

	if err != nil {
		t.Fatalf("NormalizeAudio failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestFadeAudio(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testAudio := filepath.Join(testDir, "test.mp3")
	createTestAudio(t, testAudio, 5.0)

	outputPath := filepath.Join(testDir, "faded.mp3")
	ctx := context.Background()

	// Test only fade in to avoid duration calculation issues in test
	err := ops.FadeAudio(ctx, FadeOptions{
		Input:   testAudio,
		Output:  outputPath,
		FadeIn:  1.0,
		FadeOut: 0,
	})

	if err != nil {
		t.Fatalf("FadeAudio failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestConvertAudio(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testAudio := filepath.Join(testDir, "test.mp3")
	createTestAudio(t, testAudio, 3.0)

	outputPath := filepath.Join(testDir, "converted.wav")
	ctx := context.Background()

	err := ops.ConvertAudio(ctx, ConvertOptions{
		Input:  testAudio,
		Output: outputPath,
		Format: "wav",
	})

	if err != nil {
		t.Fatalf("ConvertAudio failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestAdjustSpeed(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testAudio := filepath.Join(testDir, "test.mp3")
	createTestAudio(t, testAudio, 4.0)

	outputPath := filepath.Join(testDir, "faster.mp3")
	ctx := context.Background()

	err := ops.AdjustSpeed(ctx, SpeedOptions{
		Input:  testAudio,
		Output: outputPath,
		Speed:  1.5, // 1.5x faster
	})

	if err != nil {
		t.Fatalf("AdjustSpeed failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestRemoveAudioSection(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testAudio := filepath.Join(testDir, "test.mp3")
	createTestAudio(t, testAudio, 10.0)

	outputPath := filepath.Join(testDir, "removed.mp3")
	ctx := context.Background()

	err := ops.RemoveAudioSection(ctx, testAudio, outputPath, 3.0, 5.0)

	if err != nil {
		t.Fatalf("RemoveAudioSection failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestSplitAudio(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testAudio := filepath.Join(testDir, "test.mp3")
	createTestAudio(t, testAudio, 6.0)

	outputPattern := filepath.Join(testDir, "segment_%03d.mp3")
	ctx := context.Background()

	err := ops.SplitAudio(ctx, testAudio, 2.0, outputPattern)

	if err != nil {
		t.Fatalf("SplitAudio failed: %v", err)
	}

	// Check first segment exists
	firstSegment := filepath.Join(testDir, "segment_000.mp3")
	if _, err := os.Stat(firstSegment); os.IsNotExist(err) {
		t.Error("First segment file was not created")
	}
}

func TestReverseAudio(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testAudio := filepath.Join(testDir, "test.mp3")
	createTestAudio(t, testAudio, 3.0)

	outputPath := filepath.Join(testDir, "reversed.mp3")
	ctx := context.Background()

	err := ops.ReverseAudio(ctx, testAudio, outputPath)

	if err != nil {
		t.Fatalf("ReverseAudio failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestExtractAudioChannel(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testAudio := filepath.Join(testDir, "test.mp3")
	createTestAudio(t, testAudio, 3.0)

	outputPath := filepath.Join(testDir, "left_channel.mp3")
	ctx := context.Background()

	err := ops.ExtractAudioChannel(ctx, testAudio, outputPath, "left")

	if err != nil {
		t.Fatalf("ExtractAudioChannel failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestMixAudio(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	// Create two test audio files
	audio1 := filepath.Join(testDir, "test1.mp3")
	audio2 := filepath.Join(testDir, "test2.mp3")
	createTestAudio(t, audio1, 3.0)
	createTestAudio(t, audio2, 3.0)

	outputPath := filepath.Join(testDir, "mixed.mp3")
	ctx := context.Background()

	err := ops.MixAudio(ctx, MixOptions{
		Inputs:  []string{audio1, audio2},
		Output:  outputPath,
		Volumes: []float64{1.0, 0.5},
	})

	if err != nil {
		t.Fatalf("MixAudio failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}
