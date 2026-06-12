package multitake

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
)

func setupManagerTest(t *testing.T) (*Manager, string) {
	t.Helper()

	testDir := t.TempDir()
	ffmpegMgr, err := ffmpeg.NewManager("ffmpeg", "ffprobe")
	if err != nil {
		t.Skipf("Skipping test: FFmpeg not available: %v", err)
	}

	return NewManagerWithFFmpeg(filepath.Join(testDir, "projects"), ffmpegMgr), testDir
}

func createMultiTakeTestVideo(t *testing.T, path string) {
	t.Helper()

	cmd := exec.CommandContext(context.Background(), "ffmpeg",
		"-f", "lavfi",
		"-i", "testsrc=duration=1:size=320x240:rate=30",
		"-f", "lavfi",
		"-i", "sine=frequency=1000:duration=1",
		"-pix_fmt", "yuv420p",
		"-y",
		path,
	)
	if err := cmd.Run(); err != nil {
		t.Skipf("Skipping test: FFmpeg could not create fixture video: %v", err)
	}
}

func TestAssembleFinalRendersSelectedTakes(t *testing.T) {
	manager, testDir := setupManagerTest(t)

	video1 := filepath.Join(testDir, "take1.mp4")
	video2 := filepath.Join(testDir, "take2.mp4")
	createMultiTakeTestVideo(t, video1)
	createMultiTakeTestVideo(t, video2)

	projectRoot := filepath.Join(testDir, "project")
	project, err := manager.CreateProject("test project", "line one\nline two", &projectRoot)
	if err != nil {
		t.Fatalf("CreateProject failed: %v", err)
	}
	project.BestTakes = []BestTake{
		{SectionID: "section-1", TakeID: "take-1", FilePath: video1, Score: 90},
		{SectionID: "section-2", TakeID: "take-2", FilePath: video2, Score: 88},
	}

	outputPath := filepath.Join(testDir, "assembled.mp4")
	if err := manager.AssembleFinal(project, outputPath); err != nil {
		t.Fatalf("AssembleFinal failed: %v", err)
	}

	info, err := os.Stat(outputPath)
	if err != nil {
		t.Fatalf("Expected assembled output file: %v", err)
	}
	if info.Size() == 0 {
		t.Fatal("Expected assembled output to be non-empty")
	}
	if project.Status != "complete" {
		t.Fatalf("Expected project status complete, got %q", project.Status)
	}

	loaded, err := manager.LoadProject(project.ID)
	if err != nil {
		t.Fatalf("LoadProject failed: %v", err)
	}
	if loaded.Status != "complete" {
		t.Fatalf("Expected saved project status complete, got %q", loaded.Status)
	}
}

func TestAssembleFinalRendersSingleSelectedTake(t *testing.T) {
	manager, testDir := setupManagerTest(t)

	videoPath := filepath.Join(testDir, "take.mp4")
	createMultiTakeTestVideo(t, videoPath)

	projectRoot := filepath.Join(testDir, "single-project")
	project, err := manager.CreateProject("single project", "line one", &projectRoot)
	if err != nil {
		t.Fatalf("CreateProject failed: %v", err)
	}
	project.BestTakes = []BestTake{
		{SectionID: "section-1", TakeID: "take-1", FilePath: videoPath, Score: 90},
	}

	outputPath := filepath.Join(testDir, "single.mp4")
	if err := manager.AssembleFinal(project, outputPath); err != nil {
		t.Fatalf("AssembleFinal failed: %v", err)
	}

	info, err := os.Stat(outputPath)
	if err != nil {
		t.Fatalf("Expected assembled output file: %v", err)
	}
	if info.Size() == 0 {
		t.Fatal("Expected assembled output to be non-empty")
	}
}

func TestAssembleFinalRejectsNoBestTakes(t *testing.T) {
	manager, testDir := setupManagerTest(t)

	projectRoot := filepath.Join(testDir, "empty-project")
	project, err := manager.CreateProject("empty project", "line one", &projectRoot)
	if err != nil {
		t.Fatalf("CreateProject failed: %v", err)
	}

	err = manager.AssembleFinal(project, filepath.Join(testDir, "empty.mp4"))
	if err == nil {
		t.Fatal("Expected AssembleFinal to reject projects without best takes")
	}
	if project.Status == "complete" {
		t.Fatal("Project should not be marked complete after failed assembly")
	}
}

func TestAssembleFinalRejectsMissingSelectedFile(t *testing.T) {
	manager, testDir := setupManagerTest(t)

	projectRoot := filepath.Join(testDir, "missing-project")
	project, err := manager.CreateProject("missing project", "line one", &projectRoot)
	if err != nil {
		t.Fatalf("CreateProject failed: %v", err)
	}
	project.BestTakes = []BestTake{
		{SectionID: "section-1", TakeID: "missing", FilePath: filepath.Join(testDir, "missing.mp4"), Score: 90},
	}

	err = manager.AssembleFinal(project, filepath.Join(testDir, "missing-output.mp4"))
	if err == nil {
		t.Fatal("Expected AssembleFinal to reject missing selected files")
	}
	if !strings.Contains(err.Error(), "selected take file not found") {
		t.Fatalf("Expected missing file error, got: %v", err)
	}
	if project.Status == "complete" {
		t.Fatal("Project should not be marked complete after failed assembly")
	}
}

func TestAssembleFinalRejectsDirectoryOutput(t *testing.T) {
	manager, testDir := setupManagerTest(t)

	videoPath := filepath.Join(testDir, "take.mp4")
	createMultiTakeTestVideo(t, videoPath)

	projectRoot := filepath.Join(testDir, "directory-output-project")
	project, err := manager.CreateProject("directory output project", "line one", &projectRoot)
	if err != nil {
		t.Fatalf("CreateProject failed: %v", err)
	}
	project.BestTakes = []BestTake{
		{SectionID: "section-1", TakeID: "take-1", FilePath: videoPath, Score: 90},
	}

	outputPath := filepath.Join(testDir, "output-directory")
	if err := os.Mkdir(outputPath, 0755); err != nil {
		t.Fatalf("Failed to create output directory fixture: %v", err)
	}

	err = manager.AssembleFinal(project, outputPath)
	if err == nil {
		t.Fatal("Expected AssembleFinal to reject directory output")
	}
	if project.Status == "complete" {
		t.Fatal("Project should not be marked complete after failed assembly")
	}
}
