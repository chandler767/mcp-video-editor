package agent

import (
	"context"
	"fmt"
	"sync"

	"github.com/chandler-mayo/mcp-video-editor/pkg/server"
	"github.com/mark3labs/mcp-go/mcp"
)

// Orchestrator manages the AI agent and conversation
type Orchestrator struct {
	mu          sync.RWMutex
	config      AgentConfig
	mcpServer   *server.MCPServer
	provider    Provider // Interface for Claude/OpenAI
	conversation []Message
}

// Provider is the interface that Claude and OpenAI adapters must implement
type Provider interface {
	// SendMessage sends a message and returns a streaming channel of responses
	SendMessage(ctx context.Context, messages []Message, tools []mcp.Tool) (<-chan SendMessageResponse, error)

	// GetName returns the provider name
	GetName() string
}

// NewOrchestrator creates a new agent orchestrator
func NewOrchestrator(config AgentConfig, mcpServer *server.MCPServer) (*Orchestrator, error) {
	// Create the appropriate provider
	var provider Provider
	var err error

	switch config.Provider {
	case "claude":
		provider, err = NewClaudeProvider(config)
	case "openai":
		provider, err = NewOpenAIProvider(config)
	default:
		return nil, fmt.Errorf("unknown provider: %s", config.Provider)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create provider: %w", err)
	}

	// Initialize with system prompt
	systemPrompt := config.SystemPrompt
	if systemPrompt == "" {
		systemPrompt = getDefaultSystemPrompt()
	}

	return &Orchestrator{
		config:      config,
		mcpServer:   mcpServer,
		provider:    provider,
		conversation: []Message{
			{
				Role:    "system",
				Content: systemPrompt,
			},
		},
	}, nil
}

// SendMessage sends a user message to the agent and handles the full conversation loop
func (o *Orchestrator) SendMessage(ctx context.Context, userMessage string) (<-chan SendMessageResponse, error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	// Add user message to conversation
	o.conversation = append(o.conversation, Message{
		Role:    "user",
		Content: userMessage,
	})

	// Create response channel
	responseChan := make(chan SendMessageResponse, 10)

	// Start goroutine to handle the agent loop
	go o.agentLoop(ctx, responseChan)

	return responseChan, nil
}

// agentLoop handles the full agent conversation loop with tool execution
func (o *Orchestrator) agentLoop(ctx context.Context, responseChan chan<- SendMessageResponse) {
	defer close(responseChan)

	// Get available MCP tools
	toolDefinitions := o.getToolDefinitions()

	// Loop until agent provides a final response (no tool calls)
	for {
		// Send current conversation to provider
		providerChan, err := o.provider.SendMessage(ctx, o.conversation, toolDefinitions)
		if err != nil {
			responseChan <- SendMessageResponse{
				Error: fmt.Sprintf("Provider error: %v", err),
				Done:  true,
			}
			return
		}

		// Collect all responses from provider
		var assistantMessage Message
		var toolCalls []ToolCall

		for response := range providerChan {
			// Forward content chunks to client
			if response.Content != "" {
				responseChan <- response
			}

			// Accumulate assistant message content
			if response.Content != "" {
				assistantMessage.Content += response.Content
			}

			// Collect tool calls
			if len(response.ToolCalls) > 0 {
				toolCalls = append(toolCalls, response.ToolCalls...)
			}

			// Check for errors
			if response.Error != "" {
				responseChan <- response
				return
			}
		}

		assistantMessage.Role = "assistant"

		// If no tool calls, we're done
		if len(toolCalls) == 0 {
			o.conversation = append(o.conversation, assistantMessage)
			responseChan <- SendMessageResponse{
				Done: true,
			}
			return
		}

		// Execute tool calls
		assistantMessage.ToolCalls = toolCalls
		o.conversation = append(o.conversation, assistantMessage)

		toolResults := o.executeToolCalls(ctx, toolCalls)

		// Send tool results to client
		responseChan <- SendMessageResponse{
			ToolCalls:   toolCalls,
			ToolResults: toolResults,
		}

		// Add tool results to conversation
		o.conversation = append(o.conversation, Message{
			Role:        "assistant",
			ToolResults: toolResults,
		})

		// Continue loop to get agent's response with tool results
	}
}

// executeToolCalls executes the requested MCP tools
func (o *Orchestrator) executeToolCalls(ctx context.Context, toolCalls []ToolCall) []ToolResult {
	results := make([]ToolResult, len(toolCalls))

	for i, toolCall := range toolCalls {
		result, err := o.mcpServer.ExecuteToolDirect(toolCall.Name, toolCall.Args)
		if err != nil {
			results[i] = ToolResult{
				ToolCallID: toolCall.ID,
				Success:    false,
				Error:      err.Error(),
			}
			continue
		}

		results[i] = ToolResult{
			ToolCallID: toolCall.ID,
			Success:    result.Success,
			Content:    result.Content,
			Error:      result.Error,
		}
	}

	return results
}

// getToolDefinitions returns all available MCP tools
func (o *Orchestrator) getToolDefinitions() []mcp.Tool {
	return o.mcpServer.GetToolDefinitions()
}

// GetConversationHistory returns the current conversation history
func (o *Orchestrator) GetConversationHistory() ConversationHistory {
	o.mu.RLock()
	defer o.mu.RUnlock()

	return ConversationHistory{
		Messages: o.conversation,
	}
}

// ClearConversation clears the conversation history (keeps system prompt)
func (o *Orchestrator) ClearConversation() {
	o.mu.Lock()
	defer o.mu.Unlock()

	systemPrompt := o.conversation[0]
	o.conversation = []Message{systemPrompt}
}

// getDefaultSystemPrompt returns the default system prompt for video editing
func getDefaultSystemPrompt() string {
	return `You are an expert video editing assistant powered by a comprehensive MCP (Model Context Protocol) server with 70+ professional video editing tools.

Your capabilities include:
- Video operations: trimming, concatenation, resizing, transcoding
- Visual effects: blur, color grading, chroma key, vignette, sharpening
- Audio editing: trimming, mixing, normalization, voice cloning, text-to-speech
- Compositing: picture-in-picture, split screen, side-by-side
- Text and graphics: overlays, animations, subtitles, shapes
- Transcript operations: extraction, search, smart editing based on dialogue
- Timeline management: full undo/redo with operation history
- Multi-take editing: automatic analysis and selection of best takes
- Vision analysis: AI-powered content understanding with GPT-4 Vision

When helping users:
1. Ask clarifying questions if requirements are unclear
2. Suggest the best approach for their needs
3. Execute operations step-by-step, explaining what you're doing
4. Use the timeline system to allow undoing mistakes
5. Optimize for quality by default, but ask about delivery format
6. Proactively suggest enhancements (e.g., color correction, audio normalization)

Always be helpful, clear, and focused on delivering professional results.`
}
