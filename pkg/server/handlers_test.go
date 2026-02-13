package server

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/chandler-mayo/mcp-video-editor/pkg/config"
)

func setupServerTest(t *testing.T) (*MCPServer, string) {
	cfg := &config.Config{
		FFmpegPath:  "ffmpeg",
		FFprobePath: "ffprobe",
	}
	server, err := NewMCPServer(cfg)
	if err != nil {
		t.Skipf("Skipping test: Cannot initialize MCP server: %v", err)
	}

	testDir := filepath.Join(os.TempDir(), "mcp-server-test")
	os.MkdirAll(testDir, 0755)

	return server, testDir
}

func cleanup(testDir string) {
	os.RemoveAll(testDir)
}

func createTestVideo(t *testing.T, path string) {
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
		t.Skipf("Skipping test: FFmpeg not available: %v", err)
	}
}

func TestHandleGetVideoInfo(t *testing.T) {
	server, testDir := setupServerTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	result, err := server.handleGetVideoInfo(map[string]interface{}{
		"input": testVideo,
	})

	if err != nil {
		t.Fatalf("handleGetVideoInfo failed: %v", err)
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}
}

func TestHandleTrimVideo(t *testing.T) {
	server, testDir := setupServerTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	outputPath := filepath.Join(testDir, "trimmed.mp4")

	result, err := server.handleTrimVideo(map[string]interface{}{
		"input":  testVideo,
		"output": outputPath,
		"start":  1.0,
		"end":    3.0,
	})

	if err != nil {
		t.Fatalf("handleTrimVideo failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}
}

func TestHandleResizeVideo(t *testing.T) {
	server, testDir := setupServerTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	outputPath := filepath.Join(testDir, "resized.mp4")

	result, err := server.handleResizeVideo(map[string]interface{}{
		"input":  testVideo,
		"output": outputPath,
		"width":  320,
		"height": 240,
	})

	if err != nil {
		t.Fatalf("handleResizeVideo failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}
}

func TestHandleApplyBlur(t *testing.T) {
	server, testDir := setupServerTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	outputPath := filepath.Join(testDir, "blurred.mp4")

	result, err := server.handleApplyBlur(map[string]interface{}{
		"input":    testVideo,
		"output":   outputPath,
		"type":     "gaussian",
		"strength": 5.0,
	})

	if err != nil {
		t.Fatalf("handleApplyBlur failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}
}

func TestHandleApplyColorGrade(t *testing.T) {
	server, testDir := setupServerTest(t)
	defer cleanup(testDir)

	testVideo := filepath.Join(testDir, "test.mp4")
	createTestVideo(t, testVideo)

	outputPath := filepath.Join(testDir, "graded.mp4")

	result, err := server.handleApplyColorGrade(map[string]interface{}{
		"input":      testVideo,
		"output":     outputPath,
		"brightness": 0.1,
		"contrast":   0.2,
		"saturation": 0.15,
	})

	if err != nil {
		t.Fatalf("handleApplyColorGrade failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}
}

func TestHandleConcatenateVideos(t *testing.T) {
	server, testDir := setupServerTest(t)
	defer cleanup(testDir)

	video1 := filepath.Join(testDir, "test1.mp4")
	video2 := filepath.Join(testDir, "test2.mp4")
	createTestVideo(t, video1)
	createTestVideo(t, video2)

	outputPath := filepath.Join(testDir, "concatenated.mp4")

	result, err := server.handleConcatenateVideos(map[string]interface{}{
		"inputs": []interface{}{video1, video2},
		"output": outputPath,
	})

	if err != nil {
		t.Fatalf("handleConcatenateVideos failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}
}

func TestHandleCreatePictureInPicture(t *testing.T) {
	server, testDir := setupServerTest(t)
	defer cleanup(testDir)

	mainVideo := filepath.Join(testDir, "main.mp4")
	pipVideo := filepath.Join(testDir, "pip.mp4")
	createTestVideo(t, mainVideo)
	createTestVideo(t, pipVideo)

	outputPath := filepath.Join(testDir, "pip-result.mp4")

	result, err := server.handleCreatePictureInPicture(map[string]interface{}{
		"mainVideo": mainVideo,
		"pipVideo":  pipVideo,
		"output":    outputPath,
		"position":  "bottom-right",
	})

	if err != nil {
		t.Fatalf("handleCreatePictureInPicture failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}
}

func TestHandleCreateSplitScreen(t *testing.T) {
	server, testDir := setupServerTest(t)
	defer cleanup(testDir)

	video1 := filepath.Join(testDir, "split1.mp4")
	video2 := filepath.Join(testDir, "split2.mp4")
	createTestVideo(t, video1)
	createTestVideo(t, video2)

	outputPath := filepath.Join(testDir, "split-result.mp4")

	result, err := server.handleCreateSplitScreen(map[string]interface{}{
		"videos": []interface{}{video1, video2},
		"output": outputPath,
		"layout": "horizontal",
	})

	if err != nil {
		t.Fatalf("handleCreateSplitScreen failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}
}

func TestHandleAddTransition(t *testing.T) {
	server, testDir := setupServerTest(t)
	defer cleanup(testDir)

	video1 := filepath.Join(testDir, "trans1.mp4")
	video2 := filepath.Join(testDir, "trans2.mp4")
	createTestVideo(t, video1)
	createTestVideo(t, video2)

	outputPath := filepath.Join(testDir, "transition-result.mp4")

	result, err := server.handleAddTransition(map[string]interface{}{
		"input1":   video1,
		"input2":   video2,
		"output":   outputPath,
		"type":     "fade",
		"duration": 1.0,
	})

	if err != nil {
		t.Fatalf("handleAddTransition failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created")
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}
}
