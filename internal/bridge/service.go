package bridge

import (
	"context"

	"github.com/chandler-mayo/mcp-video-editor/pkg/config"
	"github.com/chandler-mayo/mcp-video-editor/pkg/server"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// BridgeService is the main Wails service that bridges the frontend to the Go backend
type BridgeService struct {
	ctx       context.Context
	app       *application.App
	config    *config.Config
	mcpServer *server.MCPServer
}

// NewBridgeService creates a new bridge service
func NewBridgeService(app *application.App, cfg *config.Config, mcpServer *server.MCPServer) *BridgeService {
	return &BridgeService{
		app:       app,
		config:    cfg,
		mcpServer: mcpServer,
	}
}

// Startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (b *BridgeService) Startup(ctx context.Context) {
	b.ctx = ctx
}

// Shutdown is called when the app terminates
func (b *BridgeService) Shutdown(ctx context.Context) {
	// Cleanup operations if needed
}

// OpenFileDialog opens a native file picker dialog for selecting video/audio files
func (b *BridgeService) OpenFileDialog() ([]string, error) {
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
		return nil, err
	}

	return result, nil
}

// OpenDirectoryDialog opens a native directory picker dialog
func (b *BridgeService) OpenDirectoryDialog() (string, error) {
	result, err := b.app.Dialog.OpenFile().
		SetTitle("Select Directory").
		CanChooseDirectories(true).
		CanChooseFiles(false).
		ShowHiddenFiles(false).
		PromptForSingleSelection()

	if err != nil {
		return "", err
	}

	return result, nil
}
