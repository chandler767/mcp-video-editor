package visual

import (
	"context"
	"fmt"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
)

// Composite handles composite operations (PiP, split screen, etc.)
type Composite struct {
	ffmpeg *ffmpeg.Manager
}

// NewComposite creates a new composite operations handler
func NewComposite(mgr *ffmpeg.Manager) *Composite {
	return &Composite{ffmpeg: mgr}
}

// PictureInPictureOptions contains options for PiP
type PictureInPictureOptions struct {
	MainVideo   string
	PipVideo    string
	Output      string
	Position    string  // top-left, top-right, bottom-left, bottom-right, center, etc.
	Width       *int
	Height      *int
	Margin      int
	BorderWidth int
	BorderColor string
}

// CreatePictureInPicture creates picture-in-picture composition
func (c *Composite) CreatePictureInPicture(ctx context.Context, opts PictureInPictureOptions) error {
	// Set defaults
	position := opts.Position
	if position == "" {
		position = "bottom-right"
	}

	margin := opts.Margin
	if margin == 0 {
		margin = 20
	}

	// Calculate position expression
	var xExpr, yExpr string
	switch position {
	case "top-left":
		xExpr = fmt.Sprintf("%d", margin)
		yExpr = fmt.Sprintf("%d", margin)
	case "top-right":
		xExpr = fmt.Sprintf("main_w-overlay_w-%d", margin)
		yExpr = fmt.Sprintf("%d", margin)
	case "bottom-left":
		xExpr = fmt.Sprintf("%d", margin)
		yExpr = fmt.Sprintf("main_h-overlay_h-%d", margin)
	case "bottom-right":
		xExpr = fmt.Sprintf("main_w-overlay_w-%d", margin)
		yExpr = fmt.Sprintf("main_h-overlay_h-%d", margin)
	case "center":
		xExpr = "(main_w-overlay_w)/2"
		yExpr = "(main_h-overlay_h)/2"
	default:
		xExpr = fmt.Sprintf("main_w-overlay_w-%d", margin)
		yExpr = fmt.Sprintf("main_h-overlay_h-%d", margin)
	}

	// Build filter complex
	var filterComplex string
	if opts.Width != nil && opts.Height != nil {
		// Scale PiP video
		filterComplex = fmt.Sprintf("[1:v]scale=%d:%d[pip];[0:v][pip]overlay=%s:%s",
			*opts.Width, *opts.Height, xExpr, yExpr)
	} else {
		// Use original size (scaled to 25% of main)
		filterComplex = fmt.Sprintf("[1:v]scale=iw*0.25:ih*0.25[pip];[0:v][pip]overlay=%s:%s",
			xExpr, yExpr)
	}

	args := []string{
		"-i", opts.MainVideo,
		"-i", opts.PipVideo,
		"-filter_complex", filterComplex,
		"-c:a", "copy",
		"-y", opts.Output,
	}

	return c.ffmpeg.Execute(ctx, args...)
}

// SplitScreenOptions contains options for split screen
type SplitScreenOptions struct {
	Videos      []string
	Output      string
	Layout      string // horizontal, vertical, grid-2x2, grid-3x3
	BorderWidth int
	BorderColor string
}

// CreateSplitScreen creates split screen layout
func (c *Composite) CreateSplitScreen(ctx context.Context, opts SplitScreenOptions) error {
	if len(opts.Videos) < 2 {
		return fmt.Errorf("need at least 2 videos for split screen")
	}

	var filterComplex string

	switch opts.Layout {
	case "horizontal":
		// 2-way horizontal split
		filterComplex = "[0:v]scale=iw/2:ih[left];[1:v]scale=iw/2:ih[right];[left][right]hstack=inputs=2"

	case "vertical":
		// 2-way vertical split
		filterComplex = "[0:v]scale=iw:ih/2[top];[1:v]scale=iw:ih/2[bottom];[top][bottom]vstack=inputs=2"

	case "grid-2x2":
		// 4-way grid
		if len(opts.Videos) < 4 {
			return fmt.Errorf("grid-2x2 requires 4 videos")
		}
		filterComplex = `
			[0:v]scale=iw/2:ih/2[v0];
			[1:v]scale=iw/2:ih/2[v1];
			[2:v]scale=iw/2:ih/2[v2];
			[3:v]scale=iw/2:ih/2[v3];
			[v0][v1]hstack=inputs=2[top];
			[v2][v3]hstack=inputs=2[bottom];
			[top][bottom]vstack=inputs=2
		`

	case "grid-3x3":
		// 9-way grid
		if len(opts.Videos) < 9 {
			return fmt.Errorf("grid-3x3 requires 9 videos")
		}
		filterComplex = `
			[0:v]scale=iw/3:ih/3[v0];[1:v]scale=iw/3:ih/3[v1];[2:v]scale=iw/3:ih/3[v2];
			[3:v]scale=iw/3:ih/3[v3];[4:v]scale=iw/3:ih/3[v4];[5:v]scale=iw/3:ih/3[v5];
			[6:v]scale=iw/3:ih/3[v6];[7:v]scale=iw/3:ih/3[v7];[8:v]scale=iw/3:ih/3[v8];
			[v0][v1][v2]hstack=inputs=3[row1];
			[v3][v4][v5]hstack=inputs=3[row2];
			[v6][v7][v8]hstack=inputs=3[row3];
			[row1][row2][row3]vstack=inputs=3
		`

	default:
		// Default to horizontal
		filterComplex = "[0:v]scale=iw/2:ih[left];[1:v]scale=iw/2:ih[right];[left][right]hstack=inputs=2"
	}

	// Build input arguments
	args := []string{}
	for _, video := range opts.Videos {
		args = append(args, "-i", video)
	}

	args = append(args,
		"-filter_complex", filterComplex,
		"-y", opts.Output,
	)

	return c.ffmpeg.Execute(ctx, args...)
}
