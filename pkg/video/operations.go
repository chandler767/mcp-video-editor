package video

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
)

// Operations handles video editing operations
type Operations struct {
	ffmpeg *ffmpeg.Manager
}

// NewOperations creates a new video operations handler
func NewOperations(mgr *ffmpeg.Manager) *Operations {
	return &Operations{ffmpeg: mgr}
}

// VideoInfo contains metadata about a video file
type VideoInfo struct {
	Format      string  `json:"format"`
	Duration    float64 `json:"duration"`
	Width       int     `json:"width"`
	Height      int     `json:"height"`
	FPS         float64 `json:"fps"`
	VideoCodec  string  `json:"videoCodec"`
	AudioCodec  string  `json:"audioCodec"`
	Bitrate     int     `json:"bitrate"`
	Size        int64   `json:"size"`
	Codec       string  `json:"codec"`    // Alias for VideoCodec
	HasAudio    bool    `json:"hasAudio"` // Whether video has audio track
}

// GetVideoInfo retrieves metadata about a video file
func (o *Operations) GetVideoInfo(ctx context.Context, filePath string) (*VideoInfo, error) {
	// Use ffprobe to get video information
	output, err := o.ffmpeg.Probe(ctx,
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		filePath,
	)
	if err != nil {
		return nil, err
	}

	// Parse JSON output
	var probeData struct {
		Format struct {
			Duration   string `json:"duration"`
			FormatName string `json:"format_name"`
			Size       string `json:"size"`
			BitRate    string `json:"bit_rate"`
		} `json:"format"`
		Streams []struct {
			CodecType string `json:"codec_type"`
			CodecName string `json:"codec_name"`
			Width     int    `json:"width"`
			Height    int    `json:"height"`
			RFrameRate string `json:"r_frame_rate"`
		} `json:"streams"`
	}

	if err := json.Unmarshal([]byte(output), &probeData); err != nil {
		return nil, fmt.Errorf("failed to parse ffprobe output: %w", err)
	}

	info := &VideoInfo{
		Format: probeData.Format.FormatName,
	}

	// Parse duration
	if probeData.Format.Duration != "" {
		info.Duration, _ = strconv.ParseFloat(probeData.Format.Duration, 64)
	}

	// Parse size
	if probeData.Format.Size != "" {
		info.Size, _ = strconv.ParseInt(probeData.Format.Size, 10, 64)
	}

	// Parse bitrate
	if probeData.Format.BitRate != "" {
		bitrate, _ := strconv.ParseInt(probeData.Format.BitRate, 10, 64)
		info.Bitrate = int(bitrate)
	}

	// Find video and audio streams
	for _, stream := range probeData.Streams {
		if stream.CodecType == "video" {
			info.Width = stream.Width
			info.Height = stream.Height
			info.VideoCodec = stream.CodecName
			info.Codec = stream.CodecName // Set alias

			// Parse frame rate
			if stream.RFrameRate != "" {
				parts := strings.Split(stream.RFrameRate, "/")
				if len(parts) == 2 {
					num, _ := strconv.ParseFloat(parts[0], 64)
					den, _ := strconv.ParseFloat(parts[1], 64)
					if den != 0 {
						info.FPS = num / den
					}
				}
			}
		} else if stream.CodecType == "audio" {
			info.AudioCodec = stream.CodecName
			info.HasAudio = true
		}
	}

	return info, nil
}

// TrimOptions contains options for trimming a video
type TrimOptions struct {
	Input     string
	Output    string
	StartTime float64
	EndTime   *float64
	Duration  *float64
}

// Trim cuts a video to a specified time range
func (o *Operations) Trim(ctx context.Context, opts TrimOptions) error {
	if err := validateOutputPath(opts.Output, opts.Input); err != nil {
		return err
	}

	args := []string{
		"-i", opts.Input,
		"-ss", fmt.Sprintf("%.2f", opts.StartTime),
	}

	if opts.Duration != nil {
		args = append(args, "-t", fmt.Sprintf("%.2f", *opts.Duration))
	} else if opts.EndTime != nil {
		duration := *opts.EndTime - opts.StartTime
		args = append(args, "-t", fmt.Sprintf("%.2f", duration))
	}

	args = append(args,
		"-c", "copy", // Copy codecs for fast trimming
		"-y", // Overwrite output
		opts.Output,
	)

	return o.ffmpeg.Execute(ctx, args...)
}

// ConcatenateOptions contains options for concatenating videos
type ConcatenateOptions struct {
	Inputs []string
	Output string
}

// Concatenate joins multiple videos together
func (o *Operations) Concatenate(ctx context.Context, opts ConcatenateOptions) error {
	if len(opts.Inputs) < 2 {
		return fmt.Errorf("need at least 2 videos to concatenate")
	}

	for _, input := range opts.Inputs {
		if err := validateOutputPath(opts.Output, input); err != nil {
			return err
		}
	}

	// Create a temporary concat file
	concatFile := filepath.Join(os.TempDir(), "concat_list.txt")
	defer os.Remove(concatFile)

	// Write file list
	var lines []string
	for _, input := range opts.Inputs {
		absPath, _ := filepath.Abs(input)
		lines = append(lines, fmt.Sprintf("file '%s'", absPath))
	}

	if err := os.WriteFile(concatFile, []byte(strings.Join(lines, "\n")), 0644); err != nil {
		return fmt.Errorf("failed to create concat file: %w", err)
	}

	// Run ffmpeg
	args := []string{
		"-f", "concat",
		"-safe", "0",
		"-i", concatFile,
		"-c", "copy",
		"-y",
		opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// ResizeOptions contains options for resizing a video
type ResizeOptions struct {
	Input              string
	Output             string
	Width              int
	Height             int
	MaintainAspectRatio bool
}

// Resize changes the resolution of a video
func (o *Operations) Resize(ctx context.Context, opts ResizeOptions) error {
	if err := validateOutputPath(opts.Output, opts.Input); err != nil {
		return err
	}

	// Build scale filter
	var scale string
	if opts.MaintainAspectRatio {
		if opts.Width > 0 && opts.Height > 0 {
			scale = fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=decrease", opts.Width, opts.Height)
		} else if opts.Width > 0 {
			scale = fmt.Sprintf("scale=%d:-1", opts.Width)
		} else if opts.Height > 0 {
			scale = fmt.Sprintf("scale=-1:%d", opts.Height)
		}
	} else {
		scale = fmt.Sprintf("scale=%d:%d", opts.Width, opts.Height)
	}

	args := []string{
		"-i", opts.Input,
		"-vf", scale,
		"-c:a", "copy",
		"-y",
		opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// ExtractAudioOptions contains options for extracting audio
type ExtractAudioOptions struct {
	Input  string
	Output string
	Format string
}

// ExtractAudio extracts the audio track from a video
func (o *Operations) ExtractAudio(ctx context.Context, opts ExtractAudioOptions) error {
	if err := validateOutputPath(opts.Output, opts.Input); err != nil {
		return err
	}

	format := opts.Format
	if format == "" {
		format = "mp3"
	}

	args := []string{
		"-i", opts.Input,
		"-vn", // No video
		"-acodec", getAudioCodec(format),
		"-y",
		opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// TranscodeOptions contains options for transcoding
type TranscodeOptions struct {
	Input       string
	Output      string
	VideoCodec  string
	AudioCodec  string
	Quality     string
	Preset      string
	MaxWidth    int
	MaxHeight   int
}

// Transcode converts a video to a different format/codec
func (o *Operations) Transcode(ctx context.Context, opts TranscodeOptions) error {
	if err := validateOutputPath(opts.Output, opts.Input); err != nil {
		return err
	}

	args := []string{"-i", opts.Input}

	// Video codec
	if opts.VideoCodec != "" {
		args = append(args, "-c:v", opts.VideoCodec)
	} else {
		args = append(args, "-c:v", "libx264")
	}

	// Audio codec
	if opts.AudioCodec != "" {
		args = append(args, "-c:a", opts.AudioCodec)
	} else {
		args = append(args, "-c:a", "aac")
	}

	// Quality (CRF)
	if opts.Quality != "" {
		crf := qualityToCRF(opts.Quality)
		args = append(args, "-crf", strconv.Itoa(crf))
	}

	// Preset
	if opts.Preset != "" {
		args = append(args, "-preset", opts.Preset)
	}

	// Resolution limit
	if opts.MaxWidth > 0 || opts.MaxHeight > 0 {
		scale := fmt.Sprintf("scale='min(%d,iw)':'min(%d,ih)':force_original_aspect_ratio=decrease",
			opts.MaxWidth, opts.MaxHeight)
		args = append(args, "-vf", scale)
	}

	args = append(args, "-y", opts.Output)

	return o.ffmpeg.Execute(ctx, args...)
}

// Helper functions

func validateOutputPath(output string, inputs ...string) error {
	outputAbs, err := filepath.Abs(output)
	if err != nil {
		return err
	}

	for _, input := range inputs {
		inputAbs, err := filepath.Abs(input)
		if err != nil {
			return err
		}
		if outputAbs == inputAbs {
			return fmt.Errorf("output path cannot be the same as input path: %s", output)
		}
	}

	return nil
}

func getAudioCodec(format string) string {
	switch format {
	case "mp3":
		return "libmp3lame"
	case "aac":
		return "aac"
	case "opus":
		return "libopus"
	case "flac":
		return "flac"
	default:
		return "copy"
	}
}

func qualityToCRF(quality string) int {
	switch quality {
	case "high":
		return 18
	case "medium":
		return 23
	case "low":
		return 28
	default:
		return 23
	}
}

// ExtractFramesOptions contains options for extracting frames
type ExtractFramesOptions struct {
	Input      string
	OutputDir  string
	FPS        *float64 // Frames per second to extract
	StartTime  *float64 // Start time in seconds
	Duration   *float64 // Duration in seconds
	Format     string   // Output format: jpg, png, etc.
	FrameCount *int     // Extract specific number of frames evenly distributed
}

// ExtractFrames extracts frames from video as images
func (o *Operations) ExtractFrames(ctx context.Context, opts ExtractFramesOptions) error {
	if err := validateOutputPath(opts.OutputDir, opts.Input); err != nil {
		return err
	}

	args := []string{"-i", opts.Input}

	// Start time
	if opts.StartTime != nil {
		args = append(args, "-ss", fmt.Sprintf("%.2f", *opts.StartTime))
	}

	// Duration
	if opts.Duration != nil {
		args = append(args, "-t", fmt.Sprintf("%.2f", *opts.Duration))
	}

	// Frame rate or frame count
	if opts.FrameCount != nil {
		// Extract specific number of frames
		args = append(args, "-vf", fmt.Sprintf("select='not(mod(n\\,%d))'", *opts.FrameCount))
		args = append(args, "-vsync", "0")
	} else if opts.FPS != nil {
		// Extract at specific FPS
		args = append(args, "-vf", fmt.Sprintf("fps=%.2f", *opts.FPS))
	}

	// Output format
	format := opts.Format
	if format == "" {
		format = "jpg"
	}

	// Output pattern
	outputPattern := filepath.Join(opts.OutputDir, fmt.Sprintf("frame_%%04d.%s", format))
	args = append(args, "-y", outputPattern)

	return o.ffmpeg.Execute(ctx, args...)
}

// AdjustSpeedOptions contains options for adjusting video speed
type AdjustSpeedOptions struct {
	Input  string
	Output string
	Speed  float64 // Speed multiplier (0.5 = half speed, 2.0 = double speed)
}

// AdjustSpeed changes the playback speed of a video
func (o *Operations) AdjustSpeed(ctx context.Context, opts AdjustSpeedOptions) error {
	if err := validateOutputPath(opts.Output, opts.Input); err != nil {
		return err
	}

	if opts.Speed <= 0 {
		return fmt.Errorf("speed must be positive, got: %.2f", opts.Speed)
	}

	// Calculate PTS and audio tempo
	pts := 1.0 / opts.Speed
	atempo := opts.Speed

	// FFmpeg atempo filter only supports 0.5-2.0 range
	// For values outside this range, chain multiple atempo filters
	atempoFilters := []string{}
	remaining := atempo

	for remaining > 2.0 {
		atempoFilters = append(atempoFilters, "atempo=2.0")
		remaining /= 2.0
	}
	for remaining < 0.5 {
		atempoFilters = append(atempoFilters, "atempo=0.5")
		remaining /= 0.5
	}
	atempoFilters = append(atempoFilters, fmt.Sprintf("atempo=%.4f", remaining))

	videoFilter := fmt.Sprintf("setpts=%.4f*PTS", pts)
	audioFilter := strings.Join(atempoFilters, ",")

	args := []string{
		"-i", opts.Input,
		"-filter:v", videoFilter,
		"-filter:a", audioFilter,
		"-y",
		opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// ConvertVideoOptions contains options for converting video format
type ConvertVideoOptions struct {
	Input        string
	Output       string
	Format       string // Output format: mp4, webm, avi, etc.
	VideoCodec   string // Video codec: h264, vp9, etc.
	AudioCodec   string // Audio codec: aac, opus, etc.
	Quality      string // Quality: high, medium, low
	Bitrate      *int   // Video bitrate in kbps
	AudioBitrate *int   // Audio bitrate in kbps
}

// ConvertVideo converts video to different format
func (o *Operations) ConvertVideo(ctx context.Context, opts ConvertVideoOptions) error {
	if err := validateOutputPath(opts.Output, opts.Input); err != nil {
		return err
	}

	args := []string{"-i", opts.Input}

	// Video codec
	if opts.VideoCodec != "" {
		args = append(args, "-c:v", opts.VideoCodec)
	} else {
		// Auto-select codec based on format
		args = append(args, "-c:v", autoSelectCodec(opts.Format))
	}

	// Audio codec
	if opts.AudioCodec != "" {
		args = append(args, "-c:a", opts.AudioCodec)
	} else {
		args = append(args, "-c:a", "aac")
	}

	// Quality
	if opts.Quality != "" {
		crf := qualityToCRF(opts.Quality)
		args = append(args, "-crf", strconv.Itoa(crf))
	}

	// Video bitrate
	if opts.Bitrate != nil {
		args = append(args, "-b:v", fmt.Sprintf("%dk", *opts.Bitrate))
	}

	// Audio bitrate
	if opts.AudioBitrate != nil {
		args = append(args, "-b:a", fmt.Sprintf("%dk", *opts.AudioBitrate))
	}

	// Format
	if opts.Format != "" {
		args = append(args, "-f", opts.Format)
	}

	args = append(args, "-y", opts.Output)

	return o.ffmpeg.Execute(ctx, args...)
}

// TranscodeForWebOptions contains options for web-optimized transcoding
type TranscodeForWebOptions struct {
	Input      string
	Output     string
	Profile    string // Profile: youtube, vimeo, twitter, instagram, facebook, web
	Resolution string // Resolution: 1080p, 720p, 480p, 360p
	Format     string // Format: mp4 (default), webm
}

// TranscodeForWeb transcodes video for web platforms
func (o *Operations) TranscodeForWeb(ctx context.Context, opts TranscodeForWebOptions) error {
	if err := validateOutputPath(opts.Output, opts.Input); err != nil {
		return err
	}

	profile := opts.Profile
	if profile == "" {
		profile = "web"
	}

	resolution := opts.Resolution
	if resolution == "" {
		resolution = "1080p"
	}

	format := opts.Format
	if format == "" {
		format = "mp4"
	}

	// Get profile-specific settings
	settings := getWebProfileSettings(profile, resolution, format)

	args := []string{"-i", opts.Input}

	// Video codec and settings
	args = append(args, "-c:v", settings.VideoCodec)
	args = append(args, "-crf", strconv.Itoa(settings.CRF))
	args = append(args, "-preset", settings.Preset)

	// Resolution
	if settings.Width > 0 && settings.Height > 0 {
		scale := fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=decrease", settings.Width, settings.Height)
		args = append(args, "-vf", scale)
	}

	// Pixel format
	if settings.PixelFormat != "" {
		args = append(args, "-pix_fmt", settings.PixelFormat)
	}

	// Audio codec and settings
	args = append(args, "-c:a", settings.AudioCodec)
	args = append(args, "-b:a", fmt.Sprintf("%dk", settings.AudioBitrate))

	// MOV flags for MP4 (fast start for web)
	if format == "mp4" {
		args = append(args, "-movflags", "+faststart")
	}

	// Max bitrate
	if settings.MaxBitrate > 0 {
		args = append(args, "-maxrate", fmt.Sprintf("%dk", settings.MaxBitrate))
		args = append(args, "-bufsize", fmt.Sprintf("%dk", settings.MaxBitrate*2))
	}

	args = append(args, "-y", opts.Output)

	return o.ffmpeg.Execute(ctx, args...)
}

// WebProfileSettings contains web profile settings
type WebProfileSettings struct {
	VideoCodec   string
	AudioCodec   string
	CRF          int
	Preset       string
	Width        int
	Height       int
	PixelFormat  string
	AudioBitrate int
	MaxBitrate   int
}

func getWebProfileSettings(profile, resolution, format string) WebProfileSettings {
	settings := WebProfileSettings{
		AudioCodec:   "aac",
		AudioBitrate: 128,
		Preset:       "medium",
		PixelFormat:  "yuv420p",
	}

	// Set codec based on format
	if format == "webm" {
		settings.VideoCodec = "libvpx-vp9"
		settings.AudioCodec = "libopus"
	} else {
		settings.VideoCodec = "libx264"
	}

	// Set resolution
	switch resolution {
	case "1080p":
		settings.Width = 1920
		settings.Height = 1080
		settings.MaxBitrate = 8000
		settings.CRF = 23
	case "720p":
		settings.Width = 1280
		settings.Height = 720
		settings.MaxBitrate = 5000
		settings.CRF = 23
	case "480p":
		settings.Width = 854
		settings.Height = 480
		settings.MaxBitrate = 2500
		settings.CRF = 23
	case "360p":
		settings.Width = 640
		settings.Height = 360
		settings.MaxBitrate = 1000
		settings.CRF = 23
	}

	// Profile-specific optimizations
	switch profile {
	case "youtube":
		settings.CRF = 18
		settings.Preset = "slow"
	case "vimeo":
		settings.CRF = 18
		settings.Preset = "slow"
	case "twitter":
		settings.MaxBitrate = 2000
		settings.AudioBitrate = 128
	case "instagram":
		settings.MaxBitrate = 3500
		settings.AudioBitrate = 128
	case "facebook":
		settings.MaxBitrate = 4000
		settings.AudioBitrate = 128
	}

	return settings
}

func autoSelectCodec(format string) string {
	switch strings.ToLower(format) {
	case "webm":
		return "libvpx-vp9"
	case "avi":
		return "mpeg4"
	case "mkv":
		return "libx264"
	case "mp4", "m4v":
		return "libx264"
	default:
		return "libx264"
	}
}
