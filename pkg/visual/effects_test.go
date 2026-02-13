package visual

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
)

func setupTest(t *testing.T) (*Effects, string) {
	ffmpegMgr, err := ffmpeg.NewManager("ffmpeg", "ffprobe")
	if err != nil {
		t.Skipf("Skipping test: FFmpeg not available: %v", err)
	}
	effects := NewEffects(ffmpegMgr)

	testDir := filepath.Join(os.TempDir(), "mcp-visual-test")
	os.MkdirAll(testDir, 0755)

	return effects, testDir
}

func cleanup(testDir string) {
	os.RemoveAll(testDir)
}

func createTestVideo(t *testing.T, path string) {
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi",
		"-i", "testsrc=duration=3:size=640x480:rate=30",
		"-pix_fmt", "yuv420p",
		"-y",
		path,
	)

	if err := cmd.Run(); err != nil {
		t.Skipf("Skipping test: FFmpeg not available: %v", err)
	}
}

func TestApplyBlur(t *testing.T) {
	effects, testDir := setupTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	outputPath := filepath.Join(testDir, "blurred.mp4")
	ctx := context.Background()

	err := effects.ApplyBlur(ctx, BlurOptions{
		Input:    testVideo,
		Output:   outputPath,
		Type:     "gaussian",
		Strength: 5.0,
	})

	if err != nil {
		t.Fatalf("ApplyBlur failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestApplyColorGrade(t *testing.T) {
	effects, testDir := setupTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	outputPath := filepath.Join(testDir, "graded.mp4")
	ctx := context.Background()

	brightness := 0.1
	contrast := 0.2
	saturation := 0.15

	err := effects.ApplyColorGrade(ctx, ColorGradeOptions{
		Input:      testVideo,
		Output:     outputPath,
		Brightness: &brightness,
		Contrast:   &contrast,
		Saturation: &saturation,
	})

	if err != nil {
		t.Fatalf("ApplyColorGrade failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestApplyVignette(t *testing.T) {
	effects, testDir := setupTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	outputPath := filepath.Join(testDir, "vignetted.mp4")
	ctx := context.Background()

	err := effects.ApplyVignette(ctx, VignetteOptions{
		Input:     testVideo,
		Output:    outputPath,
		Intensity: 0.8,
	})

	if err != nil {
		t.Fatalf("ApplyVignette failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestApplySharpen(t *testing.T) {
	effects, testDir := setupTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	outputPath := filepath.Join(testDir, "sharpened.mp4")
	ctx := context.Background()

	err := effects.ApplySharpen(ctx, SharpenOptions{
		Input:    testVideo,
		Output:   outputPath,
		Strength: 1.5,
	})

	if err != nil {
		t.Fatalf("ApplySharpen failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}

func TestApplyChromaKey(t *testing.T) {
	effects, testDir := setupTest(t)
	defer cleanup(testDir)

	// Create a green screen test video
	testVideo := filepath.Join(testDir, "greenscreen.mp4")
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi",
		"-i", "color=c=green:s=640x480:d=3",
		"-pix_fmt", "yuv420p",
		"-y",
		testVideo,
	)
	if err := cmd.Run(); err != nil {
		t.Skipf("Skipping test: FFmpeg not available: %v", err)
	}

	outputPath := filepath.Join(testDir, "keyed.mp4")

	err := effects.ApplyChromaKey(ctx, ChromaKeyOptions{
		Input:     testVideo,
		Output:    outputPath,
		KeyColor:  "green",
		Similarity: 0.3,
	})

	if err != nil {
		t.Fatalf("ApplyChromaKey failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}
}
