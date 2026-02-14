package wails

import (
	"context"
	"fmt"

	"github.com/chandler-mayo/mcp-video-editor/internal/services"
	"github.com/chandler-mayo/mcp-video-editor/internal/services/agent"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// Bridge is the Wails-specific transport layer
// It exposes the service layer to the React frontend via Wails bindings
type Bridge struct {
	ctx      context.Context
	app      *application.App
	services *services.Services
}

// NewBridge creates a new Wails bridge
func NewBridge(app *application.App, services *services.Services) *Bridge {
	return &Bridge{
		app:      app,
		services: services,
	}
}

// Startup is called when the app starts (Wails lifecycle)
func (b *Bridge) Startup(ctx context.Context) {
	b.ctx = ctx
}

// Shutdown is called when the app terminates (Wails lifecycle)
func (b *Bridge) Shutdown(ctx context.Context) {
	// Cleanup if needed
}

// SendMessage sends a message to the agent and collects all responses
// NOTE: Streaming via channels doesn't work over Wails bridge
// So we collect all responses and return them as a slice
func (b *Bridge) SendMessage(message string) ([]agent.SendMessageResponse, error) {
	responseChan, err := b.services.SendMessage(b.ctx, message)
	if err != nil {
		return nil, fmt.Errorf("failed to send message: %w", err)
	}

	// Collect all responses from the channel
	var responses []agent.SendMessageResponse
	for resp := range responseChan {
		responses = append(responses, resp)
	}

	return responses, nil
}

// GetConversationHistory returns the full conversation history
func (b *Bridge) GetConversationHistory() agent.ConversationHistory {
	return b.services.GetConversationHistory()
}

// ClearConversation clears the conversation (keeps system prompt)
func (b *Bridge) ClearConversation() {
	b.services.ClearConversation()
}

// ExecuteTool executes an MCP tool directly
func (b *Bridge) ExecuteTool(name string, args map[string]interface{}) (map[string]interface{}, error) {
	result, err := b.services.ExecuteTool(b.ctx, name, args)
	if err != nil {
		return nil, fmt.Errorf("failed to execute tool: %w", err)
	}

	// Convert ToolResult to map for JSON serialization
	return map[string]interface{}{
		"success": result.Success,
		"content": result.Content,
		"error":   result.Error,
		"data":    result.Data,
	}, nil
}

// GetTools returns all available MCP tools
func (b *Bridge) GetTools() ([]map[string]interface{}, error) {
	// Services.GetTools() already returns []map[string]interface{}
	return b.services.GetTools(), nil
}

// GetConfig returns the current configuration (with masked sensitive data)
func (b *Bridge) GetConfig() (map[string]interface{}, error) {
	cfg := b.services.GetConfig()

	// Mask sensitive data - only show if keys are present, not the actual keys
	return map[string]interface{}{
		"agentProvider":    cfg.AgentProvider,
		"agentModel":       cfg.AgentModel,
		"defaultQuality":   cfg.DefaultQuality,
		"ffmpegPath":       cfg.FFmpegPath,
		"ffprobePath":      cfg.FFprobePath,
		"lastProjectDir":   cfg.LastProjectDir,
		"hasOpenAIKey":     cfg.OpenAIKey != "",
		"hasClaudeKey":     cfg.ClaudeAPIKey != "",
		"hasElevenLabsKey": cfg.ElevenLabsKey != "",
	}, nil
}

// UpdateConfig updates the configuration
func (b *Bridge) UpdateConfig(updates map[string]interface{}) error {
	cfg := b.services.GetConfig()

	// Update fields from map
	if val, ok := updates["openaiApiKey"].(string); ok && val != "" {
		cfg.OpenAIKey = val
	}
	if val, ok := updates["claudeApiKey"].(string); ok && val != "" {
		cfg.ClaudeAPIKey = val
	}
	if val, ok := updates["elevenLabsKey"].(string); ok && val != "" {
		cfg.ElevenLabsKey = val
	}
	if val, ok := updates["agentProvider"].(string); ok {
		cfg.AgentProvider = val
	}
	if val, ok := updates["agentModel"].(string); ok {
		cfg.AgentModel = val
	}
	if val, ok := updates["ffmpegPath"].(string); ok {
		cfg.FFmpegPath = val
	}
	if val, ok := updates["ffprobePath"].(string); ok {
		cfg.FFprobePath = val
	}
	if val, ok := updates["defaultQuality"].(string); ok {
		cfg.DefaultQuality = val
	}
	if val, ok := updates["lastProjectDir"].(string); ok {
		cfg.LastProjectDir = val
	}

	// Recreate services with new config
	return b.services.UpdateConfig(cfg)
}

// OpenFileBrowser opens the system file browser for selecting video/audio files
func (b *Bridge) OpenFileBrowser(fileTypes []string) ([]string, error) {
	result, err := b.app.Dialog.OpenFile().
		SetTitle("Select Video or Audio Files").
		AddFilter("Video Files", "*.mp4;*.mov;*.avi;*.mkv;*.webm;*.flv;*.wmv;*.m4v").
		AddFilter("Audio Files", "*.mp3;*.wav;*.flac;*.m4a;*.aac;*.ogg;*.wma").
		AddFilter("All Supported Files", "*.mp4;*.mov;*.avi;*.mkv;*.webm;*.flv;*.wmv;*.m4v;*.mp3;*.wav;*.flac;*.m4a;*.aac;*.ogg;*.wma").
		CanChooseFiles(true).
		CanChooseDirectories(false).
		ShowHiddenFiles(false).
		PromptForMultipleSelection()

	if err != nil {
		return nil, fmt.Errorf("failed to open file dialog: %w", err)
	}

	return result, nil
}

// OpenDirectoryBrowser opens the system file browser for selecting a directory
func (b *Bridge) OpenDirectoryBrowser() (string, error) {
	result, err := b.app.Dialog.OpenFile().
		SetTitle("Select Directory").
		CanChooseDirectories(true).
		CanChooseFiles(false).
		ShowHiddenFiles(false).
		PromptForSingleSelection()

	if err != nil {
		return "", fmt.Errorf("failed to open directory dialog: %w", err)
	}

	return result, nil
}

// GetFileInfo extracts metadata from a video file
func (b *Bridge) GetFileInfo(path string) (map[string]interface{}, error) {
	// Execute get_video_info tool
	result, err := b.ExecuteTool("get_video_info", map[string]interface{}{
		"file_path": path,
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}
