package ffmpeg

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

// Manager handles FFmpeg operations
type Manager struct {
	ffmpegPath  string
	ffprobePath string
}

// NewManager creates a new FFmpeg manager
func NewManager(ffmpegPath, ffprobePath string) (*Manager, error) {
	m := &Manager{
		ffmpegPath:  ffmpegPath,
		ffprobePath: ffprobePath,
	}

	// Find FFmpeg if not specified
	if m.ffmpegPath == "" {
		path, err := exec.LookPath("ffmpeg")
		if err != nil {
			return nil, fmt.Errorf("ffmpeg not found in PATH: %w", err)
		}
		m.ffmpegPath = path
	}

	// Find FFprobe if not specified
	if m.ffprobePath == "" {
		path, err := exec.LookPath("ffprobe")
		if err != nil {
			// Try to find ffprobe in the same directory as ffmpeg
			ffmpegDir := filepath.Dir(m.ffmpegPath)
			probePath := filepath.Join(ffmpegDir, "ffprobe")
			if _, err := exec.LookPath(probePath); err == nil {
				m.ffprobePath = probePath
			}
		} else {
			m.ffprobePath = path
		}
	}

	// Verify FFmpeg works
	if err := m.verifyFFmpeg(); err != nil {
		return nil, err
	}

	return m, nil
}

// verifyFFmpeg checks if FFmpeg is working
func (m *Manager) verifyFFmpeg() error {
	cmd := exec.Command(m.ffmpegPath, "-version")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ffmpeg verification failed: %w", err)
	}

	// Check output contains "ffmpeg version"
	if !strings.Contains(string(output), "ffmpeg version") {
		return fmt.Errorf("ffmpeg verification failed: invalid output")
	}

	return nil
}

// Execute runs an FFmpeg command
func (m *Manager) Execute(ctx context.Context, args ...string) error {
	cmd := exec.CommandContext(ctx, m.ffmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ffmpeg command failed: %w\nOutput: %s", err, string(output))
	}
	return nil
}

// ExecuteWithOutput runs an FFmpeg command and returns output
func (m *Manager) ExecuteWithOutput(ctx context.Context, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, m.ffmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("ffmpeg command failed: %w", err)
	}
	return string(output), nil
}

// Probe runs ffprobe on a file
func (m *Manager) Probe(ctx context.Context, args ...string) (string, error) {
	if m.ffprobePath == "" {
		return "", fmt.Errorf("ffprobe not available")
	}

	cmd := exec.CommandContext(ctx, m.ffprobePath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("ffprobe command failed: %w", err)
	}
	return string(output), nil
}

// GetVersion returns FFmpeg version
func (m *Manager) GetVersion() (string, error) {
	cmd := exec.Command(m.ffmpegPath, "-version")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	// Parse version from first line
	lines := strings.Split(string(output), "\n")
	if len(lines) > 0 {
		parts := strings.Fields(lines[0])
		if len(parts) >= 3 {
			return parts[2], nil
		}
	}

	return "unknown", nil
}

// GetPath returns the FFmpeg binary path
func (m *Manager) GetPath() string {
	return m.ffmpegPath
}
