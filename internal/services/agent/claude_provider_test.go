package agent

import (
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

func TestClaudeProvider_ConvertMessages(t *testing.T) {
	provider := &ClaudeProvider{
		config: AgentConfig{
			Provider: "claude",
			Model:    "claude-opus-4-20250514",
			APIKey:   "test-key",
		},
	}

	messages := []Message{
		{
			Role:    "system",
			Content: "You are a helpful assistant.",
		},
		{
			Role:    "user",
			Content: "Hello, how are you?",
		},
		{
			Role:    "assistant",
			Content: "I'm doing well, thank you!",
		},
	}

	claudeMessages := provider.convertMessages(messages)

	// System message should be skipped (handled separately)
	// So we expect 2 messages: user and assistant
	if len(claudeMessages) != 2 {
		t.Errorf("Expected 2 Claude messages, got %d", len(claudeMessages))
	}

	// Check first message is user
	if len(claudeMessages) > 0 {
		// Check it has content
		firstMsg := claudeMessages[0]
		if len(firstMsg.Content) == 0 {
			t.Error("First message should have content")
		}
	}
}

func TestClaudeProvider_ConvertMessagesWithToolCalls(t *testing.T) {
	provider := &ClaudeProvider{
		config: AgentConfig{
			Provider: "claude",
			Model:    "claude-opus-4-20250514",
			APIKey:   "test-key",
		},
	}

	messages := []Message{
		{
			Role:    "user",
			Content: "Get the weather",
		},
		{
			Role:    "assistant",
			Content: "I'll check the weather for you.",
			ToolCalls: []ToolCall{
				{
					ID:   "call_123",
					Name: "get_weather",
					Args: map[string]interface{}{
						"location": "San Francisco",
					},
				},
			},
		},
		{
			Role: "assistant",
			ToolResults: []ToolResult{
				{
					ToolCallID: "call_123",
					Success:    true,
					Content:    "72°F and sunny",
				},
			},
		},
	}

	claudeMessages := provider.convertMessages(messages)

	// Should have: user message, assistant with tool call, user with tool result
	if len(claudeMessages) < 2 {
		t.Errorf("Expected at least 2 Claude messages, got %d", len(claudeMessages))
	}

	// Check assistant message has content
	if len(claudeMessages) > 1 {
		assistantMsg := claudeMessages[1]
		if len(assistantMsg.Content) == 0 {
			t.Error("Assistant message should have content blocks")
		}
	}
}

func TestClaudeProvider_ConvertTools(t *testing.T) {
	provider := &ClaudeProvider{
		config: AgentConfig{
			Provider: "claude",
			Model:    "claude-opus-4-20250514",
			APIKey:   "test-key",
		},
	}

	tools := []mcp.Tool{
		{
			Name:        "get_weather",
			Description: "Get the current weather",
			InputSchema: mcp.ToolInputSchema{
				Type: "object",
				Properties: map[string]interface{}{
					"location": map[string]interface{}{
						"type":        "string",
						"description": "City name",
					},
				},
				Required: []string{"location"},
			},
		},
		{
			Name:        "calculate",
			Description: "Perform a calculation",
			InputSchema: mcp.ToolInputSchema{
				Type: "object",
				Properties: map[string]interface{}{
					"expression": map[string]interface{}{
						"type":        "string",
						"description": "Math expression",
					},
				},
				Required: []string{"expression"},
			},
		},
	}

	claudeTools := provider.convertTools(tools)

	if len(claudeTools) != 2 {
		t.Errorf("Expected 2 Claude tools, got %d", len(claudeTools))
	}

	// Check first tool
	if claudeTools[0].OfTool == nil {
		t.Fatal("First tool should have OfTool populated")
	}
	if claudeTools[0].OfTool.Name != "get_weather" {
		t.Errorf("Expected tool name 'get_weather', got '%s'", claudeTools[0].OfTool.Name)
	}
	if claudeTools[0].OfTool.Description.Value != "Get the current weather" {
		t.Errorf("Expected tool description 'Get the current weather', got '%s'", claudeTools[0].OfTool.Description.Value)
	}

	// Check second tool
	if claudeTools[1].OfTool == nil {
		t.Fatal("Second tool should have OfTool populated")
	}
	if claudeTools[1].OfTool.Name != "calculate" {
		t.Errorf("Expected tool name 'calculate', got '%s'", claudeTools[1].OfTool.Name)
	}
}

func TestClaudeProvider_ConvertToolsEmpty(t *testing.T) {
	provider := &ClaudeProvider{
		config: AgentConfig{
			Provider: "claude",
			Model:    "claude-opus-4-20250514",
			APIKey:   "test-key",
		},
	}

	claudeTools := provider.convertTools([]mcp.Tool{})

	if len(claudeTools) != 0 {
		t.Errorf("Expected 0 Claude tools, got %d", len(claudeTools))
	}
}

func TestClaudeProvider_GetName(t *testing.T) {
	provider := &ClaudeProvider{
		config: AgentConfig{
			Provider: "claude",
			Model:    "claude-opus-4-20250514",
			APIKey:   "test-key",
		},
	}

	if provider.GetName() != "claude" {
		t.Errorf("Expected provider name 'claude', got '%s'", provider.GetName())
	}
}

func TestClaudeProvider_ModelConfiguration(t *testing.T) {
	// Test default model
	provider1, err := NewClaudeProvider(AgentConfig{
		Provider: "claude",
		APIKey:   "test-key",
	})
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}
	if provider1.config.Model != "claude-opus-4-20250514" {
		t.Errorf("Expected default model 'claude-opus-4-20250514', got '%s'", provider1.config.Model)
	}

	// Test custom model
	provider2, err := NewClaudeProvider(AgentConfig{
		Provider: "claude",
		Model:    "claude-sonnet-4-20250514",
		APIKey:   "test-key",
	})
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}
	if provider2.config.Model != "claude-sonnet-4-20250514" {
		t.Errorf("Expected model 'claude-sonnet-4-20250514', got '%s'", provider2.config.Model)
	}

	// Test missing API key
	_, err = NewClaudeProvider(AgentConfig{
		Provider: "claude",
	})
	if err == nil {
		t.Error("Expected error for missing API key")
	}
}
