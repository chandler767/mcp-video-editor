package wails

import (
	"context"

	"github.com/chandler-mayo/mcp-video-editor/internal/services"
	"github.com/chandler-mayo/mcp-video-editor/internal/services/agent"
)

// Bridge is the Wails-specific transport layer
// It exposes the service layer to the React frontend via Wails bindings
type Bridge struct {
	ctx      context.Context
	services *services.Services
}

// NewBridge creates a new Wails bridge
func NewBridge(services *services.Services) *Bridge {
	return &Bridge{
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

// SendMessage sends a message to the agent and returns a channel of responses
// This method is called from the React frontend
func (b *Bridge) SendMessage(message string) (<-chan agent.SendMessageResponse, error) {
	return b.services.SendMessage(b.ctx, message)
}

// GetConversationHistory returns the full conversation history
func (b *Bridge) GetConversationHistory() agent.ConversationHistory {
	return b.services.GetConversationHistory()
}

// ClearConversation clears the conversation (keeps system prompt)
func (b *Bridge) ClearConversation() {
	b.services.ClearConversation()
}
