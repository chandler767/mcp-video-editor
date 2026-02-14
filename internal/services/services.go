package services

import (
	"context"
	"fmt"

	"github.com/chandler-mayo/mcp-video-editor/internal/services/agent"
	"github.com/chandler-mayo/mcp-video-editor/pkg/config"
	"github.com/chandler-mayo/mcp-video-editor/pkg/server"
)

// Services is the main service layer that orchestrates all functionality
// This is transport-agnostic and can be used by Wails, HTTP API, or any other frontend
type Services struct {
	config      *config.Config
	mcpServer   *server.MCPServer
	agent       *agent.Orchestrator
}

// NewServices creates a new service layer
func NewServices(cfg *config.Config, mcpServer *server.MCPServer) (*Services, error) {
	// Create agent orchestrator
	agentConfig := agent.AgentConfig{
		Provider: getAgentProvider(cfg),
		Model:    getAgentModel(cfg),
		APIKey:   getAgentAPIKey(cfg),
	}

	orchestrator, err := agent.NewOrchestrator(agentConfig, mcpServer)
	if err != nil {
		return nil, fmt.Errorf("failed to create agent orchestrator: %w", err)
	}

	return &Services{
		config:    cfg,
		mcpServer: mcpServer,
		agent:     orchestrator,
	}, nil
}

// Agent returns the agent orchestrator
func (s *Services) Agent() *agent.Orchestrator {
	return s.agent
}

// Config returns the configuration
func (s *Services) Config() *config.Config {
	return s.config
}

// MCPServer returns the MCP server
func (s *Services) MCPServer() *server.MCPServer {
	return s.mcpServer
}

// Helper functions to get agent configuration from config

func getAgentProvider(cfg *config.Config) string {
	if cfg.AgentProvider != "" {
		return cfg.AgentProvider
	}

	// Auto-detect based on available API keys
	if cfg.ClaudeAPIKey != "" {
		return "claude"
	}
	if cfg.OpenAIKey != "" {
		return "openai"
	}

	// Default to Claude
	return "claude"
}

func getAgentModel(cfg *config.Config) string {
	if cfg.AgentModel != "" {
		return cfg.AgentModel
	}

	// Use defaults based on provider
	provider := getAgentProvider(cfg)
	if provider == "openai" {
		return "gpt-4-turbo"
	}
	return "claude-opus-4-6"
}

func getAgentAPIKey(cfg *config.Config) string {
	provider := getAgentProvider(cfg)
	if provider == "openai" {
		return cfg.OpenAIKey
	}
	return cfg.ClaudeAPIKey
}

// SendMessage sends a message to the agent
func (s *Services) SendMessage(ctx context.Context, message string) (<-chan agent.SendMessageResponse, error) {
	return s.agent.SendMessage(ctx, message)
}

// GetConversationHistory returns the conversation history
func (s *Services) GetConversationHistory() agent.ConversationHistory {
	return s.agent.GetConversationHistory()
}

// ClearConversation clears the conversation history
func (s *Services) ClearConversation() {
	s.agent.ClearConversation()
}

// ExecuteTool executes an MCP tool directly
func (s *Services) ExecuteTool(ctx context.Context, name string, args map[string]interface{}) (*server.ToolResult, error) {
	return s.mcpServer.ExecuteToolDirect(name, args)
}

// GetTools returns all available MCP tools as serializable maps
func (s *Services) GetTools() []map[string]interface{} {
	// Get tool definitions from MCP server
	mcpTools := s.mcpServer.GetToolDefinitions()

	// Convert to serializable maps for JSON transmission
	tools := make([]map[string]interface{}, len(mcpTools))
	for i, tool := range mcpTools {
		tools[i] = map[string]interface{}{
			"name":        tool.Name,
			"description": tool.Description,
			"inputSchema": tool.InputSchema,
		}
	}

	return tools
}

// GetConfig returns the current configuration
func (s *Services) GetConfig() *config.Config {
	return s.config
}

// UpdateConfig updates the configuration
func (s *Services) UpdateConfig(cfg *config.Config) error {
	s.config = cfg

	// Recreate agent with new config if provider/key changed
	agentConfig := agent.AgentConfig{
		Provider: getAgentProvider(cfg),
		Model:    getAgentModel(cfg),
		APIKey:   getAgentAPIKey(cfg),
	}

	orchestrator, err := agent.NewOrchestrator(agentConfig, s.mcpServer)
	if err != nil {
		return fmt.Errorf("failed to recreate agent: %w", err)
	}

	s.agent = orchestrator
	return nil
}
