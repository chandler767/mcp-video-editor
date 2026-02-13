package visual

import (
	"context"
	"fmt"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
)

// Transitions handles video transition effects
type Transitions struct {
	ffmpeg *ffmpeg.Manager
}

// NewTransitions creates a new transitions handler
func NewTransitions(mgr *ffmpeg.Manager) *Transitions {
	return &Transitions{ffmpeg: mgr}
}

// TransitionOptions contains options for transitions
type TransitionOptions struct {
	Input1   string
	Input2   string
	Output   string
	Type     string  // fade, wipeleft, wiperight, slideup, slidedown, etc.
	Duration float64 // Transition duration in seconds
	Offset   *float64 // When to start transition (optional)
}

// AddTransition adds a transition between two videos
func (t *Transitions) AddTransition(ctx context.Context, opts TransitionOptions) error {
	duration := opts.Duration
	if duration == 0 {
		duration = 1.0
	}

	transType := opts.Type
	if transType == "" {
		transType = "fade"
	}

	// Get duration of first video to calculate offset if not provided
	offset := duration
	if opts.Offset != nil {
		offset = *opts.Offset
	}

	// Build xfade filter with output stream labels
	xfadeFilter := fmt.Sprintf("[0:v][1:v]xfade=transition=%s:duration=%.2f:offset=%.2f[v]",
		transType, duration, offset)

	// Also crossfade audio
	audioFilter := fmt.Sprintf("[0:a][1:a]acrossfade=d=%.2f[a]", duration)

	args := []string{
		"-i", opts.Input1,
		"-i", opts.Input2,
		"-filter_complex", fmt.Sprintf("%s;%s", xfadeFilter, audioFilter),
		"-map", "[v]",
		"-map", "[a]",
		"-y", opts.Output,
	}

	return t.ffmpeg.Execute(ctx, args...)
}

// CrossfadeOptions contains options for crossfade
type CrossfadeOptions struct {
	Input1   string
	Input2   string
	Output   string
	Duration float64
}

// Crossfade performs a smooth crossfade between two videos
func (t *Transitions) Crossfade(ctx context.Context, opts CrossfadeOptions) error {
	duration := opts.Duration
	if duration == 0 {
		duration = 1.0
	}

	transOpts := TransitionOptions{
		Input1:   opts.Input1,
		Input2:   opts.Input2,
		Output:   opts.Output,
		Type:     "fade",
		Duration: duration,
	}

	return t.AddTransition(ctx, transOpts)
}

// GetAvailableTransitions returns list of available transition types
func (t *Transitions) GetAvailableTransitions() []string {
	return []string{
		"fade",
		"fadeblack",
		"fadewhite",
		"wipeleft",
		"wiperight",
		"wipeup",
		"wipedown",
		"slideleft",
		"slideright",
		"slideup",
		"slidedown",
		"smoothleft",
		"smoothright",
		"smoothup",
		"smoothdown",
		"circlecrop",
		"rectcrop",
		"distance",
		"fadefast",
		"fadeslow",
		"dissolve",
		"pixelize",
		"radial",
		"hblur",
		"vblur",
	}
}
