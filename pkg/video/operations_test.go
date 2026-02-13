package video

import (
	"context"
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

	testDir := filepath.Join(os.TempDir(), "mcp-video-test")
	os.MkdirAll(testDir, 0755)

	return ops, testDir
}

func cleanup(testDir string) {
	os.RemoveAll(testDir)
}

func createTestVideo(t *testing.T, path string) {
	// Create a simple test video using FFmpeg
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi",
		"-i", "testsrc=duration=5:size=640x480:rate=30",
		"-f", "lavfi",
		"-i", "sine=frequency=1000:duration=5",
		"-pix_fmt", "yuv420p",
		"-y",
		path,
	)

	if err := cmd.Run(); err != nil {
		t.Skipf("Skipping test: FFmpeg not available or failed to create test video: %v", err)
	}
}

func TestGetVideoInfo(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	ctx := context.Background()
	info, err := ops.GetVideoInfo(ctx, testVideo)
	if err != nil {
		t.Fatalf("GetVideoInfo failed: %v", err)
	}

	if info.Duration <= 0 {
		t.Errorf("Expected duration > 0, got %f", info.Duration)
	}
	if info.Width != 640 {
		t.Errorf("Expected width 640, got %d", info.Width)
	}
	if info.Height != 480 {
		t.Errorf("Expected height 480, got %d", info.Height)
	}
}

func TestTrim(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	outputPath := filepath.Join(testDir, "trimmed.mp4")
	ctx := context.Background()

	endTime := 3.0
	err := ops.Trim(ctx, TrimOptions{
		Input:     testVideo,
		Output:    outputPath,
		StartTime: 1.0,
		EndTime:   &endTime,
	})

	if err != nil {
		t.Fatalf("Trim failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}

	// Verify duration
	info, err := ops.GetVideoInfo(ctx, outputPath)
	if err != nil {
		t.Fatalf("Failed to get info for trimmed video: %v", err)
	}

	expectedDuration := 2.0
	if info.Duration < expectedDuration-0.5 || info.Duration > expectedDuration+0.5 {
		t.Errorf("Expected duration ~%f, got %f", expectedDuration, info.Duration)
	}
}

func TestResize(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	outputPath := filepath.Join(testDir, "resized.mp4")
	ctx := context.Background()

	err := ops.Resize(ctx, ResizeOptions{
		Input:  testVideo,
		Output: outputPath,
		Width:  320,
		Height: 240,
	})

	if err != nil {
		t.Fatalf("Resize failed: %v", err)
	}

	// Verify dimensions
	info, err := ops.GetVideoInfo(ctx, outputPath)
	if err != nil {
		t.Fatalf("Failed to get info for resized video: %v", err)
	}

	if info.Width != 320 || info.Height != 240 {
		t.Errorf("Expected 320x240, got %dx%d", info.Width, info.Height)
	}
}

func TestExtractAudio(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	outputPath := filepath.Join(testDir, "audio.mp3")
	ctx := context.Background()

	err := ops.ExtractAudio(ctx, ExtractAudioOptions{
		Input:  testVideo,
		Output: outputPath,
	})

	if err != nil {
		t.Fatalf("ExtractAudio failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Audio file was not created")
	}
}

func TestConcatenate(t *testing.T) {
	ops, testDir := setupTest(t)
	defer cleanup(testDir)

	// Create two test videos
	video1 := filepath.Join(testDir, "test1.mp4")
	video2 := filepath.Join(testDir, "test2.mp4")
	createTestVideo(t, video1)
	createTestVideo(t, video2)

	outputPath := filepath.Join(testDir, "concatenated.mp4")
	ctx := context.Background()

	err := ops.Concatenate(ctx, ConcatenateOptions{
		Inputs: []string{video1, video2},
		Output: outputPath,
	})

	if err != nil {
		t.Fatalf("Concatenate failed: %v", err)
	}

	// Verify duration is roughly sum of inputs
	info, err := ops.GetVideoInfo(ctx, outputPath)
	if err != nil {
		t.Fatalf("Failed to get info for concatenated video: %v", err)
	}

	expectedDuration := 10.0 // 5 + 5 seconds
	if info.Duration < expectedDuration-1.0 || info.Duration > expectedDuration+1.0 {
		t.Errorf("Expected duration ~%f, got %f", expectedDuration, info.Duration)
	}
}
