package agent

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
)

// ClaudeProvider implements the Provider interface for Claude (Anthropic)
type ClaudeProvider struct {
	config AgentConfig
}

// NewClaudeProvider creates a new Claude provider
func NewClaudeProvider(config AgentConfig) (*ClaudeProvider, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("Claude API key is required")
	}

	if config.Model == "" {
		config.Model = "claude-opus-4-20250514" // Latest Opus model
	}

	return &ClaudeProvider{
		config: config,
	}, nil
}

// SendMessage sends a message to Claude and returns a streaming channel
func (p *ClaudeProvider) SendMessage(ctx context.Context, messages []Message, tools []mcp.Tool) (<-chan SendMessageResponse, error) {
	responseChan := make(chan SendMessageResponse, 10)

	// TODO: Implement Claude SDK integration
	// For now, return a helpful message explaining what needs to be done
	go func() {
		defer close(responseChan)

		responseChan <- SendMessageResponse{
			Content: fmt.Sprintf("Claude provider is ready but needs SDK integration.\n\n"+
				"User message: %s\n\n"+
				"Available tools: %d\n\n"+
				"To complete: Integrate github.com/anthropics/anthropic-sdk-go\n"+
				"- Convert messages to Claude format\n"+
				"- Convert tools to Claude tool schema\n"+
				"- Handle streaming responses\n"+
				"- Parse tool calls from response\n"+
				"- Return tool calls for execution",
				getLastUserMessage(messages),
				len(tools)),
			Done: true,
		}
	}()

	return responseChan, nil
}

// GetName returns the provider name
func (p *ClaudeProvider) GetName() string {
	return "claude"
}

// Helper to get the last user message
func getLastUserMessage(messages []Message) string {
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" {
			return messages[i].Content
		}
	}
	return "<no user message>"
}
