package server

import (
	"context"
	"fmt"

	"github.com/chandler-mayo/mcp-video-editor/pkg/audio"
	"github.com/mark3labs/mcp-go/mcp"
)

// registerTrimAudio registers the trim_audio MCP tool
func (s *MCPServer) registerTrimAudio() {
	s.server.AddTool(mcp.Tool{
		Name:        "trim_audio",
		Description: "Trim audio file to specified time range. Cut out a segment from start to end time.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input audio file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
				"start": map[string]interface{}{
					"type":        "number",
					"description": "Start time in seconds",
				},
				"end": map[string]interface{}{
					"type":        "number",
					"description": "End time in seconds (optional, trim to end if not specified)",
				},
			},
			Required: []string{"input", "output", "start"},
		},
	}, s.handleTrimAudio)
}

func (s *MCPServer) handleTrimAudio(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	input, _ := arguments["input"].(string)
	output, _ := arguments["output"].(string)
	start, _ := arguments["start"].(float64)

	opts := audio.TrimOptions{
		Input:     input,
		Output:    output,
		StartTime: start,
	}

	if end, ok := arguments["end"].(float64); ok {
		opts.EndTime = &end
	}

	if err := s.audioOps.TrimAudio(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to trim audio: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Audio trimmed successfully. Output: %s", output)), nil
}

// registerConcatenateAudio registers the concatenate_audio MCP tool
func (s *MCPServer) registerConcatenateAudio() {
	s.server.AddTool(mcp.Tool{
		Name:        "concatenate_audio",
		Description: "Join multiple audio files together into one continuous audio file. Files will be joined in the order provided.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"inputs": map[string]interface{}{
					"type":        "array",
					"description": "Array of input audio file paths to concatenate",
					"items": map[string]interface{}{
						"type": "string",
					},
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
			},
			Required: []string{"inputs", "output"},
		},
	}, s.handleConcatenateAudio)
}

func (s *MCPServer) handleConcatenateAudio(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	inputsRaw, _ := arguments["inputs"].([]interface{})
	output, _ := arguments["output"].(string)

	var inputs []string
	for _, v := range inputsRaw {
		if str, ok := v.(string); ok {
			inputs = append(inputs, str)
		}
	}

	if err := s.audioOps.ConcatenateAudio(context.Background(), audio.ConcatenateOptions{
		Inputs: inputs,
		Output: output,
	}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to concatenate audio: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully concatenated %d audio files. Output: %s", len(inputs), output)), nil
}

// registerAdjustAudioVolume registers the adjust_audio_volume MCP tool
func (s *MCPServer) registerAdjustAudioVolume() {
	s.server.AddTool(mcp.Tool{
		Name:        "adjust_audio_volume",
		Description: "Adjust the volume of an audio file. Use multiplier: 0.5 for 50%, 1.0 for 100%, 2.0 for 200%.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input audio file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
				"volume": map[string]interface{}{
					"type":        "number",
					"description": "Volume multiplier (0.5 = 50%, 1.0 = 100%, 2.0 = 200%)",
				},
			},
			Required: []string{"input", "output", "volume"},
		},
	}, s.handleAdjustAudioVolume)
}

func (s *MCPServer) handleAdjustAudioVolume(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	input, _ := arguments["input"].(string)
	output, _ := arguments["output"].(string)
	volume, _ := arguments["volume"].(float64)

	if err := s.audioOps.AdjustVolume(context.Background(), audio.VolumeOptions{
		Input:  input,
		Output: output,
		Volume: volume,
	}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to adjust volume: %v", err)), nil
	}

	percentage := volume * 100
	return mcp.NewToolResultText(fmt.Sprintf("Volume adjusted to %.0f%%. Output: %s", percentage, output)), nil
}

// registerNormalizeAudio registers the normalize_audio MCP tool
func (s *MCPServer) registerNormalizeAudio() {
	s.server.AddTool(mcp.Tool{
		Name:        "normalize_audio",
		Description: "Normalize audio levels to a consistent volume. Useful for evening out quiet and loud sections.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input audio file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleNormalizeAudio)
}

func (s *MCPServer) handleNormalizeAudio(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	input, _ := arguments["input"].(string)
	output, _ := arguments["output"].(string)

	if err := s.audioOps.NormalizeAudio(context.Background(), input, output); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to normalize audio: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Audio normalized successfully. Output: %s", output)), nil
}

// registerFadeAudio registers the fade_audio MCP tool
func (s *MCPServer) registerFadeAudio() {
	s.server.AddTool(mcp.Tool{
		Name:        "fade_audio",
		Description: "Apply fade in and/or fade out effects to audio. Smoothly increase volume at start and/or decrease at end.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input audio file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
				"fadeIn": map[string]interface{}{
					"type":        "number",
					"description": "Fade in duration in seconds (0 for no fade in)",
				},
				"fadeOut": map[string]interface{}{
					"type":        "number",
					"description": "Fade out duration in seconds (0 for no fade out)",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleFadeAudio)
}

func (s *MCPServer) handleFadeAudio(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	input, _ := arguments["input"].(string)
	output, _ := arguments["output"].(string)
	fadeIn, _ := arguments["fadeIn"].(float64)
	fadeOut, _ := arguments["fadeOut"].(float64)

	if err := s.audioOps.FadeAudio(context.Background(), audio.FadeOptions{
		Input:   input,
		Output:  output,
		FadeIn:  fadeIn,
		FadeOut: fadeOut,
	}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to apply fade: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Fade applied (in: %.1fs, out: %.1fs). Output: %s", fadeIn, fadeOut, output)), nil
}

// registerMixAudio registers the mix_audio MCP tool
func (s *MCPServer) registerMixAudio() {
	s.server.AddTool(mcp.Tool{
		Name:        "mix_audio",
		Description: "Mix multiple audio tracks together into one. Combines all inputs into a single audio file. Optionally adjust volume for each track.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"inputs": map[string]interface{}{
					"type":        "array",
					"description": "Array of input audio file paths to mix",
					"items": map[string]interface{}{
						"type": "string",
					},
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
				"volumes": map[string]interface{}{
					"type":        "array",
					"description": "Optional: Volume multiplier for each input (default 1.0 for all)",
					"items": map[string]interface{}{
						"type": "number",
					},
				},
			},
			Required: []string{"inputs", "output"},
		},
	}, s.handleMixAudio)
}

func (s *MCPServer) handleMixAudio(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	inputsRaw, _ := arguments["inputs"].([]interface{})
	output, _ := arguments["output"].(string)

	var inputs []string
	for _, v := range inputsRaw {
		if str, ok := v.(string); ok {
			inputs = append(inputs, str)
		}
	}

	var volumes []float64
	if volumesRaw, ok := arguments["volumes"].([]interface{}); ok {
		for _, v := range volumesRaw {
			if vol, ok := v.(float64); ok {
				volumes = append(volumes, vol)
			}
		}
	}

	if err := s.audioOps.MixAudio(context.Background(), audio.MixOptions{
		Inputs:  inputs,
		Output:  output,
		Volumes: volumes,
	}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to mix audio: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully mixed %d audio tracks. Output: %s", len(inputs), output)), nil
}

// registerConvertAudio registers the convert_audio MCP tool
func (s *MCPServer) registerConvertAudio() {
	s.server.AddTool(mcp.Tool{
		Name:        "convert_audio",
		Description: "Convert audio to different format, bitrate, sample rate, or channel configuration. Supports mp3, aac, wav, flac, opus, ogg.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input audio file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
				"format": map[string]interface{}{
					"type":        "string",
					"description": "Output format: mp3, aac, wav, flac, opus, ogg, m4a",
				},
				"bitrate": map[string]interface{}{
					"type":        "string",
					"description": "Bitrate (e.g., '128k', '192k', '320k')",
				},
				"sampleRate": map[string]interface{}{
					"type":        "number",
					"description": "Sample rate in Hz (e.g., 44100, 48000)",
				},
				"channels": map[string]interface{}{
					"type":        "number",
					"description": "Number of channels (1 = mono, 2 = stereo)",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleConvertAudio)
}

func (s *MCPServer) handleConvertAudio(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	input, _ := arguments["input"].(string)
	output, _ := arguments["output"].(string)
	format, _ := arguments["format"].(string)
	bitrate, _ := arguments["bitrate"].(string)
	sampleRate := 0
	if sr, ok := arguments["sampleRate"].(float64); ok {
		sampleRate = int(sr)
	}
	channels := 0
	if ch, ok := arguments["channels"].(float64); ok {
		channels = int(ch)
	}

	if err := s.audioOps.ConvertAudio(context.Background(), audio.ConvertOptions{
		Input:      input,
		Output:     output,
		Format:     format,
		Bitrate:    bitrate,
		SampleRate: sampleRate,
		Channels:   channels,
	}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to convert audio: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Audio converted successfully. Output: %s", output)), nil
}

// registerAdjustAudioSpeed registers the adjust_audio_speed MCP tool
func (s *MCPServer) registerAdjustAudioSpeed() {
	s.server.AddTool(mcp.Tool{
		Name:        "adjust_audio_speed",
		Description: "Change audio playback speed without changing pitch. 0.5 = half speed, 1.0 = normal, 2.0 = double speed.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input audio file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
				"speed": map[string]interface{}{
					"type":        "number",
					"description": "Speed multiplier (0.5 = half speed, 2.0 = double speed)",
				},
			},
			Required: []string{"input", "output", "speed"},
		},
	}, s.handleAdjustAudioSpeed)
}

func (s *MCPServer) handleAdjustAudioSpeed(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	input, _ := arguments["input"].(string)
	output, _ := arguments["output"].(string)
	speed, _ := arguments["speed"].(float64)

	if err := s.audioOps.AdjustSpeed(context.Background(), audio.SpeedOptions{
		Input:  input,
		Output: output,
		Speed:  speed,
	}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to adjust audio speed: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Audio speed adjusted to %.1fx. Output: %s", speed, output)), nil
}

// registerRemoveAudioSection registers the remove_audio_section MCP tool
func (s *MCPServer) registerRemoveAudioSection() {
	s.server.AddTool(mcp.Tool{
		Name:        "remove_audio_section",
		Description: "Remove a section of audio between start and end times. Keeps everything before and after the specified range.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input audio file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
				"start": map[string]interface{}{
					"type":        "number",
					"description": "Start time of section to remove (seconds)",
				},
				"end": map[string]interface{}{
					"type":        "number",
					"description": "End time of section to remove (seconds)",
				},
			},
			Required: []string{"input", "output", "start", "end"},
		},
	}, s.handleRemoveAudioSection)
}

func (s *MCPServer) handleRemoveAudioSection(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	input, _ := arguments["input"].(string)
	output, _ := arguments["output"].(string)
	start, _ := arguments["start"].(float64)
	end, _ := arguments["end"].(float64)

	if err := s.audioOps.RemoveAudioSection(context.Background(), input, output, start, end); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to remove audio section: %v", err)), nil
	}

	duration := end - start
	return mcp.NewToolResultText(fmt.Sprintf("Removed %.2fs of audio (from %.2fs to %.2fs). Output: %s", duration, start, end, output)), nil
}

// registerSplitAudio registers the split_audio MCP tool
func (s *MCPServer) registerSplitAudio() {
	s.server.AddTool(mcp.Tool{
		Name:        "split_audio",
		Description: "Split audio file into multiple segments of specified duration. Useful for breaking long audio into chapters.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input audio file path",
				},
				"segmentDuration": map[string]interface{}{
					"type":        "number",
					"description": "Duration of each segment in seconds",
				},
				"outputPattern": map[string]interface{}{
					"type":        "string",
					"description": "Output filename pattern (e.g., 'segment_%03d.mp3')",
				},
			},
			Required: []string{"input", "segmentDuration", "outputPattern"},
		},
	}, s.handleSplitAudio)
}

func (s *MCPServer) handleSplitAudio(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	input, _ := arguments["input"].(string)
	segmentDuration, _ := arguments["segmentDuration"].(float64)
	outputPattern, _ := arguments["outputPattern"].(string)

	if err := s.audioOps.SplitAudio(context.Background(), input, segmentDuration, outputPattern); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to split audio: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Audio split into %.0fs segments. Pattern: %s", segmentDuration, outputPattern)), nil
}

// registerReverseAudio registers the reverse_audio MCP tool
func (s *MCPServer) registerReverseAudio() {
	s.server.AddTool(mcp.Tool{
		Name:        "reverse_audio",
		Description: "Reverse audio playback (play backwards). Creates interesting effects or reverses accidentally reversed audio.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input audio file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleReverseAudio)
}

func (s *MCPServer) handleReverseAudio(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	input, _ := arguments["input"].(string)
	output, _ := arguments["output"].(string)

	if err := s.audioOps.ReverseAudio(context.Background(), input, output); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to reverse audio: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Audio reversed successfully. Output: %s", output)), nil
}

// registerExtractAudioChannel registers the extract_audio_channel MCP tool
func (s *MCPServer) registerExtractAudioChannel() {
	s.server.AddTool(mcp.Tool{
		Name:        "extract_audio_channel",
		Description: "Extract a specific channel from stereo audio (left or right). Converts stereo to mono by selecting one channel.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input audio file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
				"channel": map[string]interface{}{
					"type":        "string",
					"description": "Channel to extract: 'left' or 'right'",
					"enum":        []string{"left", "right"},
				},
			},
			Required: []string{"input", "output", "channel"},
		},
	}, s.handleExtractAudioChannel)
}

func (s *MCPServer) handleExtractAudioChannel(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	input, _ := arguments["input"].(string)
	output, _ := arguments["output"].(string)
	channel, _ := arguments["channel"].(string)

	if err := s.audioOps.ExtractAudioChannel(context.Background(), input, output, channel); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to extract channel: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Extracted %s channel successfully. Output: %s", channel, output)), nil
}
