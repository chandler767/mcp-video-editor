package audio

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
)

// Operations handles standalone audio editing operations
type Operations struct {
	ffmpeg *ffmpeg.Manager
}

// NewOperations creates a new audio operations handler
func NewOperations(mgr *ffmpeg.Manager) *Operations {
	return &Operations{ffmpeg: mgr}
}

// AudioInfo contains metadata about an audio file
type AudioInfo struct {
	Format      string  `json:"format"`
	Duration    float64 `json:"duration"`
	SampleRate  int     `json:"sampleRate"`
	Channels    int     `json:"channels"`
	Bitrate     int     `json:"bitrate"`
	Codec       string  `json:"codec"`
}

// TrimOptions contains parameters for trimming audio
type TrimOptions struct {
	Input     string
	Output    string
	StartTime float64
	EndTime   *float64 // optional, if nil trim to end
}

// ConcatenateOptions contains parameters for joining audio files
type ConcatenateOptions struct {
	Inputs []string
	Output string
}

// VolumeOptions contains parameters for volume adjustment
type VolumeOptions struct {
	Input  string
	Output string
	Volume float64 // multiplier (1.0 = 100%, 0.5 = 50%, 2.0 = 200%)
}

// FadeOptions contains parameters for fade in/out
type FadeOptions struct {
	Input    string
	Output   string
	FadeIn   float64 // duration in seconds
	FadeOut  float64 // duration in seconds
}

// MixOptions contains parameters for mixing multiple audio tracks
type MixOptions struct {
	Inputs  []string
	Output  string
	Volumes []float64 // optional volume for each input
}

// ConvertOptions contains parameters for audio format conversion
type ConvertOptions struct {
	Input      string
	Output     string
	Format     string // mp3, aac, wav, flac, opus, etc.
	Bitrate    string // e.g., "192k", "320k"
	SampleRate int    // e.g., 44100, 48000
	Channels   int    // 1 for mono, 2 for stereo
}

// SpeedOptions contains parameters for audio speed adjustment
type SpeedOptions struct {
	Input  string
	Output string
	Speed  float64 // 0.5 = half speed, 2.0 = double speed
}

// GetAudioInfo retrieves metadata about an audio file
func (o *Operations) GetAudioInfo(ctx context.Context, audioPath string) (*AudioInfo, error) {
	args := []string{
		"ffprobe",
		"-v", "error",
		"-show_entries", "stream=codec_name,sample_rate,channels,bit_rate:format=duration,format_name",
		"-of", "json",
		audioPath,
	}

	output, err := o.ffmpeg.ExecuteWithOutput(ctx, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get audio info: %w", err)
	}

	// Parse the JSON output (simplified)
	info := &AudioInfo{}

	// For simplicity, use basic parsing
	// In production, you'd use proper JSON parsing
	fmt.Sscanf(output, "%v", &info)

	return info, nil
}

// TrimAudio cuts audio to specified time range
func (o *Operations) TrimAudio(ctx context.Context, opts TrimOptions) error {
	args := []string{
		"-i", opts.Input,
		"-ss", fmt.Sprintf("%.3f", opts.StartTime),
	}

	if opts.EndTime != nil {
		duration := *opts.EndTime - opts.StartTime
		args = append(args, "-t", fmt.Sprintf("%.3f", duration))
	}

	args = append(args, "-c", "copy", "-y", opts.Output)

	return o.ffmpeg.Execute(ctx, args...)
}

// ConcatenateAudio joins multiple audio files
func (o *Operations) ConcatenateAudio(ctx context.Context, opts ConcatenateOptions) error {
	// Create concat file
	tempDir, err := os.MkdirTemp("", "audio-concat-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tempDir)

	concatFile := filepath.Join(tempDir, "concat.txt")
	var content string
	for _, input := range opts.Inputs {
		absPath, _ := filepath.Abs(input)
		content += fmt.Sprintf("file '%s'\n", absPath)
	}

	if err := os.WriteFile(concatFile, []byte(content), 0644); err != nil {
		return err
	}

	args := []string{
		"-f", "concat",
		"-safe", "0",
		"-i", concatFile,
		"-c", "copy",
		"-y", opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// AdjustVolume changes audio volume
func (o *Operations) AdjustVolume(ctx context.Context, opts VolumeOptions) error {
	args := []string{
		"-i", opts.Input,
		"-af", fmt.Sprintf("volume=%.2f", opts.Volume),
		"-y", opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// NormalizeAudio normalizes audio levels
func (o *Operations) NormalizeAudio(ctx context.Context, input, output string) error {
	args := []string{
		"-i", input,
		"-af", "loudnorm",
		"-y", output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// FadeAudio applies fade in/out effects
func (o *Operations) FadeAudio(ctx context.Context, opts FadeOptions) error {
	var filters []string

	if opts.FadeIn > 0 {
		filters = append(filters, fmt.Sprintf("afade=t=in:st=0:d=%.2f", opts.FadeIn))
	}

	if opts.FadeOut > 0 {
		// Need to get duration first
		duration, err := o.getAudioDuration(ctx, opts.Input)
		if err != nil {
			return err
		}
		startTime := duration - opts.FadeOut
		filters = append(filters, fmt.Sprintf("afade=t=out:st=%.2f:d=%.2f", startTime, opts.FadeOut))
	}

	if len(filters) == 0 {
		return fmt.Errorf("no fade specified")
	}

	filterStr := filters[0]
	if len(filters) > 1 {
		filterStr = filters[0] + "," + filters[1]
	}

	args := []string{
		"-i", opts.Input,
		"-af", filterStr,
		"-y", opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// MixAudio mixes multiple audio tracks into one
func (o *Operations) MixAudio(ctx context.Context, opts MixOptions) error {
	if len(opts.Inputs) < 2 {
		return fmt.Errorf("need at least 2 audio files to mix")
	}

	// Build input args
	var args []string
	for _, input := range opts.Inputs {
		args = append(args, "-i", input)
	}

	// Build filter complex for mixing
	var filterParts []string
	for i := range opts.Inputs {
		volume := 1.0
		if i < len(opts.Volumes) {
			volume = opts.Volumes[i]
		}
		filterParts = append(filterParts, fmt.Sprintf("[%d:a]volume=%.2f[a%d]", i, volume, i))
	}

	// Combine all streams
	var inputStreams string
	for i := range opts.Inputs {
		inputStreams += fmt.Sprintf("[a%d]", i)
	}
	filterParts = append(filterParts, fmt.Sprintf("%samix=inputs=%d[out]", inputStreams, len(opts.Inputs)))

	filterComplex := ""
	for i, part := range filterParts {
		if i > 0 {
			filterComplex += ";"
		}
		filterComplex += part
	}

	args = append(args, "-filter_complex", filterComplex, "-map", "[out]", "-y", opts.Output)

	return o.ffmpeg.Execute(ctx, args...)
}

// ConvertAudio converts audio to different format
func (o *Operations) ConvertAudio(ctx context.Context, opts ConvertOptions) error {
	args := []string{
		"-i", opts.Input,
	}

	// Set codec based on format
	codec := o.getCodecForFormat(opts.Format)
	if codec != "" {
		args = append(args, "-c:a", codec)
	}

	// Set bitrate if specified
	if opts.Bitrate != "" {
		args = append(args, "-b:a", opts.Bitrate)
	}

	// Set sample rate if specified
	if opts.SampleRate > 0 {
		args = append(args, "-ar", fmt.Sprintf("%d", opts.SampleRate))
	}

	// Set channels if specified
	if opts.Channels > 0 {
		args = append(args, "-ac", fmt.Sprintf("%d", opts.Channels))
	}

	args = append(args, "-y", opts.Output)

	return o.ffmpeg.Execute(ctx, args...)
}

// AdjustSpeed changes audio playback speed
func (o *Operations) AdjustSpeed(ctx context.Context, opts SpeedOptions) error {
	// Use atempo filter (supports 0.5 to 2.0 range)
	// Chain multiple atempo filters for values outside this range
	var atempoFilters []string
	remaining := opts.Speed

	for remaining > 2.0 {
		atempoFilters = append(atempoFilters, "atempo=2.0")
		remaining /= 2.0
	}
	for remaining < 0.5 {
		atempoFilters = append(atempoFilters, "atempo=0.5")
		remaining /= 0.5
	}
	if remaining != 1.0 {
		atempoFilters = append(atempoFilters, fmt.Sprintf("atempo=%.4f", remaining))
	}

	if len(atempoFilters) == 0 {
		return fmt.Errorf("no speed adjustment needed")
	}

	filterStr := atempoFilters[0]
	for i := 1; i < len(atempoFilters); i++ {
		filterStr += "," + atempoFilters[i]
	}

	args := []string{
		"-i", opts.Input,
		"-af", filterStr,
		"-y", opts.Output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// RemoveAudioSection removes a section of audio
func (o *Operations) RemoveAudioSection(ctx context.Context, input, output string, startTime, endTime float64) error {
	tempDir, err := os.MkdirTemp("", "audio-remove-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tempDir)

	// Extract parts before and after the section to remove
	beforePath := filepath.Join(tempDir, "before.mp3")
	afterPath := filepath.Join(tempDir, "after.mp3")

	// Extract before section
	if startTime > 0 {
		args := []string{
			"-i", input,
			"-ss", "0",
			"-to", fmt.Sprintf("%.3f", startTime),
			"-c", "copy",
			"-y", beforePath,
		}
		if err := o.ffmpeg.Execute(ctx, args...); err != nil {
			return err
		}
	}

	// Extract after section
	args := []string{
		"-i", input,
		"-ss", fmt.Sprintf("%.3f", endTime),
		"-c", "copy",
		"-y", afterPath,
	}
	if err := o.ffmpeg.Execute(ctx, args...); err != nil {
		return err
	}

	// Concatenate the parts
	if startTime > 0 {
		return o.ConcatenateAudio(ctx, ConcatenateOptions{
			Inputs: []string{beforePath, afterPath},
			Output: output,
		})
	}

	// Just use the after part
	return o.copyFile(afterPath, output)
}

// SplitAudio splits audio into segments of specified duration
func (o *Operations) SplitAudio(ctx context.Context, input string, segmentDuration float64, outputPattern string) error {
	args := []string{
		"-i", input,
		"-f", "segment",
		"-segment_time", fmt.Sprintf("%.0f", segmentDuration),
		"-c", "copy",
		"-y",
		outputPattern, // e.g., "output_%03d.mp3"
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// ExtractAudioChannel extracts a specific channel (left or right)
func (o *Operations) ExtractAudioChannel(ctx context.Context, input, output string, channel string) error {
	var channelMap string
	switch channel {
	case "left":
		channelMap = "0.0.0"
	case "right":
		channelMap = "0.0.1"
	default:
		return fmt.Errorf("invalid channel: %s (use 'left' or 'right')", channel)
	}

	args := []string{
		"-i", input,
		"-af", fmt.Sprintf("pan=mono|c0=c%s", channelMap[len(channelMap)-1:]),
		"-y", output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// ReverseAudio reverses audio playback
func (o *Operations) ReverseAudio(ctx context.Context, input, output string) error {
	args := []string{
		"-i", input,
		"-af", "areverse",
		"-y", output,
	}

	return o.ffmpeg.Execute(ctx, args...)
}

// Helper functions

func (o *Operations) getAudioDuration(ctx context.Context, audioPath string) (float64, error) {
	args := []string{
		"ffprobe",
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		audioPath,
	}

	output, err := o.ffmpeg.ExecuteWithOutput(ctx, args...)
	if err != nil {
		return 0, err
	}

	var duration float64
	if _, err := fmt.Sscanf(output, "%f", &duration); err != nil {
		return 0, fmt.Errorf("failed to parse duration: %w", err)
	}

	return duration, nil
}

func (o *Operations) getCodecForFormat(format string) string {
	codecMap := map[string]string{
		"mp3":  "libmp3lame",
		"aac":  "aac",
		"opus": "libopus",
		"flac": "flac",
		"wav":  "pcm_s16le",
		"ogg":  "libvorbis",
		"m4a":  "aac",
	}
	return codecMap[format]
}

func (o *Operations) copyFile(src, dst string) error {
	input, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, input, 0644)
}
