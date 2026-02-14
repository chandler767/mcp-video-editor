package bridge

import (
	"context"

	"github.com/chandler-mayo/mcp-video-editor/pkg/config"
	"github.com/chandler-mayo/mcp-video-editor/pkg/server"
)

// BridgeService is the main Wails service that bridges the frontend to the Go backend
type BridgeService struct {
	ctx       context.Context
	config    *config.Config
	mcpServer *server.MCPServer
}

// NewBridgeService creates a new bridge service
func NewBridgeService(cfg *config.Config, mcpServer *server.MCPServer) *BridgeService {
	return &BridgeService{
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
