package agent

import (
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

func TestOpenAIProvider_ConvertMessages(t *testing.T) {
	config := AgentConfig{
		Provider: "openai",
		Model:    "gpt-4-turbo",
		APIKey:   "fake-api-key",
	}
	provider, err := NewOpenAIProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	messages := []Message{
		{
			Role:    "user",
			Content: "Hello",
		},
		{
			Role:    "assistant",
			Content: "Hi there!",
		},
		{
			Role:    "user",
			Content: "How are you?",
		},
	}

	converted := provider.convertMessages(messages)

	if len(converted) != len(messages) {
		t.Errorf("Expected %d converted messages, got %d", len(messages), len(converted))
	}

	for i, msg := range converted {
		if msg.Role != messages[i].Role {
			t.Errorf("Message %d: expected role %s, got %s", i, messages[i].Role, msg.Role)
		}
		if msg.Content != messages[i].Content {
			t.Errorf("Message %d: expected content %s, got %s", i, messages[i].Content, msg.Content)
		}
	}
}

func TestOpenAIProvider_ConvertMessagesWithToolCalls(t *testing.T) {
	config := AgentConfig{
		Provider: "openai",
		Model:    "gpt-4-turbo",
		APIKey:   "fake-api-key",
	}
	provider, err := NewOpenAIProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	messages := []Message{
		{
			Role:    "user",
			Content: "Get video info",
		},
		{
			Role:    "assistant",
			Content: "Let me check that.",
			ToolCalls: []ToolCall{
				{
					ID:   "call_123",
					Name: "get_video_info",
					Args: map[string]interface{}{
						"file_path": "/path/to/video.mp4",
					},
				},
			},
			ToolResults: []ToolResult{
				{
					ToolCallID: "call_123",
					Success:    true,
					Content:    "1920x1080, 30fps",
				},
			},
		},
	}

	converted := provider.convertMessages(messages)

	// Should have 3 messages (user, assistant, tool result)
	if len(converted) != 3 {
		t.Errorf("Expected 3 converted messages, got %d", len(converted))
	}

	// Check assistant message has tool calls
	if len(converted[1].ToolCalls) != 1 {
		t.Errorf("Expected assistant message to have 1 tool call, got %d", len(converted[1].ToolCalls))
	}

	// Check tool result message
	if converted[2].Role != "tool" {
		t.Errorf("Expected third message to be tool role, got %s", converted[2].Role)
	}

	if converted[2].ToolCallID != "call_123" {
		t.Errorf("Expected tool call ID call_123, got %s", converted[2].ToolCallID)
	}
}

func TestOpenAIProvider_ConvertTools(t *testing.T) {
	config := AgentConfig{
		Provider: "openai",
		Model:    "gpt-4-turbo",
		APIKey:   "fake-api-key",
	}
	provider, err := NewOpenAIProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	tools := []mcp.Tool{
		{
			Name:        "get_video_info",
			Description: "Get information about a video file",
			InputSchema: mcp.ToolInputSchema{
				Type: "object",
				Properties: map[string]interface{}{
					"file_path": map[string]interface{}{
						"type":        "string",
						"description": "Path to video file",
					},
				},
				Required: []string{"file_path"},
			},
		},
		{
			Name:        "trim_video",
			Description: "Trim a video",
			InputSchema: mcp.ToolInputSchema{
				Type: "object",
				Properties: map[string]interface{}{
					"input_file": map[string]interface{}{
						"type": "string",
					},
				},
			},
		},
	}

	converted := provider.convertTools(tools)

	if len(converted) != len(tools) {
		t.Errorf("Expected %d converted tools, got %d", len(tools), len(converted))
	}

	for i, tool := range converted {
		if tool.Function.Name != tools[i].Name {
			t.Errorf("Tool %d: expected name %s, got %s", i, tools[i].Name, tool.Function.Name)
		}
		if tool.Function.Description != tools[i].Description {
			t.Errorf("Tool %d: expected description %s, got %s", i, tools[i].Description, tool.Function.Description)
		}
	}
}

func TestOpenAIProvider_ConvertToolsEmpty(t *testing.T) {
	config := AgentConfig{
		Provider: "openai",
		Model:    "gpt-4-turbo",
		APIKey:   "fake-api-key",
	}
	provider, err := NewOpenAIProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	tools := []mcp.Tool{}
	converted := provider.convertTools(tools)

	if len(converted) != 0 {
		t.Errorf("Expected 0 converted tools, got %d", len(converted))
	}
}

func TestOpenAIProvider_SendMessage_RequiresAPIKey(t *testing.T) {
	// This test verifies that provider is created with API key
	config := AgentConfig{
		Provider: "openai",
		Model:    "gpt-4-turbo",
		APIKey:   "", // Empty API key
	}
	_, err := NewOpenAIProvider(config)

	// Should error on creation with empty API key
	if err == nil {
		t.Error("Expected error with empty API key")
	}
}

func TestOpenAIProvider_ModelConfiguration(t *testing.T) {
	testCases := []struct {
		model    string
		expected string
	}{
		{"gpt-4-turbo", "gpt-4-turbo"},
		{"gpt-4", "gpt-4"},
		{"gpt-3.5-turbo", "gpt-3.5-turbo"},
		{"", "gpt-4-turbo-preview"}, // Default from NewOpenAIProvider
	}

	for _, tc := range testCases {
		config := AgentConfig{
			Provider: "openai",
			Model:    tc.model,
			APIKey:   "fake-key",
		}
		provider, err := NewOpenAIProvider(config)
		if err != nil {
			t.Fatalf("Failed to create provider for model %s: %v", tc.model, err)
		}

		if tc.model == "" && provider.config.Model != tc.expected {
			t.Errorf("Expected default model %s, got %s", tc.expected, provider.config.Model)
		} else if tc.model != "" && provider.config.Model != tc.model {
			t.Errorf("Expected model %s, got %s", tc.model, provider.config.Model)
		}
	}
}
