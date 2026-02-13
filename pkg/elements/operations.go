package elements

import (
	"context"
	"fmt"
	"strings"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
)

// ImageOverlayOptions contains options for overlaying images
type ImageOverlayOptions struct {
	Input  string
	Output string
	Image  string

	// Position
	X        *string // X position (can be expression like "w-overlay_w-10")
	Y        *string // Y position
	Position string  // Preset position: top-left, top-right, bottom-left, bottom-right, center

	// Size
	Width  *int // Overlay width (pixels or -1 for original)
	Height *int // Overlay height (pixels or -1 for original)
	Scale  *float64 // Scale factor (e.g., 0.5 for 50%)

	// Effects
	Opacity   *float64 // Opacity 0-1
	Rotation  *float64 // Rotation in degrees
	StartTime *float64 // Start time in seconds
	Duration  *float64 // Duration in seconds
}

// ShapeOptions contains options for drawing shapes
type ShapeOptions struct {
	Input  string
	Output string
	Shape  string // Shape type: rectangle, circle, line, arrow, polygon

	// Position and size
	X      int // X position
	Y      int // Y position
	Width  *int // Width (for rectangle)
	Height *int // Height (for rectangle)
	Radius *int // Radius (for circle)

	// Line/Arrow
	X2 *int // End X (for line/arrow)
	Y2 *int // End Y (for line/arrow)

	// Polygon
	Points []Point // Points for polygon

	// Styling
	Color       string  // Fill color
	BorderColor *string // Border/stroke color
	BorderWidth int     // Border width
	Opacity     float64 // Opacity 0-1

	// Timing
	StartTime *float64 // Start time in seconds
	Duration  *float64 // Duration in seconds
}

// Point represents a 2D point
type Point struct {
	X int
	Y int
}

// Operations handles visual element operations
type Operations struct {
	ffmpeg *ffmpeg.Manager
}

// NewOperations creates a new visual elements operations handler
func NewOperations(mgr *ffmpeg.Manager) *Operations {
	return &Operations{ffmpeg: mgr}
}

// AddImageOverlay overlays an image on video
func (o *Operations) AddImageOverlay(ctx context.Context, opts ImageOverlayOptions) error {
	// Build filter for image overlay
	filter := o.buildImageOverlayFilter(opts)

	args := []string{
		"-i", opts.Input,
		"-i", opts.Image,
		"-filter_complex", filter,
		"-map", "[v]",
		"-map", "0:a?", // Copy audio if it exists
		"-c:a", "copy",
		"-y",
		opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// DrawShape draws a shape on video
func (o *Operations) DrawShape(ctx context.Context, opts ShapeOptions) error {
	filter := o.buildShapeFilter(opts)

	args := []string{
		"-i", opts.Input,
		"-vf", filter,
		"-c:a", "copy",
		"-y",
		opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// buildImageOverlayFilter builds the filter for image overlay
func (o *Operations) buildImageOverlayFilter(opts ImageOverlayOptions) string {
	filters := []string{}

	// Scale overlay if needed
	scaleFilter := ""
	if opts.Scale != nil {
		scaleFilter = fmt.Sprintf("[1:v]scale=iw*%.2f:ih*%.2f", *opts.Scale, *opts.Scale)
	} else if opts.Width != nil || opts.Height != nil {
		w := -1
		h := -1
		if opts.Width != nil {
			w = *opts.Width
		}
		if opts.Height != nil {
			h = *opts.Height
		}
		scaleFilter = fmt.Sprintf("[1:v]scale=%d:%d", w, h)
	}

	overlayInput := "[1:v]"
	if scaleFilter != "" {
		filters = append(filters, scaleFilter+"[scaled]")
		overlayInput = "[scaled]"
	}

	// Add rotation if specified
	if opts.Rotation != nil && *opts.Rotation != 0 {
		rotFilter := fmt.Sprintf("%srotate=%.2f*PI/180:c=none[rotated]", overlayInput, *opts.Rotation)
		filters = append(filters, rotFilter)
		overlayInput = "[rotated]"
	}

	// Build overlay filter
	x, y := o.resolveImagePosition(opts)
	overlayOpts := fmt.Sprintf("x=%s:y=%s", x, y)

	// Add opacity/alpha
	if opts.Opacity != nil && *opts.Opacity < 1.0 {
		overlayOpts += fmt.Sprintf(":format=auto:alpha=%.2f", *opts.Opacity)
	}

	// Add timing
	if opts.StartTime != nil || opts.Duration != nil {
		enable := buildEnableExpression(opts.StartTime, opts.Duration)
		overlayOpts += fmt.Sprintf(":enable='%s'", enable)
	}

	overlayFilter := fmt.Sprintf("[0:v]%soverlay=%s[v]", overlayInput, overlayOpts)
	filters = append(filters, overlayFilter)

	return strings.Join(filters, ";")
}

// buildShapeFilter builds the filter for drawing shapes
func (o *Operations) buildShapeFilter(opts ShapeOptions) string {
	color := opts.Color
	if color == "" {
		color = "white"
	}

	opacity := opts.Opacity
	if opacity == 0 {
		opacity = 1.0
	}

	// Add alpha to color
	colorWithAlpha := fmt.Sprintf("%s@%.2f", color, opacity)

	var filter string

	switch strings.ToLower(opts.Shape) {
	case "rectangle", "rect", "box":
		width := 100
		height := 100
		if opts.Width != nil {
			width = *opts.Width
		}
		if opts.Height != nil {
			height = *opts.Height
		}

		// drawbox filter
		params := fmt.Sprintf("x=%d:y=%d:w=%d:h=%d:color=%s", opts.X, opts.Y, width, height, colorWithAlpha)

		if opts.BorderWidth > 0 {
			params += fmt.Sprintf(":t=%d", opts.BorderWidth)
		} else {
			params += ":t=fill" // Fill the rectangle
		}

		filter = "drawbox=" + params

	case "circle":
		radius := 50
		if opts.Radius != nil {
			radius = *opts.Radius
		}

		// Approximate circle with drawtext or use multiple drawbox
		// FFmpeg doesn't have a native circle drawing, so we'll use a workaround
		// Draw using a text character or approximate with polygon
		filter = fmt.Sprintf("drawtext=text='●':fontsize=%d:fontcolor=%s:x=%d:y=%d",
			radius*2, colorWithAlpha, opts.X-radius, opts.Y-radius)

	case "line":
		if opts.X2 == nil || opts.Y2 == nil {
			filter = fmt.Sprintf("drawbox=x=%d:y=%d:w=1:h=1:color=%s:t=1", opts.X, opts.Y, colorWithAlpha)
		} else {
			// Draw line using drawbox (approximate as thin rectangle)
			x1, y1 := opts.X, opts.Y
			x2, y2 := *opts.X2, *opts.Y2

			thickness := opts.BorderWidth
			if thickness == 0 {
				thickness = 2
			}

			// Simple horizontal or vertical lines
			if y1 == y2 {
				// Horizontal line
				w := x2 - x1
				if w < 0 {
					w = -w
					x1 = x2
				}
				filter = fmt.Sprintf("drawbox=x=%d:y=%d:w=%d:h=%d:color=%s:t=fill",
					x1, y1, w, thickness, colorWithAlpha)
			} else if x1 == x2 {
				// Vertical line
				h := y2 - y1
				if h < 0 {
					h = -h
					y1 = y2
				}
				filter = fmt.Sprintf("drawbox=x=%d:y=%d:w=%d:h=%d:color=%s:t=fill",
					x1, y1, thickness, h, colorWithAlpha)
			} else {
				// Diagonal line - approximate with small boxes along the line
				filter = fmt.Sprintf("drawbox=x=%d:y=%d:w=%d:h=%d:color=%s:t=fill",
					x1, y1, 4, 4, colorWithAlpha)
			}
		}

	case "arrow":
		// Draw arrow as line + triangle head
		// This is simplified - just draw as a line for now
		if opts.X2 != nil && opts.Y2 != nil {
			thickness := opts.BorderWidth
			if thickness == 0 {
				thickness = 2
			}
			filter = fmt.Sprintf("drawbox=x=%d:y=%d:w=%d:h=%d:color=%s:t=fill",
				opts.X, opts.Y, *opts.X2-opts.X, thickness, colorWithAlpha)
		}

	default:
		// Default to rectangle
		filter = fmt.Sprintf("drawbox=x=%d:y=%d:w=100:h=100:color=%s:t=fill", opts.X, opts.Y, colorWithAlpha)
	}

	// Add timing if specified
	if opts.StartTime != nil || opts.Duration != nil {
		enable := buildEnableExpression(opts.StartTime, opts.Duration)
		filter += fmt.Sprintf(":enable='%s'", enable)
	}

	return filter
}

// resolveImagePosition resolves position for image overlay
func (o *Operations) resolveImagePosition(opts ImageOverlayOptions) (string, string) {
	// If explicit x, y are provided, use them
	if opts.X != nil && opts.Y != nil {
		return *opts.X, *opts.Y
	}

	// Use position preset
	switch opts.Position {
	case "top-left":
		return "10", "10"
	case "top-right":
		return "W-w-10", "10"
	case "top-center":
		return "(W-w)/2", "10"
	case "bottom-left":
		return "10", "H-h-10"
	case "bottom-right":
		return "W-w-10", "H-h-10"
	case "bottom-center":
		return "(W-w)/2", "H-h-10"
	case "center":
		return "(W-w)/2", "(H-h)/2"
	case "center-left":
		return "10", "(H-h)/2"
	case "center-right":
		return "W-w-10", "(H-h)/2"
	default:
		// Default to center
		return "(W-w)/2", "(H-h)/2"
	}
}

func buildEnableExpression(startTime, duration *float64) string {
	if startTime == nil && duration == nil {
		return "1"
	}

	start := 0.0
	if startTime != nil {
		start = *startTime
	}

	if duration != nil {
		return fmt.Sprintf("between(t,%.2f,%.2f)", start, start+*duration)
	}

	return fmt.Sprintf("gte(t,%.2f)", start)
}
