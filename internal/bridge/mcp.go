package bridge

import (
	"encoding/json"
	"fmt"

	"github.com/chandler-mayo/mcp-video-editor/pkg/server"
)

// ExecuteMCPTool executes an MCP tool by name with the given arguments
func (b *BridgeService) ExecuteMCPTool(name string, args map[string]interface{}) (*server.ToolResult, error) {
	result, err := b.mcpServer.ExecuteToolDirect(name, args)
	if err != nil {
		return &server.ToolResult{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return result, nil
}

// GetAvailableTools returns a list of all available MCP tools
func (b *BridgeService) GetAvailableTools() ([]ToolDefinition, error) {
	tools := b.mcpServer.GetToolDefinitions()

	definitions := make([]ToolDefinition, len(tools))
	for i, tool := range tools {
		// Convert the tool schema to our format
		inputSchema := make(map[string]interface{})
		schemaBytes, err := json.Marshal(tool.InputSchema)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal input schema: %w", err)
		}
		if err := json.Unmarshal(schemaBytes, &inputSchema); err != nil {
			return nil, fmt.Errorf("failed to unmarshal input schema: %w", err)
		}

		definitions[i] = ToolDefinition{
			Name:        tool.Name,
			Description: tool.Description,
			InputSchema: inputSchema,
		}
	}

	return definitions, nil
}

// ValidateToolArgs validates the arguments for a specific tool
func (b *BridgeService) ValidateToolArgs(name string, args map[string]interface{}) (bool, error) {
	// TODO: Implement validation logic based on tool input schema
	// For now, just return true
	return true, nil
}
