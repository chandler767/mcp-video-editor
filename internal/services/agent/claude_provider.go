package agent

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/mark3labs/mcp-go/mcp"
)

// ClaudeProvider implements the Provider interface for Claude (Anthropic)
type ClaudeProvider struct {
	config AgentConfig
	client anthropic.Client
}

// NewClaudeProvider creates a new Claude provider
func NewClaudeProvider(config AgentConfig) (*ClaudeProvider, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("Claude API key is required")
	}

	if config.Model == "" {
		config.Model = "claude-opus-4-20250514" // Latest Opus model
	}

	client := anthropic.NewClient(option.WithAPIKey(config.APIKey))

	return &ClaudeProvider{
		config: config,
		client: client,
	}, nil
}

// SendMessage sends a message to Claude and returns a streaming channel
func (p *ClaudeProvider) SendMessage(ctx context.Context, messages []Message, tools []mcp.Tool) (<-chan SendMessageResponse, error) {
	responseChan := make(chan SendMessageResponse, 10)

	go func() {
		defer close(responseChan)

		// Convert our messages to Claude format
		claudeMessages := p.convertMessages(messages)

		// Convert MCP tools to Claude tool format
		claudeTools := p.convertTools(tools)

		// Extract system message if present
		var systemBlocks []anthropic.TextBlockParam
		for _, msg := range messages {
			if msg.Role == "system" {
				systemBlocks = append(systemBlocks, anthropic.TextBlockParam{
					Text: msg.Content,
				})
				break
			}
		}

		// Create message request
		params := anthropic.MessageNewParams{
			Model:     anthropic.Model(p.config.Model),
			MaxTokens: 4096,
			Messages:  claudeMessages,
		}

		if len(systemBlocks) > 0 {
			params.System = systemBlocks
		}

		if len(claudeTools) > 0 {
			params.Tools = claudeTools
		}

		// Create streaming request
		stream := p.client.Messages.NewStreaming(ctx, params)

		var toolCalls []ToolCall
		currentToolUseID := ""
		currentToolName := ""
		currentToolInput := ""

		// Process stream events
		for stream.Next() {
			event := stream.Current()

			switch event.Type {
			case "message_start":
				// Message started
				continue

			case "content_block_start":
				// New content block started
				startEvent := event.AsContentBlockStart()
				if startEvent.ContentBlock.Type == "tool_use" {
					toolUse := startEvent.ContentBlock.AsToolUse()
					currentToolUseID = toolUse.ID
					currentToolName = toolUse.Name
					currentToolInput = ""
				}

			case "content_block_delta":
				// Content delta received
				deltaEvent := event.AsContentBlockDelta()

				switch deltaEvent.Delta.Type {
				case "text_delta":
					// Text content
					textDelta := deltaEvent.Delta.AsTextDelta()
					responseChan <- SendMessageResponse{
						Content: textDelta.Text,
						Done:    false,
					}

				case "input_json_delta":
					// Tool input JSON delta
					inputDelta := deltaEvent.Delta.AsInputJSONDelta()
					currentToolInput += inputDelta.PartialJSON
				}

			case "content_block_stop":
				// Content block completed
				if currentToolUseID != "" && currentToolName != "" {
					// Parse tool arguments
					var args map[string]interface{}
					if err := json.Unmarshal([]byte(currentToolInput), &args); err != nil {
						// If parsing fails, use raw string
						args = map[string]interface{}{"input": currentToolInput}
					}

					toolCall := ToolCall{
						ID:   currentToolUseID,
						Name: currentToolName,
						Args: args,
					}
					toolCalls = append(toolCalls, toolCall)

					// Reset tool tracking
					currentToolUseID = ""
					currentToolName = ""
					currentToolInput = ""
				}

			case "message_delta":
				// Message-level delta (e.g., stop reason)
				continue

			case "message_stop":
				// Message completed
				if len(toolCalls) > 0 {
					responseChan <- SendMessageResponse{
						ToolCalls: toolCalls,
						Done:      false,
					}
				} else {
					responseChan <- SendMessageResponse{
						Done: true,
					}
				}
				return
			}
		}

		// Check for stream errors
		if err := stream.Err(); err != nil {
			responseChan <- SendMessageResponse{
				Error: fmt.Sprintf("Claude API error: %v", err),
				Done:  true,
			}
			return
		}
	}()

	return responseChan, nil
}

// GetName returns the provider name
func (p *ClaudeProvider) GetName() string {
	return "claude"
}

// convertMessages converts our Message format to Claude's format
func (p *ClaudeProvider) convertMessages(messages []Message) []anthropic.MessageParam {
	var claudeMessages []anthropic.MessageParam

	for _, msg := range messages {
		// Skip system messages (handled separately)
		if msg.Role == "system" {
			continue
		}

		var content []anthropic.ContentBlockParamUnion

		// Add text content if present
		if msg.Content != "" {
			content = append(content, anthropic.NewTextBlock(msg.Content))
		}

		// Add tool calls if present (for assistant messages)
		if msg.Role == "assistant" && len(msg.ToolCalls) > 0 {
			for _, tc := range msg.ToolCalls {
				// Marshal args to JSON for tool use
				argsJSON, _ := json.Marshal(tc.Args)
				content = append(content, anthropic.NewToolUseBlock(tc.ID, tc.Name, string(argsJSON)))
			}
		}

		// Add tool results if present (as user messages)
		if msg.Role == "assistant" && len(msg.ToolResults) > 0 {
			// Tool results become a user message with tool_result blocks
			var toolResultContent []anthropic.ContentBlockParamUnion
			for _, tr := range msg.ToolResults {
				var resultContent string
				if tr.Success {
					resultContent = tr.Content
				} else {
					resultContent = fmt.Sprintf("Error: %s", tr.Error)
				}

				toolResultContent = append(toolResultContent,
					anthropic.NewToolResultBlock(tr.ToolCallID, resultContent, false))
			}

			if len(toolResultContent) > 0 {
				claudeMessages = append(claudeMessages, anthropic.NewUserMessage(toolResultContent...))
			}
			continue
		}

		// Create message based on role
		switch msg.Role {
		case "user":
			if len(content) > 0 {
				claudeMessages = append(claudeMessages, anthropic.NewUserMessage(content...))
			}
		case "assistant":
			if len(content) > 0 {
				claudeMessages = append(claudeMessages, anthropic.NewAssistantMessage(content...))
			}
		}
	}

	return claudeMessages
}

// convertTools converts MCP tools to Claude tool format
func (p *ClaudeProvider) convertTools(tools []mcp.Tool) []anthropic.ToolUnionParam {
	claudeTools := make([]anthropic.ToolUnionParam, len(tools))

	for i, tool := range tools {
		// Convert input schema to anthropic format
		schemaBytes, _ := json.Marshal(tool.InputSchema)
		var schemaMap map[string]interface{}
		json.Unmarshal(schemaBytes, &schemaMap)

		// Extract properties and required fields from schema
		var properties interface{}
		var required []string

		if props, ok := schemaMap["properties"]; ok {
			properties = props
		}
		if req, ok := schemaMap["required"].([]interface{}); ok {
			for _, r := range req {
				if reqStr, ok := r.(string); ok {
					required = append(required, reqStr)
				}
			}
		}

		// Create schema param
		schema := anthropic.ToolInputSchemaParam{
			Properties: properties,
			Required:   required,
		}

		// Create tool param
		claudeTools[i] = anthropic.ToolUnionParamOfTool(schema, tool.Name)

		// Set description if available
		if tool.Description != "" {
			claudeTools[i].OfTool.Description = anthropic.String(tool.Description)
		}
	}

	return claudeTools
}
