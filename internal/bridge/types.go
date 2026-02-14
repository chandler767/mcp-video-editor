package bridge

// ToolDefinition represents an MCP tool schema
type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"input_schema"`
}

// ToolResult represents the result of executing an MCP tool
type ToolResult struct {
	Success bool        `json:"success"`
	Content string      `json:"content,omitempty"`
	Error   string      `json:"error,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}
