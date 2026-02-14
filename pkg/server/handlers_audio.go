package server

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/chandler-mayo/mcp-video-editor/pkg/audio"
	"github.com/mark3labs/mcp-go/mcp"
)

// registerReplaceSpokenWord registers the replace_spoken_word MCP tool
func (s *MCPServer) registerReplaceSpokenWord() {
	s.server.AddTool(mcp.Tool{
		Name:        "replace_spoken_word",
		Description: "Replace a spoken word or phrase in audio/video with voice-matched TTS audio. Uses ElevenLabs for voice cloning and seamless audio splicing.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video or audio file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video or audio file path",
				},
				"searchText": map[string]interface{}{
					"type":        "string",
					"description": "Word or phrase to find and replace in the spoken audio",
				},
				"replacementText": map[string]interface{}{
					"type":        "string",
					"description": "Replacement word or phrase (will be spoken in matching voice)",
				},
				"transcriptPath": map[string]interface{}{
					"type":        "string",
					"description": "Optional: Path to existing transcript JSON (will auto-generate if not provided)",
				},
				"voiceSamplePath": map[string]interface{}{
					"type":        "string",
					"description": "Optional: Path to audio sample for voice cloning (will extract from video if not provided)",
				},
				"voiceID": map[string]interface{}{
					"type":        "string",
					"description": "Optional: Existing ElevenLabs voice ID to reuse",
				},
				"matchIndex": map[string]interface{}{
					"type":        "number",
					"description": "Which occurrence to replace: 0-based index, or -1 for all occurrences (default: 0)",
				},
			},
			Required: []string{"input", "output", "searchText", "replacementText"},
		},
	}, s.handleReplaceSpokenWord)
}

// handleReplaceSpokenWord handles the replace_spoken_word tool
func (s *MCPServer) handleReplaceSpokenWord(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	// Parse arguments
	input, _ := arguments["input"].(string)
	output, _ := arguments["output"].(string)
	searchText, _ := arguments["searchText"].(string)
	replacementText, _ := arguments["replacementText"].(string)
	transcriptPath, _ := arguments["transcriptPath"].(string)
	voiceSamplePath, _ := arguments["voiceSamplePath"].(string)
	voiceID, _ := arguments["voiceID"].(string)
	matchIndex := 0 // default to first match
	if idx, ok := arguments["matchIndex"].(float64); ok {
		matchIndex = int(idx)
	}

	// Build options
	opts := audio.ReplaceOptions{
		VideoPath:       input,
		OutputPath:      output,
		SearchText:      searchText,
		ReplacementText: replacementText,
		TranscriptPath:  transcriptPath,
		VoiceSamplePath: voiceSamplePath,
		VoiceID:         voiceID,
		MatchIndex:      matchIndex,
	}

	// Execute replacement
	if err := s.audioReplacement.ReplaceWord(context.Background(), opts); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to replace word: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully replaced '%s' with '%s' in %s. Output saved to: %s",
		searchText, replacementText, input, output)), nil
}

// registerCloneVoiceFromAudio registers the clone_voice_from_audio MCP tool
func (s *MCPServer) registerCloneVoiceFromAudio() {
	s.server.AddTool(mcp.Tool{
		Name:        "clone_voice_from_audio",
		Description: "Clone a voice from an audio sample using ElevenLabs and save the voice ID for reuse. Requires 30-60 seconds of clear speech.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"audioPath": map[string]interface{}{
					"type":        "string",
					"description": "Path to audio sample file (30-60 seconds recommended, clean speech)",
				},
				"voiceName": map[string]interface{}{
					"type":        "string",
					"description": "Name for the cloned voice",
				},
				"description": map[string]interface{}{
					"type":        "string",
					"description": "Optional description of the voice",
				},
			},
			Required: []string{"audioPath", "voiceName"},
		},
	}, s.handleCloneVoiceFromAudio)
}

// handleCloneVoiceFromAudio handles the clone_voice_from_audio tool
func (s *MCPServer) handleCloneVoiceFromAudio(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	// Parse arguments
	audioPath, _ := arguments["audioPath"].(string)
	voiceName, _ := arguments["voiceName"].(string)
	description, _ := arguments["description"].(string)

	// Clone voice
	voiceID, err := s.ttsOps.CloneVoice(context.Background(), audio.VoiceCloneOptions{
		Name:        voiceName,
		AudioPath:   audioPath,
		Description: description,
	})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to clone voice: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Voice '%s' cloned successfully. Voice ID: %s\n\nThis voice ID has been cached and can be reused for future TTS operations.", voiceName, voiceID)), nil
}

// registerGenerateSpeech registers the generate_speech MCP tool
func (s *MCPServer) registerGenerateSpeech() {
	s.server.AddTool(mcp.Tool{
		Name:        "generate_speech",
		Description: "Generate text-to-speech audio using ElevenLabs with a specified voice ID. Creates natural-sounding speech from text.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"text": map[string]interface{}{
					"type":        "string",
					"description": "Text to convert to speech",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
				"voiceID": map[string]interface{}{
					"type":        "string",
					"description": "ElevenLabs voice ID (from clone_voice_from_audio or ElevenLabs dashboard)",
				},
				"stability": map[string]interface{}{
					"type":        "number",
					"description": "Voice stability 0.0-1.0 (default: 0.5, higher = more stable/monotone)",
				},
				"similarity": map[string]interface{}{
					"type":        "number",
					"description": "Voice similarity boost 0.0-1.0 (default: 0.75, higher = closer to original)",
				},
			},
			Required: []string{"text", "output", "voiceID"},
		},
	}, s.handleGenerateSpeech)
}

// handleGenerateSpeech handles the generate_speech tool
func (s *MCPServer) handleGenerateSpeech(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	// Parse arguments
	text, _ := arguments["text"].(string)
	output, _ := arguments["output"].(string)
	voiceID, _ := arguments["voiceID"].(string)
	stability := 0.5
	if s, ok := arguments["stability"].(float64); ok {
		stability = s
	}
	similarity := 0.75
	if s, ok := arguments["similarity"].(float64); ok {
		similarity = s
	}

	// Generate speech
	err := s.ttsOps.GenerateSpeech(context.Background(), audio.SpeechOptions{
		Text:       text,
		VoiceID:    voiceID,
		Stability:  stability,
		Similarity: similarity,
	}, output)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to generate speech: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Speech generated successfully. Audio saved to: %s", output)), nil
}

// registerGetWordTimestamps registers the get_word_timestamps MCP tool
func (s *MCPServer) registerGetWordTimestamps() {
	s.server.AddTool(mcp.Tool{
		Name:        "get_word_timestamps",
		Description: "Extract transcript with word-level timestamps from video/audio using Whisper. Shows precise timing for each spoken word.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"videoPath": map[string]interface{}{
					"type":        "string",
					"description": "Path to video or audio file",
				},
				"outputFormat": map[string]interface{}{
					"type":        "string",
					"description": "Output format: 'json' (default), 'text', or 'detailed'",
					"enum":        []string{"json", "text", "detailed"},
				},
			},
			Required: []string{"videoPath"},
		},
	}, s.handleGetWordTimestamps)
}

// handleGetWordTimestamps handles the get_word_timestamps tool
func (s *MCPServer) handleGetWordTimestamps(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	// Parse arguments
	videoPath, _ := arguments["videoPath"].(string)
	outputFormat := "json"
	if format, ok := arguments["outputFormat"].(string); ok {
		outputFormat = format
	}

	// Extract transcript
	trans, err := s.transcriptOps.ExtractTranscript(context.Background(), videoPath, "")
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to extract transcript: %v", err)), nil
	}

	// Format output based on requested format
	switch outputFormat {
	case "json":
		jsonData, err := json.MarshalIndent(trans, "", "  ")
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("Failed to format JSON: %v", err)), nil
		}
		return mcp.NewToolResultText(string(jsonData)), nil

	case "detailed":
		var result string
		result += fmt.Sprintf("Transcript (Duration: %.2fs, Language: %s)\n\n", trans.Duration, trans.Language)
		for i, seg := range trans.Segments {
			result += fmt.Sprintf("Segment %d [%.2f - %.2f]: %s\n", i+1, seg.Start, seg.End, seg.Text)
			if len(seg.Words) > 0 {
				result += "  Words:\n"
				for _, word := range seg.Words {
					result += fmt.Sprintf("    [%.2f - %.2f] %s\n", word.Start, word.End, word.Word)
				}
			}
			result += "\n"
		}
		return mcp.NewToolResultText(result), nil

	default: // "text"
		var result string
		for _, seg := range trans.Segments {
			if len(seg.Words) > 0 {
				for _, word := range seg.Words {
					result += fmt.Sprintf("[%.2fs] %s ", word.Start, word.Word)
				}
			} else {
				result += fmt.Sprintf("[%.2fs] %s\n", seg.Start, seg.Text)
			}
		}
		return mcp.NewToolResultText(result), nil
	}
}

// registerListCachedVoices registers the list_cached_voices MCP tool
func (s *MCPServer) registerListCachedVoices() {
	s.server.AddTool(mcp.Tool{
		Name:        "list_cached_voices",
		Description: "List all cached voice clones. Shows voice IDs, names, and validation status. Cached voices can be reused across projects without re-cloning.",
		InputSchema: mcp.ToolInputSchema{
			Type:       "object",
			Properties: map[string]interface{}{},
		},
	}, s.handleListCachedVoices)
}

// registerClearCachedVoice registers the clear_cached_voice MCP tool
func (s *MCPServer) registerClearCachedVoice() {
	s.server.AddTool(mcp.Tool{
		Name:        "clear_cached_voice",
		Description: "Remove a specific voice from the cache by its audio hash. Use list_cached_voices to see available hashes.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"audioHash": map[string]interface{}{
					"type":        "string",
					"description": "The audio hash of the voice to remove (from list_cached_voices)",
				},
			},
			Required: []string{"audioHash"},
		},
	}, s.handleClearCachedVoice)
}

// registerClearAllCachedVoices registers the clear_all_cached_voices MCP tool
func (s *MCPServer) registerClearAllCachedVoices() {
	s.server.AddTool(mcp.Tool{
		Name:        "clear_all_cached_voices",
		Description: "Clear all cached voice clones. This will require re-cloning voices if needed again.",
		InputSchema: mcp.ToolInputSchema{
			Type:       "object",
			Properties: map[string]interface{}{},
		},
	}, s.handleClearAllCachedVoices)
}

// handleListCachedVoices lists all cached voice clones
func (s *MCPServer) handleListCachedVoices(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	ctx := context.Background()
	voices, err := s.ttsOps.ListCachedVoices(ctx)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to list cached voices: %v", err)), nil
	}

	if len(voices) == 0 {
		return mcp.NewToolResultText("No cached voices found."), nil
	}

	// Format output
	result := fmt.Sprintf("Cached Voices (%d total):\n\n", len(voices))
	for i, voice := range voices {
		result += fmt.Sprintf("%d. Voice ID: %s\n", i+1, voice.VoiceID)
		result += fmt.Sprintf("   Audio Hash: %s\n", voice.AudioHash)
		if voice.Name != "" {
			result += fmt.Sprintf("   Name: %s\n", voice.Name)
		}
		if voice.Description != "" {
			result += fmt.Sprintf("   Description: %s\n", voice.Description)
		}
		result += fmt.Sprintf("   Status: %s\n", map[bool]string{true: "✓ Valid", false: "✗ Invalid/Deleted"}[voice.IsValid])
		result += "\n"
	}

	return mcp.NewToolResultText(result), nil
}

// handleClearCachedVoice removes a specific voice from cache
func (s *MCPServer) handleClearCachedVoice(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	audioHash, ok := arguments["audioHash"].(string)
	if !ok || audioHash == "" {
		return mcp.NewToolResultError("audioHash parameter is required"), nil
	}

	if err := s.ttsOps.ClearCachedVoice(audioHash); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to clear cached voice: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully removed voice with hash %s from cache", audioHash)), nil
}

// handleClearAllCachedVoices removes all cached voices
func (s *MCPServer) handleClearAllCachedVoices(arguments map[string]interface{}) (*mcp.CallToolResult, error) {
	count := s.ttsOps.GetCachedVoiceCount()

	if count == 0 {
		return mcp.NewToolResultText("No cached voices to clear."), nil
	}

	if err := s.ttsOps.ClearAllCachedVoices(); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to clear cached voices: %v", err)), nil
	}

	return mcp.NewToolResultText(fmt.Sprintf("Successfully cleared %d cached voice(s)", count)), nil
}
