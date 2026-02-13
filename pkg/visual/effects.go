package visual

import (
	"context"
	"fmt"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
)

// Effects handles visual effects operations
type Effects struct {
	ffmpeg *ffmpeg.Manager
}

// NewEffects creates a new visual effects handler
func NewEffects(mgr *ffmpeg.Manager) *Effects {
	return &Effects{ffmpeg: mgr}
}

// BlurOptions contains options for blur effect
type BlurOptions struct {
	Input     string
	Output    string
	Type      string  // gaussian, box, motion, radial
	Strength  float64 // 0-10
	Angle     float64 // For motion blur
	StartTime *float64
	Duration  *float64
}

// ApplyBlur applies blur effect to video
func (e *Effects) ApplyBlur(ctx context.Context, opts BlurOptions) error {
	var filter string

	strength := opts.Strength
	if strength == 0 {
		strength = 5
	}

	switch opts.Type {
	case "box":
		filter = fmt.Sprintf("boxblur=%.1f:%.1f", strength, strength)
	case "motion":
		filter = fmt.Sprintf("mblur=amount=%.1f:angle=%.1f", strength, opts.Angle)
	case "radial", "gaussian":
		fallthrough
	default:
		filter = fmt.Sprintf("gblur=sigma=%.1f", strength)
	}

	// Add timing if specified
	if opts.StartTime != nil || opts.Duration != nil {
		enable := buildEnableExpression(opts.StartTime, opts.Duration)
		filter = fmt.Sprintf("%s:enable='%s'", filter, enable)
	}

	args := []string{
		"-i", opts.Input,
		"-vf", filter,
		"-c:a", "copy",
		"-y", opts.Output,
	}

	return e.ffmpeg.Execute(ctx, args...)
}

// ColorGradeOptions contains options for color grading
type ColorGradeOptions struct {
	Input       string
	Output      string
	Brightness  *float64 // -1 to 1
	Contrast    *float64 // -1 to 1
	Saturation  *float64 // -1 to 1
	Gamma       *float64 // 0.1 to 10
	Hue         *float64 // Degrees
	Temperature *float64 // -100 to 100
	Tint        *float64 // -100 to 100
}

// ApplyColorGrade applies color grading to video
func (e *Effects) ApplyColorGrade(ctx context.Context, opts ColorGradeOptions) error {
	var filters []string

	// Build eq filter
	if opts.Brightness != nil || opts.Contrast != nil || opts.Saturation != nil || opts.Gamma != nil {
		eq := "eq="
		params := []string{}

		if opts.Brightness != nil {
			params = append(params, fmt.Sprintf("brightness=%.2f", *opts.Brightness))
		}
		if opts.Contrast != nil {
			params = append(params, fmt.Sprintf("contrast=%.2f", *opts.Contrast+1))
		}
		if opts.Saturation != nil {
			params = append(params, fmt.Sprintf("saturation=%.2f", *opts.Saturation+1))
		}
		if opts.Gamma != nil {
			params = append(params, fmt.Sprintf("gamma=%.2f", *opts.Gamma))
		}

		eq += joinParams(params, ":")
		filters = append(filters, eq)
	}

	// Hue adjustment
	if opts.Hue != nil {
		filters = append(filters, fmt.Sprintf("hue=h=%.1f", *opts.Hue))
	}

	// Temperature and tint (using colorbalance)
	if opts.Temperature != nil || opts.Tint != nil {
		temp := float64(0)
		tint := float64(0)
		if opts.Temperature != nil {
			temp = *opts.Temperature
		}
		if opts.Tint != nil {
			tint = *opts.Tint
		}

		rs := 0.0
		bs := 0.0
		if temp > 0 {
			rs = temp / 100
		} else {
			bs = -temp / 100
		}
		gs := tint / 100

		filters = append(filters, fmt.Sprintf("colorbalance=rs=%.2f:gs=%.2f:bs=%.2f", rs, gs, bs))
	}

	if len(filters) == 0 {
		return fmt.Errorf("no color adjustments specified")
	}

	filterComplex := joinParams(filters, ",")

	args := []string{
		"-i", opts.Input,
		"-vf", filterComplex,
		"-c:a", "copy",
		"-y", opts.Output,
	}

	return e.ffmpeg.Execute(ctx, args...)
}

// ChromaKeyOptions contains options for chroma key (green screen)
type ChromaKeyOptions struct {
	Input           string
	Output          string
	KeyColor        string  // Color to key out
	Similarity      float64 // 0-1
	Blend           float64 // 0-1
	BackgroundImage *string
	BackgroundColor *string
}

// ApplyChromaKey removes green screen from video
func (e *Effects) ApplyChromaKey(ctx context.Context, opts ChromaKeyOptions) error {
	keyColor := opts.KeyColor
	if keyColor == "" {
		keyColor = "0x00FF00" // Green
	}

	similarity := opts.Similarity
	if similarity == 0 {
		similarity = 0.3
	}

	blend := opts.Blend
	if blend == 0 {
		blend = 0.1
	}

	filter := fmt.Sprintf("chromakey=color=%s:similarity=%.2f:blend=%.2f", keyColor, similarity, blend)

	args := []string{}

	// If background image is specified, use overlay
	if opts.BackgroundImage != nil {
		args = []string{
			"-i", *opts.BackgroundImage,
			"-i", opts.Input,
			"-filter_complex", fmt.Sprintf("[1:v]%s[keyed];[0:v][keyed]overlay", filter),
			"-y", opts.Output,
		}
	} else {
		args = []string{
			"-i", opts.Input,
			"-vf", filter,
			"-c:a", "copy",
			"-y", opts.Output,
		}
	}

	return e.ffmpeg.Execute(ctx, args...)
}

// VignetteOptions contains options for vignette effect
type VignetteOptions struct {
	Input     string
	Output    string
	Intensity float64 // 0-1
}

// ApplyVignette applies vignette effect (darkened edges)
func (e *Effects) ApplyVignette(ctx context.Context, opts VignetteOptions) error {
	intensity := opts.Intensity
	if intensity == 0 {
		intensity = 0.5
	}

	filter := "vignette"

	args := []string{
		"-i", opts.Input,
		"-vf", filter,
		"-c:a", "copy",
		"-y", opts.Output,
	}

	return e.ffmpeg.Execute(ctx, args...)
}

// SharpenOptions contains options for sharpen effect
type SharpenOptions struct {
	Input    string
	Output   string
	Strength float64 // 0-10
}

// ApplySharpen applies sharpen effect to video
func (e *Effects) ApplySharpen(ctx context.Context, opts SharpenOptions) error {
	strength := opts.Strength
	if strength == 0 {
		strength = 5
	}

	amount := strength / 5
	filter := fmt.Sprintf("unsharp=5:5:%.2f:5:5:0", amount)

	args := []string{
		"-i", opts.Input,
		"-vf", filter,
		"-c:a", "copy",
		"-y", opts.Output,
	}

	return e.ffmpeg.Execute(ctx, args...)
}

// Helper functions

func buildEnableExpression(startTime, duration *float64) string {
	if startTime == nil && duration == nil {
		return ""
	}

	start := 0.0
	if startTime != nil {
		start = *startTime
	}

	if duration == nil {
		return fmt.Sprintf("gte(t,%.2f)", start)
	}

	end := start + *duration
	return fmt.Sprintf("between(t,%.2f,%.2f)", start, end)
}

func joinParams(params []string, sep string) string {
	result := ""
	for i, p := range params {
		if i > 0 {
			result += sep
		}
		result += p
	}
	return result
}

// KenBurnsOptions contains options for Ken Burns effect (zoom/pan on still image)
type KenBurnsOptions struct {
	Input         string
	Output        string
	Duration      float64  // Duration in seconds
	FPS           int      // Frame rate (default: 30)
	StartZoom     float64  // Starting zoom level (1.0 = no zoom)
	EndZoom       float64  // Ending zoom level
	StartX        *float64 // Starting X position (0-1, where 0.5 is center)
	StartY        *float64 // Starting Y position (0-1, where 0.5 is center)
	EndX          *float64 // Ending X position
	EndY          *float64 // Ending Y position
	Width         int      // Output width (default: 1920)
	Height        int      // Output height (default: 1080)
}

// ApplyKenBurns applies Ken Burns effect (zoom and pan) to a still image
func (e *Effects) ApplyKenBurns(ctx context.Context, opts KenBurnsOptions) error {
	// Set defaults
	if opts.FPS == 0 {
		opts.FPS = 30
	}
	if opts.StartZoom == 0 {
		opts.StartZoom = 1.0
	}
	if opts.EndZoom == 0 {
		opts.EndZoom = 1.2
	}
	if opts.Width == 0 {
		opts.Width = 1920
	}
	if opts.Height == 0 {
		opts.Height = 1080
	}

	// Default positions (center)
	startX := 0.5
	startY := 0.5
	endX := 0.5
	endY := 0.5

	if opts.StartX != nil {
		startX = *opts.StartX
	}
	if opts.StartY != nil {
		startY = *opts.StartY
	}
	if opts.EndX != nil {
		endX = *opts.EndX
	}
	if opts.EndY != nil {
		endY = *opts.EndY
	}

	// Calculate zoom and pan parameters
	totalFrames := int(opts.Duration * float64(opts.FPS))
	
	// Build zoompan filter
	// z = zoom level, x/y = position, d = duration in frames, s = output size
	filter := fmt.Sprintf(
		"zoompan=z='%.4f+((%.4f-%.4f)/%.0f)*on':x='iw*%.4f+(iw*%.4f-iw*%.4f)/%.0f*on':y='ih*%.4f+(ih*%.4f-ih*%.4f)/%.0f*on':d=%d:s=%dx%d:fps=%d",
		opts.StartZoom,
		opts.EndZoom, opts.StartZoom, float64(totalFrames-1),
		startX, endX, startX, float64(totalFrames-1),
		startY, endY, startY, float64(totalFrames-1),
		totalFrames,
		opts.Width, opts.Height,
		opts.FPS,
	)

	args := []string{
		"-loop", "1",
		"-i", opts.Input,
		"-vf", filter,
		"-t", fmt.Sprintf("%.2f", opts.Duration),
		"-pix_fmt", "yuv420p",
		"-y",
		opts.Output,
	}

	return e.ffmpeg.Execute(ctx, args...)
}
