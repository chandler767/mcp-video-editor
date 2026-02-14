package agent

// Message represents a conversation message
type Message struct {
	Role      string                 `json:"role"`      // user, assistant, system
	Content   string                 `json:"content"`   // Message text
	ToolCalls []ToolCall             `json:"toolCalls,omitempty"`
	ToolResults []ToolResult         `json:"toolResults,omitempty"`
}

// ToolCall represents a tool execution request from the LLM
type ToolCall struct {
	ID   string                 `json:"id"`
	Name string                 `json:"name"`
	Args map[string]interface{} `json:"args"`
}

// ToolResult represents the result of a tool execution
type ToolResult struct {
	ToolCallID string `json:"toolCallId"`
	Success    bool   `json:"success"`
	Content    string `json:"content,omitempty"`
	Error      string `json:"error,omitempty"`
}

// AgentConfig configures the agent provider and model
type AgentConfig struct {
	Provider  string `json:"provider"`  // "claude" or "openai"
	Model     string `json:"model"`     // Model ID
	APIKey    string `json:"apiKey"`    // API key for the provider
	SystemPrompt string `json:"systemPrompt,omitempty"` // Optional system prompt override
}

// SendMessageRequest is the request to send a message to the agent
type SendMessageRequest struct {
	Message string `json:"message"`
}

// SendMessageResponse is the streaming response from the agent
type SendMessageResponse struct {
	Content     string       `json:"content,omitempty"`     // Text content chunk
	ToolCalls   []ToolCall   `json:"toolCalls,omitempty"`   // Tool calls made
	ToolResults []ToolResult `json:"toolResults,omitempty"` // Tool execution results
	Done        bool         `json:"done"`                  // Whether streaming is complete
	Error       string       `json:"error,omitempty"`       // Error if any
}

// ConversationHistory is the full conversation state
type ConversationHistory struct {
	Messages []Message `json:"messages"`
}
