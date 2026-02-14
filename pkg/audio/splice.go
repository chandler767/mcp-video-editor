package audio

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
)

// SpliceOperations handles precise audio splicing with FFmpeg
type SpliceOperations struct {
	ffmpeg *ffmpeg.Manager
}

// SpliceOptions contains parameters for audio segment replacement
type SpliceOptions struct {
	InputAudio      string
	OutputAudio     string
	ReplacementPath string
	StartTime       float64
	EndTime         float64
	CrossfadeDur    float64 // seconds, default 0.05 (50ms)
}

// NewSpliceOperations creates a new audio splice operations handler
func NewSpliceOperations(mgr *ffmpeg.Manager) *SpliceOperations {
	return &SpliceOperations{
		ffmpeg: mgr,
	}
}

// ReplaceSegment replaces an audio segment with TTS audio
func (s *SpliceOperations) ReplaceSegment(ctx context.Context, opts SpliceOptions) error {
	// Set default crossfade duration
	if opts.CrossfadeDur == 0 {
		opts.CrossfadeDur = 0.05 // 50ms
	}

	// Create temporary directory for intermediate files
	tempDir, err := os.MkdirTemp("", "audio-splice-*")
	if err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(tempDir)

	// Paths for intermediate files
	beforePath := filepath.Join(tempDir, "before.mp3")
	afterPath := filepath.Join(tempDir, "after.mp3")
	normalizedPath := filepath.Join(tempDir, "normalized.mp3")

	// Step 1: Extract segment before replacement (0 to startTime)
	if opts.StartTime > 0 {
		args := []string{
			"-i", opts.InputAudio,
			"-ss", "0",
			"-to", fmt.Sprintf("%.3f", opts.StartTime),
			"-c", "copy",
			"-y",
			beforePath,
		}
		if err := s.ffmpeg.Execute(ctx, args...); err != nil {
			return fmt.Errorf("failed to extract before segment: %w", err)
		}
	}

	// Step 2: Get total duration of input audio
	duration, err := s.getAudioDuration(ctx, opts.InputAudio)
	if err != nil {
		return fmt.Errorf("failed to get audio duration: %w", err)
	}

	// Step 3: Extract segment after replacement (endTime to end)
	if opts.EndTime < duration {
		args := []string{
			"-i", opts.InputAudio,
			"-ss", fmt.Sprintf("%.3f", opts.EndTime),
			"-c", "copy",
			"-y",
			afterPath,
		}
		if err := s.ffmpeg.Execute(ctx, args...); err != nil {
			return fmt.Errorf("failed to extract after segment: %w", err)
		}
	}

	// Step 4: Normalize replacement audio volume to match original
	args := []string{
		"-i", opts.ReplacementPath,
		"-af", "loudnorm",
		"-y",
		normalizedPath,
	}
	if err := s.ffmpeg.Execute(ctx, args...); err != nil {
		return fmt.Errorf("failed to normalize replacement audio: %w", err)
	}

	// Step 5: Concatenate with crossfade
	if err := s.concatenateWithCrossfade(ctx, beforePath, normalizedPath, afterPath, opts.OutputAudio, opts.CrossfadeDur, opts.StartTime, opts.EndTime, duration); err != nil {
		return fmt.Errorf("failed to concatenate audio: %w", err)
	}

	return nil
}

// concatenateWithCrossfade joins audio segments with crossfade transitions
func (s *SpliceOperations) concatenateWithCrossfade(ctx context.Context, beforePath, replacementPath, afterPath, outputPath string, crossfadeDur, startTime, endTime, totalDuration float64) error {
	// Build input list and filter complex based on what segments exist
	var inputs []string
	var filterComplex string

	hasBefore := startTime > 0
	hasAfter := endTime < totalDuration

	if !hasBefore && !hasAfter {
		// Only replacement (entire audio is replaced)
		return s.copyFile(replacementPath, outputPath)
	}

	if hasBefore && !hasAfter {
		// Before + Replacement
		inputs = []string{"-i", beforePath, "-i", replacementPath}
		filterComplex = fmt.Sprintf("[0][1]acrossfade=d=%.3f[out]", crossfadeDur)
	} else if !hasBefore && hasAfter {
		// Replacement + After
		inputs = []string{"-i", replacementPath, "-i", afterPath}
		filterComplex = fmt.Sprintf("[0][1]acrossfade=d=%.3f[out]", crossfadeDur)
	} else {
		// Before + Replacement + After
		inputs = []string{"-i", beforePath, "-i", replacementPath, "-i", afterPath}
		filterComplex = fmt.Sprintf("[0][1]acrossfade=d=%.3f[a01];[a01][2]acrossfade=d=%.3f[out]", crossfadeDur, crossfadeDur)
	}

	args := append(inputs, "-filter_complex", filterComplex, "-map", "[out]", "-y", outputPath)

	if err := s.ffmpeg.Execute(ctx, args...); err != nil {
		return fmt.Errorf("failed to concatenate with crossfade: %w", err)
	}

	return nil
}

// getAudioDuration returns the duration of an audio file in seconds
func (s *SpliceOperations) getAudioDuration(ctx context.Context, audioPath string) (float64, error) {
	// Use ffprobe to get duration
	args := []string{
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		audioPath,
	}

	output, err := s.ffmpeg.Probe(ctx, args...)
	if err != nil {
		return 0, err
	}

	var duration float64
	if _, err := fmt.Sscanf(output, "%f", &duration); err != nil {
		return 0, fmt.Errorf("failed to parse duration: %w", err)
	}

	return duration, nil
}

// copyFile is a simple file copy utility
func (s *SpliceOperations) copyFile(src, dst string) error {
	input, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, input, 0644)
}
