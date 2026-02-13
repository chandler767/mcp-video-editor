package server

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/chandler-mayo/mcp-video-editor/pkg/diagrams"
	"github.com/chandler-mayo/mcp-video-editor/pkg/elements"
	"github.com/chandler-mayo/mcp-video-editor/pkg/text"
	"github.com/chandler-mayo/mcp-video-editor/pkg/video"
	"github.com/chandler-mayo/mcp-video-editor/pkg/visual"
	"github.com/mark3labs/mcp-go/mcp"
)

// Helper function to unmarshal arguments
func unmarshalArgs(args interface{}, target interface{}) error {
	argsJSON, err := json.Marshal(args)
	if err != nil {
		return err
	}
	return json.Unmarshal(argsJSON, target)
}

// Handler implementations for all MCP tools

func (s *MCPServer) handleGetVideoInfo(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		FilePath string `json:"filePath"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	info, err := s.videoOps.GetVideoInfo(context.Background(), args.FilePath)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to get video info: %v", err)), nil
	}

	result := fmt.Sprintf(`Video Info:
- Duration: %.2f seconds
- Width: %d
- Height: %d
- Codec: %s
- FPS: %.2f
- Bitrate: %.2f kbps
- Has Audio: %t`,
		info.Duration,
		info.Width,
		info.Height,
		info.Codec,
		info.FPS,
		float64(info.Bitrate)/1000,
		info.HasAudio,
	)

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleTrimVideo(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input     string   `json:"input"`
		Output    string   `json:"output"`
		StartTime float64  `json:"startTime"`
		EndTime   *float64 `json:"endTime"`
		Duration  *float64 `json:"duration"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := video.TrimOptions{
		Input:     args.Input,
		Output:    args.Output,
		StartTime: args.StartTime,
		Duration:  args.Duration,
		EndTime:   args.EndTime,
	}

	if err := s.videoOps.Trim(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to trim video: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully trimmed video to: %s", args.Output)), nil
}

func (s *MCPServer) handleConcatenateVideos(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Inputs []string `json:"inputs"`
		Output string   `json:"output"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := video.ConcatenateOptions{
		Inputs: args.Inputs,
		Output: args.Output,
	}

	if err := s.videoOps.Concatenate(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to concatenate videos: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully concatenated %d videos to: %s", len(args.Inputs), args.Output)), nil
}

func (s *MCPServer) handleResizeVideo(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input               string `json:"input"`
		Output              string `json:"output"`
		Width               *int   `json:"width"`
		Height              *int   `json:"height"`
		MaintainAspectRatio *bool  `json:"maintainAspectRatio"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := video.ResizeOptions{
		Input:  args.Input,
		Output: args.Output,
	}

	if args.Width != nil {
		opts.Width = *args.Width
	}
	if args.Height != nil {
		opts.Height = *args.Height
	}
	if args.MaintainAspectRatio != nil {
		opts.MaintainAspectRatio = *args.MaintainAspectRatio
	}

	if err := s.videoOps.Resize(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to resize video: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully resized video to: %s", args.Output)), nil
}

func (s *MCPServer) handleExtractAudio(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input  string  `json:"input"`
		Output string  `json:"output"`
		Format *string `json:"format"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := video.ExtractAudioOptions{
		Input:  args.Input,
		Output: args.Output,
	}

	if args.Format != nil {
		opts.Format = *args.Format
	}

	if err := s.videoOps.ExtractAudio(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to extract audio: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully extracted audio to: %s", args.Output)), nil
}

func (s *MCPServer) handleTranscodeVideo(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input   string  `json:"input"`
		Output  string  `json:"output"`
		Quality *string `json:"quality"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := video.TranscodeOptions{
		Input:  args.Input,
		Output: args.Output,
	}

	if args.Quality != nil {
		opts.Quality = *args.Quality
	}

	if err := s.videoOps.Transcode(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to transcode video: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully transcoded video to: %s", args.Output)), nil
}

func (s *MCPServer) handleApplyBlur(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input    string   `json:"input"`
		Output   string   `json:"output"`
		Type     *string  `json:"type"`
		Strength *float64 `json:"strength"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := visual.BlurOptions{
		Input:  args.Input,
		Output: args.Output,
	}

	if args.Type != nil {
		opts.Type = *args.Type
	}
	if args.Strength != nil {
		opts.Strength = *args.Strength
	}

	if err := s.visualFx.ApplyBlur(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to apply blur: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully applied blur effect to: %s", args.Output)), nil
}

func (s *MCPServer) handleApplyColorGrade(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input       string   `json:"input"`
		Output      string   `json:"output"`
		Brightness  *float64 `json:"brightness"`
		Contrast    *float64 `json:"contrast"`
		Saturation  *float64 `json:"saturation"`
		Gamma       *float64 `json:"gamma"`
		Hue         *float64 `json:"hue"`
		Temperature *float64 `json:"temperature"`
		Tint        *float64 `json:"tint"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := visual.ColorGradeOptions{
		Input:       args.Input,
		Output:      args.Output,
		Brightness:  args.Brightness,
		Contrast:    args.Contrast,
		Saturation:  args.Saturation,
		Gamma:       args.Gamma,
		Hue:         args.Hue,
		Temperature: args.Temperature,
		Tint:        args.Tint,
	}

	if err := s.visualFx.ApplyColorGrade(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to apply color grade: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully applied color grading to: %s", args.Output)), nil
}

func (s *MCPServer) handleApplyChromaKey(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input      string   `json:"input"`
		Output     string   `json:"output"`
		KeyColor   *string  `json:"keyColor"`
		Similarity *float64 `json:"similarity"`
		Blend      *float64 `json:"blend"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := visual.ChromaKeyOptions{
		Input:  args.Input,
		Output: args.Output,
	}

	if args.KeyColor != nil {
		opts.KeyColor = *args.KeyColor
	}
	if args.Similarity != nil {
		opts.Similarity = *args.Similarity
	}
	if args.Blend != nil {
		opts.Blend = *args.Blend
	}

	if err := s.visualFx.ApplyChromaKey(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to apply chroma key: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully applied chroma key to: %s", args.Output)), nil
}

func (s *MCPServer) handleApplyVignette(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input     string   `json:"input"`
		Output    string   `json:"output"`
		Intensity *float64 `json:"intensity"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := visual.VignetteOptions{
		Input:  args.Input,
		Output: args.Output,
	}

	if args.Intensity != nil {
		opts.Intensity = *args.Intensity
	}

	if err := s.visualFx.ApplyVignette(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to apply vignette: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully applied vignette to: %s", args.Output)), nil
}

func (s *MCPServer) handleApplySharpen(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input    string   `json:"input"`
		Output   string   `json:"output"`
		Strength *float64 `json:"strength"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := visual.SharpenOptions{
		Input:  args.Input,
		Output: args.Output,
	}

	if args.Strength != nil {
		opts.Strength = *args.Strength
	}

	if err := s.visualFx.ApplySharpen(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to apply sharpen: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully applied sharpen effect to: %s", args.Output)), nil
}

func (s *MCPServer) handleCreatePictureInPicture(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		MainVideo string  `json:"mainVideo"`
		PipVideo  string  `json:"pipVideo"`
		Output    string  `json:"output"`
		Position  *string `json:"position"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := visual.PictureInPictureOptions{
		MainVideo: args.MainVideo,
		PipVideo:  args.PipVideo,
		Output:    args.Output,
	}

	if args.Position != nil {
		opts.Position = *args.Position
	}

	if err := s.composite.CreatePictureInPicture(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to create picture-in-picture: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully created picture-in-picture: %s", args.Output)), nil
}

func (s *MCPServer) handleCreateSplitScreen(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Videos []string `json:"videos"`
		Output string   `json:"output"`
		Layout string   `json:"layout"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := visual.SplitScreenOptions{
		Videos: args.Videos,
		Output: args.Output,
		Layout: args.Layout,
	}

	if err := s.composite.CreateSplitScreen(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to create split screen: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully created split screen with %d videos: %s", len(args.Videos), args.Output)), nil
}

func (s *MCPServer) handleAddTransition(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input1   string   `json:"input1"`
		Input2   string   `json:"input2"`
		Output   string   `json:"output"`
		Type     string   `json:"type"`
		Duration *float64 `json:"duration"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := visual.TransitionOptions{
		Input1: args.Input1,
		Input2: args.Input2,
		Output: args.Output,
		Type:   args.Type,
	}

	if args.Duration != nil {
		opts.Duration = *args.Duration
	}

	if err := s.transitions.AddTransition(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to add transition: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully added %s transition to: %s", args.Type, args.Output)), nil
}

func (s *MCPServer) handleCrossfadeVideos(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input1   string   `json:"input1"`
		Input2   string   `json:"input2"`
		Output   string   `json:"output"`
		Duration *float64 `json:"duration"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := visual.CrossfadeOptions{
		Input1: args.Input1,
		Input2: args.Input2,
		Output: args.Output,
	}

	if args.Duration != nil {
		opts.Duration = *args.Duration
	}

	if err := s.transitions.Crossfade(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to crossfade videos: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully crossfaded videos to: %s", args.Output)), nil
}

// Text operation handlers

func (s *MCPServer) handleAddTextOverlay(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input       string   `json:"input"`
		Output      string   `json:"output"`
		Text        string   `json:"text"`
		Position    *string  `json:"position"`
		X           *string  `json:"x"`
		Y           *string  `json:"y"`
		FontSize    *int     `json:"fontSize"`
		FontColor   *string  `json:"fontColor"`
		BorderWidth *int     `json:"borderWidth"`
		StartTime   *float64 `json:"startTime"`
		Duration    *float64 `json:"duration"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := text.TextOverlayOptions{
		Input:  args.Input,
		Output: args.Output,
		Text:   args.Text,
	}

	if args.Position != nil {
		opts.Position = text.TextPosition(*args.Position)
	}
	if args.X != nil {
		opts.X = *args.X
	}
	if args.Y != nil {
		opts.Y = *args.Y
	}
	if args.FontSize != nil {
		opts.FontSize = *args.FontSize
	}
	if args.FontColor != nil {
		opts.FontColor = *args.FontColor
	}
	if args.BorderWidth != nil {
		opts.BorderWidth = *args.BorderWidth
	}
	if args.StartTime != nil {
		opts.StartTime = args.StartTime
	}
	if args.Duration != nil {
		opts.Duration = args.Duration
	}

	if err := s.textOps.AddTextOverlay(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to add text overlay: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully added text overlay to: %s", args.Output)), nil
}

func (s *MCPServer) handleAddAnimatedText(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input             string   `json:"input"`
		Output            string   `json:"output"`
		Text              string   `json:"text"`
		Animation         string   `json:"animation"`
		AnimationDuration *float64 `json:"animationDuration"`
		FontSize          *int     `json:"fontSize"`
		FontColor         *string  `json:"fontColor"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := text.AnimatedTextOptions{
		TextOverlayOptions: text.TextOverlayOptions{
			Input:  args.Input,
			Output: args.Output,
			Text:   args.Text,
		},
		Animation: text.AnimationType(args.Animation),
	}

	if args.AnimationDuration != nil {
		opts.AnimationDuration = *args.AnimationDuration
	}
	if args.FontSize != nil {
		opts.FontSize = *args.FontSize
	}
	if args.FontColor != nil {
		opts.FontColor = *args.FontColor
	}

	if err := s.textOps.AddAnimatedText(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to add animated text: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully added animated text to: %s", args.Output)), nil
}

func (s *MCPServer) handleBurnSubtitles(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input        string  `json:"input"`
		Output       string  `json:"output"`
		SubtitleFile string  `json:"subtitleFile"`
		FontSize     *int    `json:"fontSize"`
		FontColor    *string `json:"fontColor"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := text.SubtitleOptions{
		Input:        args.Input,
		Output:       args.Output,
		SubtitleFile: args.SubtitleFile,
	}

	if args.FontSize != nil {
		opts.FontSize = *args.FontSize
	}
	if args.FontColor != nil {
		opts.FontColor = *args.FontColor
	}

	if err := s.textOps.BurnSubtitles(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to burn subtitles: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully burned subtitles into: %s", args.Output)), nil
}

// Additional video operation handlers

func (s *MCPServer) handleExtractFrames(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input      string   `json:"input"`
		OutputDir  string   `json:"outputDir"`
		FPS        *float64 `json:"fps"`
		Format     *string  `json:"format"`
		StartTime  *float64 `json:"startTime"`
		Duration   *float64 `json:"duration"`
		FrameCount *int     `json:"frameCount"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := video.ExtractFramesOptions{
		Input:      args.Input,
		OutputDir:  args.OutputDir,
		FPS:        args.FPS,
		StartTime:  args.StartTime,
		Duration:   args.Duration,
		FrameCount: args.FrameCount,
	}

	if args.Format != nil {
		opts.Format = *args.Format
	}

	if err := s.videoOps.ExtractFrames(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to extract frames: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully extracted frames to: %s", args.OutputDir)), nil
}

func (s *MCPServer) handleAdjustSpeed(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input  string  `json:"input"`
		Output string  `json:"output"`
		Speed  float64 `json:"speed"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := video.AdjustSpeedOptions{
		Input:  args.Input,
		Output: args.Output,
		Speed:  args.Speed,
	}

	if err := s.videoOps.AdjustSpeed(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to adjust speed: %v", err)), nil
	}

	speedDesc := "normal"
	if args.Speed < 1.0 {
		speedDesc = fmt.Sprintf("%.1fx slow motion", 1.0/args.Speed)
	} else if args.Speed > 1.0 {
		speedDesc = fmt.Sprintf("%.1fx fast forward", args.Speed)
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully adjusted video speed to %s: %s", speedDesc, args.Output)), nil
}

func (s *MCPServer) handleConvertVideo(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input        string  `json:"input"`
		Output       string  `json:"output"`
		Format       *string `json:"format"`
		VideoCodec   *string `json:"videoCodec"`
		AudioCodec   *string `json:"audioCodec"`
		Quality      *string `json:"quality"`
		Bitrate      *int    `json:"bitrate"`
		AudioBitrate *int    `json:"audioBitrate"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := video.ConvertVideoOptions{
		Input:        args.Input,
		Output:       args.Output,
		Bitrate:      args.Bitrate,
		AudioBitrate: args.AudioBitrate,
	}

	if args.Format != nil {
		opts.Format = *args.Format
	}
	if args.VideoCodec != nil {
		opts.VideoCodec = *args.VideoCodec
	}
	if args.AudioCodec != nil {
		opts.AudioCodec = *args.AudioCodec
	}
	if args.Quality != nil {
		opts.Quality = *args.Quality
	}

	if err := s.videoOps.ConvertVideo(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to convert video: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully converted video to: %s", args.Output)), nil
}

func (s *MCPServer) handleTranscodeForWeb(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input      string  `json:"input"`
		Output     string  `json:"output"`
		Profile    *string `json:"profile"`
		Resolution *string `json:"resolution"`
		Format     *string `json:"format"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := video.TranscodeForWebOptions{
		Input:  args.Input,
		Output: args.Output,
	}

	if args.Profile != nil {
		opts.Profile = *args.Profile
	}
	if args.Resolution != nil {
		opts.Resolution = *args.Resolution
	}
	if args.Format != nil {
		opts.Format = *args.Format
	}

	if err := s.videoOps.TranscodeForWeb(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to transcode for web: %v", err)), nil
	}

	profile := "web"
	if args.Profile != nil {
		profile = *args.Profile
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully transcoded video for %s to: %s", profile, args.Output)), nil
}

// Config management handlers

func (s *MCPServer) handleGetConfig(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	configMap := s.config.ToMap()

	// Convert to JSON for nice formatting
	configJSON, err := json.MarshalIndent(configMap, "", "  ")
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to format config: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Current Configuration:\n%s", string(configJSON))), nil
}

func (s *MCPServer) handleSetConfig(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Updates map[string]interface{} `json:"updates"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	if err := s.config.Update(args.Updates); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to update config: %v", err)), nil
	}

	return mcp.NewToolResultText("Successfully updated configuration"), nil
}

func (s *MCPServer) handleResetConfig(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	if err := s.config.Reset(); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to reset config: %v", err)), nil
	}

	return mcp.NewToolResultText("Successfully reset configuration to defaults"), nil
}

// Ken Burns effect handler

func (s *MCPServer) handleApplyKenBurns(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input     string   `json:"input"`
		Output    string   `json:"output"`
		Duration  *float64 `json:"duration"`
		StartZoom *float64 `json:"startZoom"`
		EndZoom   *float64 `json:"endZoom"`
		StartX    *float64 `json:"startX"`
		StartY    *float64 `json:"startY"`
		EndX      *float64 `json:"endX"`
		EndY      *float64 `json:"endY"`
		Width     *int     `json:"width"`
		Height    *int     `json:"height"`
		FPS       *int     `json:"fps"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := visual.KenBurnsOptions{
		Input:  args.Input,
		Output: args.Output,
	}

	if args.Duration != nil {
		opts.Duration = *args.Duration
	}
	if args.StartZoom != nil {
		opts.StartZoom = *args.StartZoom
	}
	if args.EndZoom != nil {
		opts.EndZoom = *args.EndZoom
	}
	if args.StartX != nil {
		opts.StartX = args.StartX
	}
	if args.StartY != nil {
		opts.StartY = args.StartY
	}
	if args.EndX != nil {
		opts.EndX = args.EndX
	}
	if args.EndY != nil {
		opts.EndY = args.EndY
	}
	if args.Width != nil {
		opts.Width = *args.Width
	}
	if args.Height != nil {
		opts.Height = *args.Height
	}
	if args.FPS != nil {
		opts.FPS = *args.FPS
	}

	if err := s.visualFx.ApplyKenBurns(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to apply Ken Burns effect: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully applied Ken Burns effect to: %s", args.Output)), nil
}

// Visual elements handlers

func (s *MCPServer) handleAddImageOverlay(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input     string   `json:"input"`
		Output    string   `json:"output"`
		Image     string   `json:"image"`
		X         *string  `json:"x"`
		Y         *string  `json:"y"`
		Position  *string  `json:"position"`
		Width     *int     `json:"width"`
		Height    *int     `json:"height"`
		Scale     *float64 `json:"scale"`
		Opacity   *float64 `json:"opacity"`
		Rotation  *float64 `json:"rotation"`
		StartTime *float64 `json:"startTime"`
		Duration  *float64 `json:"duration"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := elements.ImageOverlayOptions{
		Input:     args.Input,
		Output:    args.Output,
		Image:     args.Image,
		X:         args.X,
		Y:         args.Y,
		Width:     args.Width,
		Height:    args.Height,
		Scale:     args.Scale,
		Opacity:   args.Opacity,
		Rotation:  args.Rotation,
		StartTime: args.StartTime,
		Duration:  args.Duration,
	}

	if args.Position != nil {
		opts.Position = *args.Position
	}

	if err := s.elements.AddImageOverlay(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to add image overlay: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully added image overlay to: %s", args.Output)), nil
}

func (s *MCPServer) handleAddShape(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input       string              `json:"input"`
		Output      string              `json:"output"`
		Shape       string              `json:"shape"`
		X           int                 `json:"x"`
		Y           int                 `json:"y"`
		Width       *int                `json:"width"`
		Height      *int                `json:"height"`
		Radius      *int                `json:"radius"`
		X2          *int                `json:"x2"`
		Y2          *int                `json:"y2"`
		Points      []elements.Point    `json:"points"`
		Color       *string             `json:"color"`
		BorderColor *string             `json:"borderColor"`
		BorderWidth *int                `json:"borderWidth"`
		Opacity     *float64            `json:"opacity"`
		StartTime   *float64            `json:"startTime"`
		Duration    *float64            `json:"duration"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	opts := elements.ShapeOptions{
		Input:       args.Input,
		Output:      args.Output,
		Shape:       args.Shape,
		X:           args.X,
		Y:           args.Y,
		Width:       args.Width,
		Height:      args.Height,
		Radius:      args.Radius,
		X2:          args.X2,
		Y2:          args.Y2,
		Points:      args.Points,
		BorderColor: args.BorderColor,
		StartTime:   args.StartTime,
		Duration:    args.Duration,
	}

	// Set color with default
	if args.Color != nil {
		opts.Color = *args.Color
	} else {
		opts.Color = "white"
	}

	// Set border width with default
	if args.BorderWidth != nil {
		opts.BorderWidth = *args.BorderWidth
	} else {
		opts.BorderWidth = 0
	}

	// Set opacity with default
	if args.Opacity != nil {
		opts.Opacity = *args.Opacity
	} else {
		opts.Opacity = 1.0
	}

	if err := s.elements.DrawShape(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to add shape: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully added %s shape to: %s", args.Shape, args.Output)), nil
}

// Transcript operation handlers

func (s *MCPServer) handleExtractTranscript(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		VideoPath  string  `json:"videoPath"`
		Language   *string `json:"language"`
		OutputPath *string `json:"outputPath"`
		Format     *string `json:"format"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	language := ""
	if args.Language != nil {
		language = *args.Language
	}

	// Extract transcript
	trans, err := s.transcriptOps.ExtractTranscript(context.Background(), args.VideoPath, language)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to extract transcript: %v", err)), nil
	}

	// Determine output format
	format := "json"
	if args.Format != nil {
		format = *args.Format
	}

	var outputText string
	switch format {
	case "text":
		outputText = s.transcriptOps.FormatAsText(trans)
	case "srt":
		outputText = s.transcriptOps.FormatAsSRT(trans)
	default: // json
		data, err := json.MarshalIndent(trans, "", "  ")
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("Failed to format transcript: %v", err)), nil
		}
		outputText = string(data)
	}

	// Save to file if output path provided
	if args.OutputPath != nil {
		if err := s.transcriptOps.SaveTranscript(trans, *args.OutputPath); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("Failed to save transcript: %v", err)), nil
		}
	}

	result := fmt.Sprintf("Successfully extracted transcript:\n- Duration: %.2f seconds\n- Segments: %d\n- Language: %s\n\n%s",
		trans.Duration,
		len(trans.Segments),
		trans.Language,
		outputText)

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleFindInTranscript(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		TranscriptPath string `json:"transcriptPath"`
		SearchText     string `json:"searchText"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	// Load transcript
	trans, err := s.transcriptOps.LoadTranscript(args.TranscriptPath)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to load transcript: %v", err)), nil
	}

	// Search for text
	matches := s.transcriptOps.FindInTranscript(trans, args.SearchText)

	if len(matches) == 0 {
		return mcp.NewToolResultText(fmt.Sprintf("No matches found for: %s", args.SearchText)), nil
	}

	// Format results
	var results []string
	results = append(results, fmt.Sprintf("Found %d match(es) for '%s':\n", len(matches), args.SearchText))
	for i, match := range matches {
		results = append(results, fmt.Sprintf("%d. [%.2fs - %.2fs] %s (confidence: %.1f%%)",
			i+1, match.Start, match.End, match.Text, match.Confidence*100))
	}

	return mcp.NewToolResultText(strings.Join(results, "\n")), nil
}

func (s *MCPServer) handleRemoveByTranscript(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input          string `json:"input"`
		Output         string `json:"output"`
		TranscriptPath string `json:"transcriptPath"`
		TextToRemove   string `json:"textToRemove"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	// Load transcript
	trans, err := s.transcriptOps.LoadTranscript(args.TranscriptPath)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to load transcript: %v", err)), nil
	}

	// Calculate timestamps to remove
	toRemove := s.transcriptOps.CalculateTimestampsToRemove(trans, args.TextToRemove)

	if len(toRemove) == 0 {
		return mcp.NewToolResultError("No matching text found to remove"), nil
	}

	// Invert to get segments to keep
	toKeep := s.transcriptOps.InvertTimeRanges(toRemove, trans.Duration)

	if len(toKeep) == 0 {
		return mcp.NewToolResultError("Removing specified text would result in empty video"), nil
	}

	// Concatenate the segments to keep
	// We need to trim each segment and then concatenate them
	// This requires multiple FFmpeg operations

	// For now, we'll use the video operations to trim and concatenate
	// Create temp files for each segment
	var segmentPaths []string
	for i, seg := range toKeep {
		segmentPath := fmt.Sprintf("%s_segment_%d.mp4", args.Output[:len(args.Output)-4], i)
		duration := seg.End - seg.Start

		trimOpts := video.TrimOptions{
			Input:     args.Input,
			Output:    segmentPath,
			StartTime: seg.Start,
			Duration:  &duration,
		}

		if err := s.videoOps.Trim(context.Background(), trimOpts); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("Failed to trim segment %d: %v", i, err)), nil
		}

		segmentPaths = append(segmentPaths, segmentPath)
	}

	// Concatenate all segments
	concatOpts := video.ConcatenateOptions{
		Inputs: segmentPaths,
		Output: args.Output,
	}

	if err := s.videoOps.Concatenate(context.Background(), concatOpts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to concatenate segments: %v", err)), nil
	}

	// Clean up temp files
	for _, path := range segmentPaths {
		_ = os.Remove(path)
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully removed text from video. Removed %d segment(s). Output: %s", len(toRemove), args.Output)), nil
}

func (s *MCPServer) handleTrimToScript(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input          string `json:"input"`
		Output         string `json:"output"`
		TranscriptPath string `json:"transcriptPath"`
		Script         string `json:"script"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	// Load transcript
	trans, err := s.transcriptOps.LoadTranscript(args.TranscriptPath)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to load transcript: %v", err)), nil
	}

	// Calculate timestamps to keep
	toKeep := s.transcriptOps.CalculateTimestampsToKeep(trans, args.Script)

	if len(toKeep) == 0 {
		return mcp.NewToolResultError("No matching text found in script"), nil
	}

	// Trim and concatenate segments
	var segmentPaths []string
	for i, seg := range toKeep {
		segmentPath := fmt.Sprintf("%s_segment_%d.mp4", args.Output[:len(args.Output)-4], i)
		duration := seg.End - seg.Start

		trimOpts := video.TrimOptions{
			Input:     args.Input,
			Output:    segmentPath,
			StartTime: seg.Start,
			Duration:  &duration,
		}

		if err := s.videoOps.Trim(context.Background(), trimOpts); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("Failed to trim segment %d: %v", i, err)), nil
		}

		segmentPaths = append(segmentPaths, segmentPath)
	}

	// Concatenate all segments
	concatOpts := video.ConcatenateOptions{
		Inputs: segmentPaths,
		Output: args.Output,
	}

	if err := s.videoOps.Concatenate(context.Background(), concatOpts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to concatenate segments: %v", err)), nil
	}

	// Clean up temp files
	for _, path := range segmentPaths {
		_ = os.Remove(path)
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully trimmed video to script. Kept %d segment(s). Output: %s", len(toKeep), args.Output)), nil
}

// Timeline operation handlers

func (s *MCPServer) handleCreateTimeline(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Name     string  `json:"name"`
		BaseFile *string `json:"baseFile"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	timeline, err := s.timeline.CreateTimeline(args.Name, args.BaseFile)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to create timeline: %v", err)), nil
	}

	result := fmt.Sprintf("Successfully created timeline:\n- ID: %s\n- Name: %s\n- Created: %s",
		timeline.ID,
		timeline.Name,
		timeline.Created.Format("2006-01-02 15:04:05"))

	if timeline.BaseFile != nil {
		result += fmt.Sprintf("\n- Base file: %s", *timeline.BaseFile)
	}

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleAddToTimeline(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		TimelineID  string                 `json:"timelineId"`
		Operation   string                 `json:"operation"`
		Description string                 `json:"description"`
		Input       string                 `json:"input"`
		Output      string                 `json:"output"`
		Parameters  map[string]interface{} `json:"parameters"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	if args.Parameters == nil {
		args.Parameters = make(map[string]interface{})
	}

	timeline, err := s.timeline.AddOperation(
		args.TimelineID,
		args.Operation,
		args.Description,
		args.Input,
		args.Output,
		args.Parameters,
		nil,
	)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to add operation: %v", err)), nil
	}

	result := fmt.Sprintf("Successfully added operation to timeline:\n- Operation: %s\n- Description: %s\n- Timeline position: %d/%d\n- Can undo: %t\n- Can redo: %t",
		args.Operation,
		args.Description,
		timeline.CurrentIndex+1,
		len(timeline.Operations),
		timeline.CurrentIndex >= 0,
		timeline.CurrentIndex < len(timeline.Operations)-1)

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleViewTimeline(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		TimelineID string `json:"timelineId"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	history, err := s.timeline.GetHistory(args.TimelineID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to get timeline history: %v", err)), nil
	}

	return mcp.NewToolResultText(history), nil
}

func (s *MCPServer) handleJumpToTimelinePoint(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		TimelineID string `json:"timelineId"`
		Index      int    `json:"index"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	timeline, output, err := s.timeline.JumpTo(args.TimelineID, args.Index)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to jump to timeline point: %v", err)), nil
	}

	result := fmt.Sprintf("Jumped to timeline position %d/%d",
		timeline.CurrentIndex+1,
		len(timeline.Operations))

	if output != nil {
		result += fmt.Sprintf("\nCurrent output: %s", *output)
	} else {
		result += "\nAt base state (before any operations)"
	}

	result += fmt.Sprintf("\nCan undo: %t\nCan redo: %t",
		timeline.CurrentIndex >= 0,
		timeline.CurrentIndex < len(timeline.Operations)-1)

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleUndo(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		TimelineID string `json:"timelineId"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	timeline, previousOutput, err := s.timeline.Undo(args.TimelineID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to undo: %v", err)), nil
	}

	if timeline.CurrentIndex < 0 {
		result := "Already at the beginning of the timeline"
		if previousOutput != nil {
			result += fmt.Sprintf("\nBase file: %s", *previousOutput)
		}
		return mcp.NewToolResultText(result), nil
	}

	result := fmt.Sprintf("Successfully undone. Timeline position: %d/%d",
		timeline.CurrentIndex+1,
		len(timeline.Operations))

	if previousOutput != nil {
		result += fmt.Sprintf("\nCurrent output: %s", *previousOutput)
	}

	result += fmt.Sprintf("\nCan undo: %t\nCan redo: %t",
		timeline.CurrentIndex >= 0,
		timeline.CurrentIndex < len(timeline.Operations)-1)

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleRedo(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		TimelineID string `json:"timelineId"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	timeline, nextOutput, err := s.timeline.Redo(args.TimelineID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to redo: %v", err)), nil
	}

	if timeline.CurrentIndex >= len(timeline.Operations)-1 && nextOutput == nil {
		return mcp.NewToolResultText("Already at the end of the timeline. Nothing to redo."), nil
	}

	result := fmt.Sprintf("Successfully redone. Timeline position: %d/%d",
		timeline.CurrentIndex+1,
		len(timeline.Operations))

	if nextOutput != nil {
		result += fmt.Sprintf("\nCurrent output: %s", *nextOutput)
	}

	result += fmt.Sprintf("\nCan undo: %t\nCan redo: %t",
		timeline.CurrentIndex >= 0,
		timeline.CurrentIndex < len(timeline.Operations)-1)

	return mcp.NewToolResultText(result), nil
}

// Multi-take handlers

func (s *MCPServer) handleCreateMultiTakeProject(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Name   string `json:"name"`
		Script string `json:"script"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	project, err := s.multitake.CreateProject(args.Name, args.Script, nil)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to create project: %v", err)), nil
	}

	result := fmt.Sprintf("Multi-take project created successfully!\nProject ID: %s\nName: %s\nScript sections: %d\nStatus: %s",
		project.ID,
		project.Name,
		len(project.Sections),
		project.Status)

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleAddTakesToProject(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		ProjectID string   `json:"projectId"`
		TakePaths []string `json:"takePaths"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	project, err := s.multitake.LoadProject(args.ProjectID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to load project: %v", err)), nil
	}

	added, err := s.multitake.AddTakes(project, args.TakePaths, true)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to add takes: %v", err)), nil
	}

	if err := s.multitake.SaveProject(project); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to save project: %v", err)), nil
	}

	result := fmt.Sprintf("Takes added successfully!\nProject ID: %s\nTakes added: %d\nTotal takes: %d\nStatus: %s",
		project.ID,
		added,
		len(project.Takes),
		project.Status)

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleAnalyzeTakes(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		ProjectID string `json:"projectId"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	project, err := s.multitake.LoadProject(args.ProjectID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to load project: %v", err)), nil
	}

	if err := s.multitake.AnalyzeTakes(project); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to analyze takes: %v", err)), nil
	}

	if err := s.multitake.SaveProject(project); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to save project: %v", err)), nil
	}

	result := fmt.Sprintf("Takes analyzed successfully!\nProject ID: %s\nStatus: %s\n\nAnalysis complete. Ready to select best takes.",
		project.ID,
		project.Status)

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleSelectBestTakes(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		ProjectID string `json:"projectId"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	project, err := s.multitake.LoadProject(args.ProjectID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to load project: %v", err)), nil
	}

	if err := s.multitake.SelectBestTakes(project); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to select best takes: %v", err)), nil
	}

	if err := s.multitake.SaveProject(project); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to save project: %v", err)), nil
	}

	result := fmt.Sprintf("Best takes selected!\nProject ID: %s\nBest takes: %d\nStatus: %s\n\nReady to assemble final video.",
		project.ID,
		len(project.BestTakes),
		project.Status)

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleAssembleBestTakes(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		ProjectID string `json:"projectId"`
		Output    string `json:"output"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	project, err := s.multitake.LoadProject(args.ProjectID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to load project: %v", err)), nil
	}

	if err := s.multitake.AssembleFinal(project, args.Output); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to assemble video: %v", err)), nil
	}

	result := fmt.Sprintf("Final video assembled successfully!\nOutput: %s",
		args.Output)

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleListMultiTakeProjects(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	projects, err := s.multitake.ListProjects()
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to list projects: %v", err)), nil
	}

	if len(projects) == 0 {
		return mcp.NewToolResultText("No multi-take projects found."), nil
	}

	var result strings.Builder
	result.WriteString(fmt.Sprintf("Found %d multi-take project(s):\n\n", len(projects)))

	for i, proj := range projects {
		result.WriteString(fmt.Sprintf("%d. %s\n", i+1, proj.Name))
		result.WriteString(fmt.Sprintf("   ID: %s\n", proj.ID))
		result.WriteString(fmt.Sprintf("   Created: %s\n", proj.Created.Format("2006-01-02 15:04:05")))
		result.WriteString(fmt.Sprintf("   Modified: %s\n", proj.Modified.Format("2006-01-02 15:04:05")))
		result.WriteString(fmt.Sprintf("   Takes: %d\n", proj.TakeCount))
		result.WriteString(fmt.Sprintf("   Status: %s\n", proj.Status))
		result.WriteString("\n")
	}

	return mcp.NewToolResultText(result.String()), nil
}

func (s *MCPServer) handleCleanupProjectTemp(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		ProjectID string `json:"projectId"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	project, err := s.multitake.LoadProject(args.ProjectID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to load project: %v", err)), nil
	}

	filesRemoved, err := s.multitake.CleanupTemp(project)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to cleanup: %v", err)), nil
	}

	result := fmt.Sprintf("Temporary files cleaned up successfully.\nFiles removed: %d", filesRemoved)
	return mcp.NewToolResultText(result), nil
}

// Additional timeline handlers

func (s *MCPServer) handleListTimelines(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	timelines, err := s.timeline.ListTimelines()
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to list timelines: %v", err)), nil
	}

	if len(timelines) == 0 {
		return mcp.NewToolResultText("No timelines found.\n\nCreate one with: create_timeline"), nil
	}

	var result strings.Builder
	result.WriteString("EDITING TIMELINES\n")
	result.WriteString(strings.Repeat("=", 80))
	result.WriteString("\n\n")

	for _, tl := range timelines {
		result.WriteString(fmt.Sprintf("%s (%s)\n", tl.Name, tl.ID))
		result.WriteString(fmt.Sprintf("  Created: %s\n", tl.Created.Format("2006-01-02 15:04:05")))
		result.WriteString(fmt.Sprintf("  Modified: %s\n", tl.Modified.Format("2006-01-02 15:04:05")))
		result.WriteString(fmt.Sprintf("  Operations: %d\n", tl.OperationCount))
		result.WriteString(fmt.Sprintf("  Position: %d/%d\n", tl.CurrentIndex+1, tl.OperationCount))
		result.WriteString("\n")
	}

	return mcp.NewToolResultText(result.String()), nil
}

func (s *MCPServer) handleGetTimelineStats(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		TimelineID string `json:"timelineId"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	stats, err := s.timeline.GetStatistics(args.TimelineID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to get timeline stats: %v", err)), nil
	}

	var result strings.Builder
	result.WriteString("TIMELINE STATISTICS\n")
	result.WriteString(strings.Repeat("=", 80))
	result.WriteString("\n\n")

	result.WriteString(fmt.Sprintf("Total operations: %d\n", stats["totalOperations"]))
	result.WriteString(fmt.Sprintf("Completed: %d\n", stats["completedOperations"]))
	result.WriteString(fmt.Sprintf("Failed: %d\n\n", stats["failedOperations"]))

	totalDuration := stats["totalDuration"].(int64)
	avgDuration := stats["averageDuration"].(float64)
	result.WriteString(fmt.Sprintf("Total duration: %.2fs\n", float64(totalDuration)/1000.0))
	result.WriteString(fmt.Sprintf("Average duration: %.2fs\n\n", avgDuration/1000.0))

	result.WriteString("Operations by type:\n")
	opsByType := stats["operationsByType"].(map[string]int)
	for opType, count := range opsByType {
		result.WriteString(fmt.Sprintf("  %s: %d\n", opType, count))
	}

	return mcp.NewToolResultText(result.String()), nil
}

func (s *MCPServer) handleExportFinalVideo(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		ProjectID  string  `json:"projectId"`
		Quality    *string `json:"quality"`
		ExportPath *string `json:"exportPath"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	project, err := s.multitake.LoadProject(args.ProjectID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to load project: %v", err)), nil
	}

	// Find assembled video in output directory
	assembledPath := filepath.Join(project.Directories.Output, project.Name+"_assembled.mp4")

	// Check if assembled video exists
	if _, err := os.Stat(assembledPath); os.IsNotExist(err) {
		return mcp.NewToolResultError("Assembled video not found. Run assemble_best_takes first."), nil
	}

	// Determine export path
	var finalExportPath string
	if args.ExportPath != nil {
		finalExportPath = *args.ExportPath
	} else {
		finalExportPath = filepath.Join(project.Directories.Output, project.Name+"_final.mp4")
	}

	// Determine quality profile
	profile := "web"
	if args.Quality != nil {
		// Map quality to profile
		switch *args.Quality {
		case "high":
			profile = "youtube"
		case "low":
			profile = "twitter"
		default:
			profile = "web"
		}
	}

	// Transcode for web
	opts := video.TranscodeForWebOptions{
		Input:   assembledPath,
		Output:  finalExportPath,
		Profile: profile,
	}

	if err := s.videoOps.TranscodeForWeb(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to export video: %v", err)), nil
	}

	qualityStr := "medium"
	if args.Quality != nil {
		qualityStr = *args.Quality
	}

	result := fmt.Sprintf("Video exported successfully!\nOutput: %s\nQuality: %s\nProfile: %s",
		finalExportPath,
		qualityStr,
		profile)

	return mcp.NewToolResultText(result), nil
}

// Video vision analysis handlers

func (s *MCPServer) handleAnalyzeVideoContent(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input    string   `json:"input"`
		Interval *float64 `json:"interval"`
		Count    *int     `json:"count"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	interval := 5.0
	if args.Interval != nil {
		interval = *args.Interval
	}

	analysis, err := s.visionAnalyzer.AnalyzeVideo(context.Background(), args.Input, interval, args.Count)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to analyze video: %v", err)), nil
	}

	// Format result
	var result strings.Builder
	result.WriteString(fmt.Sprintf("VIDEO ANALYSIS: %s\n", args.Input))
	result.WriteString(strings.Repeat("=", 80))
	result.WriteString("\n\n")
	result.WriteString(fmt.Sprintf("Duration: %.2fs\n", analysis.Duration))
	result.WriteString(fmt.Sprintf("Frames analyzed: %d\n\n", len(analysis.Frames)))
	
	result.WriteString("SUMMARY:\n")
	result.WriteString(analysis.Summary)
	result.WriteString("\n\n")
	
	result.WriteString("FRAME DETAILS:\n")
	result.WriteString(strings.Repeat("-", 80))
	result.WriteString("\n\n")
	
	for _, frame := range analysis.Frames {
		result.WriteString(fmt.Sprintf("Frame %d [%.2fs]:\n", frame.FrameNumber, frame.Timestamp))
		result.WriteString(fmt.Sprintf("%s\n\n", frame.Description))
	}

	return mcp.NewToolResultText(result.String()), nil
}

func (s *MCPServer) handleCompareVideoFrames(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input      string  `json:"input"`
		Timestamp1 float64 `json:"timestamp1"`
		Timestamp2 float64 `json:"timestamp2"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	comparison, err := s.visionAnalyzer.CompareFrames(context.Background(), args.Input, args.Timestamp1, args.Timestamp2)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to compare frames: %v", err)), nil
	}

	result := fmt.Sprintf("FRAME COMPARISON\n%s\n\nComparing frames at %.2fs and %.2fs:\n\n%s",
		strings.Repeat("=", 80),
		args.Timestamp1,
		args.Timestamp2,
		comparison)

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleDescribeScene(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input     string  `json:"input"`
		Timestamp float64 `json:"timestamp"`
		Prompt    *string `json:"prompt"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	// Extract frame at timestamp using FFmpeg directly
	tempFrame := filepath.Join(os.TempDir(), "scene-frame.jpg")
	ffmpegArgs := []string{
		"-ss", fmt.Sprintf("%.3f", args.Timestamp),
		"-i", args.Input,
		"-frames:v", "1",
		"-q:v", "2",
		"-y",
		tempFrame,
	}
	if err := s.ffmpeg.Execute(context.Background(), ffmpegArgs...); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to extract frame: %v", err)), nil
	}
	defer os.Remove(tempFrame)

	prompt := ""
	if args.Prompt != nil {
		prompt = *args.Prompt
	}

	description, err := s.visionAnalyzer.AnalyzeFrame(context.Background(), tempFrame, prompt)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to analyze scene: %v", err)), nil
	}

	result := fmt.Sprintf("SCENE DESCRIPTION [%.2fs]\n%s\n\n%s",
		args.Timestamp,
		strings.Repeat("=", 80),
		description)

	return mcp.NewToolResultText(result), nil
}

func (s *MCPServer) handleFindObjectsInVideo(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input    string   `json:"input"`
		Query    string   `json:"query"`
		Interval *float64 `json:"interval"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	interval := 5.0
	if args.Interval != nil {
		interval = *args.Interval
	}

	searchResult, err := s.visionAnalyzer.SearchVisualContent(context.Background(), args.Input, args.Query, interval)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to search video: %v", err)), nil
	}

	var result strings.Builder
	result.WriteString(fmt.Sprintf("OBJECT SEARCH: \"%s\"\n", args.Query))
	result.WriteString(strings.Repeat("=", 80))
	result.WriteString("\n\n")

	if !searchResult.Found {
		result.WriteString("No matches found.")
	} else {
		result.WriteString(fmt.Sprintf("Found %d match(es):\n\n", len(searchResult.Matches)))
		for i, match := range searchResult.Matches {
			result.WriteString(fmt.Sprintf("%d. [%.2fs] Confidence: %.0f%%\n", 
				i+1, match.Timestamp, match.Confidence*100))
			result.WriteString(fmt.Sprintf("   %s\n\n", match.Description))
		}
	}

	return mcp.NewToolResultText(result.String()), nil
}

func (s *MCPServer) handleSearchVisualContent(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input    string   `json:"input"`
		Query    string   `json:"query"`
		Interval *float64 `json:"interval"`
	}
	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	interval := 5.0
	if args.Interval != nil {
		interval = *args.Interval
	}

	searchResult, err := s.visionAnalyzer.SearchVisualContent(context.Background(), args.Input, args.Query, interval)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to search content: %v", err)), nil
	}

	var result strings.Builder
	result.WriteString(fmt.Sprintf("VISUAL CONTENT SEARCH: \"%s\"\n", args.Query))
	result.WriteString(strings.Repeat("=", 80))
	result.WriteString("\n\n")

	if !searchResult.Found {
		result.WriteString("No matching content found in video.")
	} else {
		result.WriteString(fmt.Sprintf("Found matching content in %d frame(s):\n\n", len(searchResult.Matches)))
		for _, match := range searchResult.Matches {
			result.WriteString(fmt.Sprintf("• %.2fs (confidence: %.0f%%): %s\n",
				match.Timestamp, match.Confidence*100, match.Description))
		}
	}

	return mcp.NewToolResultText(result.String()), nil
}

// Diagram generation handlers

func (s *MCPServer) handleGenerateTimeline(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Title       string `json:"title"`
		Events      []struct {
			Label       string `json:"label"`
			Date        string `json:"date"`
			Description string `json:"description,omitempty"`
		} `json:"events"`
		Output      string `json:"output"`
		Orientation string `json:"orientation,omitempty"`
		Width       int    `json:"width,omitempty"`
		Height      int    `json:"height,omitempty"`
	}

	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	// Convert events to timeline format
	events := make([]diagrams.TimelineEvent, len(args.Events))
	for i, e := range args.Events {
		events[i] = diagrams.TimelineEvent{
			Label:       e.Label,
			Date:        e.Date,
			Description: e.Description,
		}
	}

	options := diagrams.TimelineOptions{
		Title:       args.Title,
		Events:      events,
		Orientation: args.Orientation,
		Width:       args.Width,
		Height:      args.Height,
		Style:       diagrams.DefaultStyle(),
	}

	if err := s.diagramGen.GenerateTimeline(context.Background(), options, args.Output); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to generate timeline: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Timeline diagram generated successfully: %s\n\nContains %d events in %s orientation.",
		args.Output, len(events), options.Orientation)), nil
}

func (s *MCPServer) handleGenerateFlowchart(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Title  string `json:"title"`
		Nodes  []struct {
			ID          string   `json:"id"`
			Label       string   `json:"label"`
			Type        string   `json:"type"`
			Connections []string `json:"connections,omitempty"`
		} `json:"nodes"`
		Output string `json:"output"`
		Width  int    `json:"width,omitempty"`
		Height int    `json:"height,omitempty"`
	}

	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	// Convert nodes to flowchart format
	nodes := make([]diagrams.FlowchartNode, len(args.Nodes))
	for i, n := range args.Nodes {
		connections := n.Connections
		if connections == nil {
			connections = []string{}
		}
		nodes[i] = diagrams.FlowchartNode{
			ID:          n.ID,
			Label:       n.Label,
			Type:        n.Type,
			Connections: connections,
		}
	}

	options := diagrams.FlowchartOptions{
		Title:  args.Title,
		Nodes:  nodes,
		Width:  args.Width,
		Height: args.Height,
		Style:  diagrams.DefaultStyle(),
	}

	if err := s.diagramGen.GenerateFlowchart(context.Background(), options, args.Output); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to generate flowchart: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Flowchart diagram generated successfully: %s\n\nContains %d nodes.",
		args.Output, len(nodes))), nil
}

func (s *MCPServer) handleGenerateOrgChart(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Title  string          `json:"title"`
		Root   json.RawMessage `json:"root"`
		Output string          `json:"output"`
		Width  int             `json:"width,omitempty"`
		Height int             `json:"height,omitempty"`
	}

	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	// Parse the root node (recursive structure)
	var root diagrams.OrgChartNode
	if err := json.Unmarshal(args.Root, &root); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid root node structure: %v", err)), nil
	}

	options := diagrams.OrgChartOptions{
		Title:  args.Title,
		Root:   root,
		Width:  args.Width,
		Height: args.Height,
		Style:  diagrams.DefaultStyle(),
	}

	if err := s.diagramGen.GenerateOrgChart(context.Background(), options, args.Output); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to generate org chart: %v", err)), nil
	}

	// Count total nodes recursively
	nodeCount := countOrgNodes(root)

	return mcp.NewToolResultText(fmt.Sprintf("Organization chart diagram generated successfully: %s\n\nContains %d nodes.",
		args.Output, nodeCount)), nil
}

// Helper to count org chart nodes recursively
func countOrgNodes(node diagrams.OrgChartNode) int {
	count := 1
	for _, child := range node.Children {
		count += countOrgNodes(child)
	}
	return count
}

func (s *MCPServer) handleGenerateMindMap(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Title  string          `json:"title"`
		Root   json.RawMessage `json:"root"`
		Output string          `json:"output"`
		Width  int             `json:"width,omitempty"`
		Height int             `json:"height,omitempty"`
	}

	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	// Parse the root node (recursive structure)
	var root diagrams.MindMapNode
	if err := json.Unmarshal(args.Root, &root); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid root node structure: %v", err)), nil
	}

	options := diagrams.MindMapOptions{
		Title:  args.Title,
		Root:   root,
		Width:  args.Width,
		Height: args.Height,
		Style:  diagrams.DefaultStyle(),
	}

	if err := s.diagramGen.GenerateMindMap(context.Background(), options, args.Output); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to generate mind map: %v", err)), nil
	}

	// Count total nodes recursively
	nodeCount := countMindMapNodes(root)

	return mcp.NewToolResultText(fmt.Sprintf("Mind map diagram generated successfully: %s\n\nContains %d nodes with radial layout.",
		args.Output, nodeCount)), nil
}

// Helper to count mind map nodes recursively
func countMindMapNodes(node diagrams.MindMapNode) int {
	count := 1
	for _, child := range node.Children {
		count += countMindMapNodes(child)
	}
	return count
}

// Additional tool handlers

func (s *MCPServer) handleCreateSideBySide(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input1 string `json:"input1"`
		Input2 string `json:"input2"`
		Output string `json:"output"`
	}

	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	// Use FFmpeg directly to create side-by-side video
	ffmpegArgs := []string{
		"-i", args.Input1,
		"-i", args.Input2,
		"-filter_complex", "[0:v][1:v]hstack=inputs=2[v]",
		"-map", "[v]",
		"-c:v", "libx264",
		"-preset", "medium",
		"-crf", "23",
		"-y",
		args.Output,
	}

	if err := s.ffmpeg.Execute(context.Background(), ffmpegArgs...); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to create side-by-side: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully created side-by-side video: %s", args.Output)), nil
}

func (s *MCPServer) handleCreateVideoFromImages(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		ImagePattern string `json:"imagePattern"`
		Output       string `json:"output"`
		FPS          *int   `json:"fps"`
	}

	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	fps := 30
	if args.FPS != nil {
		fps = *args.FPS
	}

	// Use FFmpeg directly to create video from images
	ffmpegArgs := []string{
		"-framerate", fmt.Sprintf("%d", fps),
		"-pattern_type", "glob",
		"-i", args.ImagePattern,
		"-c:v", "libx264",
		"-preset", "medium",
		"-crf", "23",
		"-pix_fmt", "yuv420p",
		"-y",
		args.Output,
	}

	if err := s.ffmpeg.Execute(context.Background(), ffmpegArgs...); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to create video from images: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully created video from images: %s (FPS: %d)", args.Output, fps)), nil
}

func (s *MCPServer) handleGetAudioStats(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	var args struct {
		Input string `json:"input"`
	}

	if err := unmarshalArgs(arguments, &args); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Invalid arguments: %v", err)), nil
	}

	// Get video info which includes audio information
	info, err := s.videoOps.GetVideoInfo(context.Background(), args.Input)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to get audio stats: %v", err)), nil
	}

	var result strings.Builder
	result.WriteString(fmt.Sprintf("AUDIO STATISTICS: %s\n", args.Input))
	result.WriteString(strings.Repeat("=", 80))
	result.WriteString("\n\n")

	result.WriteString(fmt.Sprintf("Duration: %.2f seconds\n", info.Duration))
	result.WriteString(fmt.Sprintf("Has Audio: %t\n", info.HasAudio))

	if info.HasAudio {
		result.WriteString(fmt.Sprintf("Audio Codec: %s\n", info.AudioCodec))
		if info.Bitrate > 0 {
			result.WriteString(fmt.Sprintf("Bitrate: %d kbps\n", info.Bitrate/1000))
		}
	} else {
		result.WriteString("\nNo audio found in file.")
	}

	return mcp.NewToolResultText(result.String()), nil
}
