package text

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
)

// TextPosition represents predefined text positions
type TextPosition string

const (
	TopLeft      TextPosition = "top-left"
	TopCenter    TextPosition = "top-center"
	TopRight     TextPosition = "top-right"
	Center       TextPosition = "center"
	BottomLeft   TextPosition = "bottom-left"
	BottomCenter TextPosition = "bottom-center"
	BottomRight  TextPosition = "bottom-right"
)

// AnimationType represents text animation types
type AnimationType string

const (
	AnimationFade       AnimationType = "fade"
	AnimationSlideLeft  AnimationType = "slide-left"
	AnimationSlideRight AnimationType = "slide-right"
	AnimationSlideUp    AnimationType = "slide-up"
	AnimationSlideDown  AnimationType = "slide-down"
	AnimationZoom       AnimationType = "zoom"
)

// TextOverlayOptions contains options for adding text overlay
type TextOverlayOptions struct {
	Input  string
	Output string
	Text   string

	// Position
	X        string       // Can be number or expression like "w/2", "(w-text_w)/2"
	Y        string       // Can be number or expression
	Position TextPosition // Predefined position

	// Timing
	StartTime *float64 // seconds
	EndTime   *float64 // seconds
	Duration  *float64 // seconds

	// Font styling
	FontFile  string
	FontSize  int
	FontColor string // Color name or hex (e.g., 'white', '0xFFFFFF')

	// Effects
	BorderWidth int
	BorderColor string
	ShadowX     *int
	ShadowY     *int
	ShadowColor string

	// Box background
	Box             bool
	BoxColor        string
	BoxOpacity      float64 // 0-1
	BoxBorderWidth  int

	// Animation
	FadeIn  *float64 // seconds
	FadeOut *float64 // seconds
}

// AnimatedTextOptions extends TextOverlayOptions with animation
type AnimatedTextOptions struct {
	TextOverlayOptions
	Animation         AnimationType
	AnimationDuration float64 // seconds for animation effect
}

// SubtitleOptions contains options for burning subtitles
type SubtitleOptions struct {
	Input        string
	Output       string
	SubtitleFile string // SRT or VTT file

	// Styling
	FontSize  int
	FontColor string
	FontFile  string

	// Effects
	BorderWidth int
	BorderColor string

	// Box background
	Box        bool
	BoxColor   string
	BoxOpacity float64
}

// Operations handles text operations on videos
type Operations struct {
	ffmpeg *ffmpeg.Manager
}

// NewOperations creates a new text operations handler
func NewOperations(mgr *ffmpeg.Manager) *Operations {
	return &Operations{ffmpeg: mgr}
}

// AddTextOverlay adds text overlay to video
func (o *Operations) AddTextOverlay(ctx context.Context, opts TextOverlayOptions) error {
	filter := o.buildDrawTextFilter(opts)

	args := []string{
		"-i", opts.Input,
		"-vf", filter,
		"-c:a", "copy", // Copy audio without re-encoding
		"-y",
		opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// AddAnimatedText adds animated text to video
func (o *Operations) AddAnimatedText(ctx context.Context, opts AnimatedTextOptions) error {
	filter := o.buildAnimatedTextFilter(opts)

	args := []string{
		"-i", opts.Input,
		"-vf", filter,
		"-c:a", "copy",
		"-y",
		opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// BurnSubtitles burns subtitles into video
func (o *Operations) BurnSubtitles(ctx context.Context, opts SubtitleOptions) error {
	ext := strings.ToLower(filepath.Ext(opts.SubtitleFile))

	var filter string
	switch ext {
	case ".srt", ".vtt", ".ass":
		filter = o.buildSubtitlesFilter(opts)
	default:
		return fmt.Errorf("unsupported subtitle format: %s. Supported: .srt, .vtt, .ass", ext)
	}

	args := []string{
		"-i", opts.Input,
		"-vf", filter,
		"-c:a", "copy",
		"-y",
		opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// buildDrawTextFilter builds the drawtext filter string
func (o *Operations) buildDrawTextFilter(opts TextOverlayOptions) string {
	params := []string{}

	// Escape text for FFmpeg
	escapedText := escapeText(opts.Text)
	params = append(params, fmt.Sprintf("text='%s'", escapedText))

	// Position
	x, y := resolvePosition(opts)
	params = append(params, fmt.Sprintf("x=%s", x))
	params = append(params, fmt.Sprintf("y=%s", y))

	// Font
	if opts.FontFile != "" {
		params = append(params, fmt.Sprintf("fontfile='%s'", opts.FontFile))
	}
	fontSize := opts.FontSize
	if fontSize == 0 {
		fontSize = 24
	}
	params = append(params, fmt.Sprintf("fontsize=%d", fontSize))

	fontColor := opts.FontColor
	if fontColor == "" {
		fontColor = "white"
	}
	params = append(params, fmt.Sprintf("fontcolor=%s", fontColor))

	// Border/Outline
	if opts.BorderWidth > 0 {
		params = append(params, fmt.Sprintf("borderw=%d", opts.BorderWidth))
		borderColor := opts.BorderColor
		if borderColor == "" {
			borderColor = "black"
		}
		params = append(params, fmt.Sprintf("bordercolor=%s", borderColor))
	}

	// Shadow
	if opts.ShadowX != nil || opts.ShadowY != nil {
		shadowX := 2
		if opts.ShadowX != nil {
			shadowX = *opts.ShadowX
		}
		shadowY := 2
		if opts.ShadowY != nil {
			shadowY = *opts.ShadowY
		}
		params = append(params, fmt.Sprintf("shadowx=%d", shadowX))
		params = append(params, fmt.Sprintf("shadowy=%d", shadowY))

		shadowColor := opts.ShadowColor
		if shadowColor == "" {
			shadowColor = "black"
		}
		params = append(params, fmt.Sprintf("shadowcolor=%s", shadowColor))
	}

	// Box background
	if opts.Box {
		params = append(params, "box=1")
		boxColor := opts.BoxColor
		if boxColor == "" {
			boxColor = "black"
		}
		boxOpacity := opts.BoxOpacity
		if boxOpacity == 0 {
			boxOpacity = 0.5
		}
		params = append(params, fmt.Sprintf("boxcolor=%s@%.2f", boxColor, boxOpacity))

		if opts.BoxBorderWidth > 0 {
			params = append(params, fmt.Sprintf("boxborderw=%d", opts.BoxBorderWidth))
		}
	}

	// Timing
	if opts.StartTime != nil || opts.EndTime != nil || opts.Duration != nil {
		enable := buildEnableExpression(opts.StartTime, opts.EndTime, opts.Duration)
		params = append(params, fmt.Sprintf("enable='%s'", enable))
	}

	// Fade effects
	if opts.FadeIn != nil || opts.FadeOut != nil {
		alpha := buildFadeExpression(opts)
		params = append(params, fmt.Sprintf("alpha='%s'", alpha))
	}

	return "drawtext=" + strings.Join(params, ":")
}

// buildAnimatedTextFilter builds animated text filter
func (o *Operations) buildAnimatedTextFilter(opts AnimatedTextOptions) string {
	params := []string{}

	escapedText := escapeText(opts.Text)
	params = append(params, fmt.Sprintf("text='%s'", escapedText))

	// Animation position
	x, y := resolveAnimatedPosition(opts)
	params = append(params, fmt.Sprintf("x=%s", x))
	params = append(params, fmt.Sprintf("y=%s", y))

	// Font
	if opts.FontFile != "" {
		params = append(params, fmt.Sprintf("fontfile='%s'", opts.FontFile))
	}
	fontSize := opts.FontSize
	if fontSize == 0 {
		fontSize = 24
	}
	params = append(params, fmt.Sprintf("fontsize=%d", fontSize))

	fontColor := opts.FontColor
	if fontColor == "" {
		fontColor = "white"
	}
	params = append(params, fmt.Sprintf("fontcolor=%s", fontColor))

	// Border
	if opts.BorderWidth > 0 {
		params = append(params, fmt.Sprintf("borderw=%d", opts.BorderWidth))
		borderColor := opts.BorderColor
		if borderColor == "" {
			borderColor = "black"
		}
		params = append(params, fmt.Sprintf("bordercolor=%s", borderColor))
	}

	// Timing
	if opts.StartTime != nil || opts.EndTime != nil || opts.Duration != nil {
		enable := buildEnableExpression(opts.StartTime, opts.EndTime, opts.Duration)
		params = append(params, fmt.Sprintf("enable='%s'", enable))
	}

	// Animation alpha/zoom
	if opts.Animation == AnimationFade || opts.Animation == AnimationZoom {
		alpha := buildAnimationAlphaExpression(opts)
		params = append(params, fmt.Sprintf("alpha='%s'", alpha))
	}

	return "drawtext=" + strings.Join(params, ":")
}

// buildSubtitlesFilter builds subtitles filter
func (o *Operations) buildSubtitlesFilter(opts SubtitleOptions) string {
	// Escape path for FFmpeg (Windows paths need special handling)
	escapedPath := strings.ReplaceAll(opts.SubtitleFile, "\\", "/")
	escapedPath = strings.ReplaceAll(escapedPath, ":", "\\:")

	filter := fmt.Sprintf("subtitles='%s'", escapedPath)

	// Add styling if specified
	styleParams := []string{}
	if opts.FontSize > 0 {
		styleParams = append(styleParams, fmt.Sprintf("FontSize=%d", opts.FontSize))
	}
	if opts.FontColor != "" {
		styleParams = append(styleParams, fmt.Sprintf("PrimaryColour=%s", opts.FontColor))
	}
	if opts.BorderWidth > 0 {
		styleParams = append(styleParams, fmt.Sprintf("BorderStyle=1"))
		styleParams = append(styleParams, fmt.Sprintf("Outline=%d", opts.BorderWidth))
	}

	if len(styleParams) > 0 {
		filter += ":force_style='" + strings.Join(styleParams, ",") + "'"
	}

	return filter
}

// Helper functions

func escapeText(text string) string {
	// Escape special characters for FFmpeg drawtext
	text = strings.ReplaceAll(text, "\\", "\\\\")
	text = strings.ReplaceAll(text, "'", "\\'")
	text = strings.ReplaceAll(text, ":", "\\:")
	text = strings.ReplaceAll(text, "\n", "\\n")
	return text
}

func resolvePosition(opts TextOverlayOptions) (string, string) {
	// If explicit x, y are provided, use them
	if opts.X != "" && opts.Y != "" {
		return opts.X, opts.Y
	}

	// Otherwise use position preset
	switch opts.Position {
	case TopLeft:
		return "10", "10"
	case TopCenter:
		return "(w-text_w)/2", "10"
	case TopRight:
		return "w-text_w-10", "10"
	case Center:
		return "(w-text_w)/2", "(h-text_h)/2"
	case BottomLeft:
		return "10", "h-text_h-10"
	case BottomCenter:
		return "(w-text_w)/2", "h-text_h-10"
	case BottomRight:
		return "w-text_w-10", "h-text_h-10"
	default:
		// Default to bottom center
		return "(w-text_w)/2", "h-text_h-10"
	}
}

func resolveAnimatedPosition(opts AnimatedTextOptions) (string, string) {
	startTime := 0.0
	if opts.StartTime != nil {
		startTime = *opts.StartTime
	}

	animDuration := opts.AnimationDuration
	if animDuration == 0 {
		animDuration = 1.0
	}

	switch opts.Animation {
	case AnimationSlideLeft:
		// Slide from right to center
		x := fmt.Sprintf("if(lt(t,%.2f),w,if(lt(t,%.2f),w-(w-(w-text_w)/2)*(t-%.2f)/%.2f,(w-text_w)/2))",
			startTime, startTime+animDuration, startTime, animDuration)
		return x, "(h-text_h)/2"

	case AnimationSlideRight:
		// Slide from left to center
		x := fmt.Sprintf("if(lt(t,%.2f),-text_w,if(lt(t,%.2f),-text_w+((w-text_w)/2+text_w)*(t-%.2f)/%.2f,(w-text_w)/2))",
			startTime, startTime+animDuration, startTime, animDuration)
		return x, "(h-text_h)/2"

	case AnimationSlideUp:
		// Slide from bottom to center
		y := fmt.Sprintf("if(lt(t,%.2f),h,if(lt(t,%.2f),h-(h-(h-text_h)/2)*(t-%.2f)/%.2f,(h-text_h)/2))",
			startTime, startTime+animDuration, startTime, animDuration)
		return "(w-text_w)/2", y

	case AnimationSlideDown:
		// Slide from top to center
		y := fmt.Sprintf("if(lt(t,%.2f),-text_h,if(lt(t,%.2f),-text_h+((h-text_h)/2+text_h)*(t-%.2f)/%.2f,(h-text_h)/2))",
			startTime, startTime+animDuration, startTime, animDuration)
		return "(w-text_w)/2", y

	default:
		// For fade and zoom, use center position
		return "(w-text_w)/2", "(h-text_h)/2"
	}
}

func buildEnableExpression(startTime, endTime, duration *float64) string {
	if startTime == nil && endTime == nil && duration == nil {
		return "1"
	}

	start := 0.0
	if startTime != nil {
		start = *startTime
	}

	if endTime != nil {
		return fmt.Sprintf("between(t,%.2f,%.2f)", start, *endTime)
	}

	if duration != nil {
		return fmt.Sprintf("between(t,%.2f,%.2f)", start, start+*duration)
	}

	return fmt.Sprintf("gte(t,%.2f)", start)
}

func buildFadeExpression(opts TextOverlayOptions) string {
	startTime := 0.0
	if opts.StartTime != nil {
		startTime = *opts.StartTime
	}

	parts := []string{}

	if opts.FadeIn != nil {
		fadeIn := *opts.FadeIn
		// Fade in from startTime to startTime + fadeIn
		fadeInExpr := fmt.Sprintf("if(lt(t,%.2f),0,if(lt(t,%.2f),(t-%.2f)/%.2f,1))",
			startTime, startTime+fadeIn, startTime, fadeIn)
		parts = append(parts, fadeInExpr)
	}

	if opts.FadeOut != nil && opts.Duration != nil {
		fadeOut := *opts.FadeOut
		duration := *opts.Duration
		fadeOutStart := startTime + duration - fadeOut
		// Fade out from fadeOutStart to end
		fadeOutExpr := fmt.Sprintf("if(lt(t,%.2f),1,if(lt(t,%.2f),1-(t-%.2f)/%.2f,0))",
			fadeOutStart, startTime+duration, fadeOutStart, fadeOut)
		if len(parts) > 0 {
			// Combine fade in and fade out with multiplication
			return fmt.Sprintf("(%s)*(%s)", parts[0], fadeOutExpr)
		}
		parts = append(parts, fadeOutExpr)
	}

	if len(parts) == 0 {
		return "1"
	}

	return parts[0]
}

func buildAnimationAlphaExpression(opts AnimatedTextOptions) string {
	startTime := 0.0
	if opts.StartTime != nil {
		startTime = *opts.StartTime
	}

	animDuration := opts.AnimationDuration
	if animDuration == 0 {
		animDuration = 1.0
	}

	switch opts.Animation {
	case AnimationFade:
		// Fade in over animation duration
		return fmt.Sprintf("if(lt(t,%.2f),0,if(lt(t,%.2f),(t-%.2f)/%.2f,1))",
			startTime, startTime+animDuration, startTime, animDuration)

	case AnimationZoom:
		// Alpha stays 1 for zoom (zoom is handled by fontsize)
		return "1"

	default:
		return "1"
	}
}
