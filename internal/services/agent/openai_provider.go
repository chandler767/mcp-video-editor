package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/mark3labs/mcp-go/mcp"
	openai "github.com/sashabaranov/go-openai"
)

// OpenAIProvider implements the Provider interface for OpenAI
type OpenAIProvider struct {
	config AgentConfig
	client *openai.Client
}

// NewOpenAIProvider creates a new OpenAI provider
func NewOpenAIProvider(config AgentConfig) (*OpenAIProvider, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("OpenAI API key is required")
	}

	if config.Model == "" {
		config.Model = "gpt-4-turbo-preview" // Default model
	}

	client := openai.NewClient(config.APIKey)

	return &OpenAIProvider{
		config: config,
		client: client,
	}, nil
}

// SendMessage sends a message to OpenAI and returns a streaming channel
func (p *OpenAIProvider) SendMessage(ctx context.Context, messages []Message, tools []mcp.Tool) (<-chan SendMessageResponse, error) {
	responseChan := make(chan SendMessageResponse, 10)

	go func() {
		defer close(responseChan)

		// Convert our messages to OpenAI format
		openaiMessages := p.convertMessages(messages)

		// Convert MCP tools to OpenAI function format
		openaiTools := p.convertTools(tools)

		// Create chat completion request
		req := openai.ChatCompletionRequest{
			Model:    p.config.Model,
			Messages: openaiMessages,
			Tools:    openaiTools,
			Stream:   true,
		}

		// Create streaming request
		stream, err := p.client.CreateChatCompletionStream(ctx, req)
		if err != nil {
			responseChan <- SendMessageResponse{
				Error: fmt.Sprintf("OpenAI API error: %v", err),
				Done:  true,
			}
			return
		}
		defer stream.Close()

		var currentContent string
		var toolCalls []ToolCall
		toolCallMap := make(map[int]*ToolCall) // Track tool calls by index

		// Process stream
		for {
			response, err := stream.Recv()
			if err == io.EOF {
				// Stream finished
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

			if err != nil {
				responseChan <- SendMessageResponse{
					Error: fmt.Sprintf("Stream error: %v", err),
					Done:  true,
				}
				return
			}

			if len(response.Choices) == 0 {
				continue
			}

			delta := response.Choices[0].Delta

			// Handle content delta
			if delta.Content != "" {
				currentContent += delta.Content
				responseChan <- SendMessageResponse{
					Content: delta.Content,
					Done:    false,
				}
			}

			// Handle tool calls
			if len(delta.ToolCalls) > 0 {
				for _, toolCall := range delta.ToolCalls {
					idx := *toolCall.Index

					// Initialize tool call if new
					if _, exists := toolCallMap[idx]; !exists {
						toolCallMap[idx] = &ToolCall{
							ID:   toolCall.ID,
							Name: toolCall.Function.Name,
							Args: make(map[string]interface{}),
						}
						toolCalls = append(toolCalls, *toolCallMap[idx])
					}

					// Append function arguments
					if toolCall.Function.Arguments != "" {
						// Parse the arguments JSON
						var args map[string]interface{}
						if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err == nil {
							toolCallMap[idx].Args = args
						}
					}
				}
			}
		}
	}()

	return responseChan, nil
}

// GetName returns the provider name
func (p *OpenAIProvider) GetName() string {
	return "openai"
}

// convertMessages converts our Message format to OpenAI's format
func (p *OpenAIProvider) convertMessages(messages []Message) []openai.ChatCompletionMessage {
	var openaiMessages []openai.ChatCompletionMessage

	for _, msg := range messages {
		switch msg.Role {
		case "system":
			openaiMessages = append(openaiMessages, openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleSystem,
				Content: msg.Content,
			})

		case "user":
			openaiMessages = append(openaiMessages, openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleUser,
				Content: msg.Content,
			})

		case "assistant":
			message := openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleAssistant,
				Content: msg.Content,
			}

			// Add tool calls if present
			if len(msg.ToolCalls) > 0 {
				var toolCalls []openai.ToolCall
				for _, tc := range msg.ToolCalls {
					argsJSON, _ := json.Marshal(tc.Args)
					toolCalls = append(toolCalls, openai.ToolCall{
						ID:   tc.ID,
						Type: openai.ToolTypeFunction,
						Function: openai.FunctionCall{
							Name:      tc.Name,
							Arguments: string(argsJSON),
						},
					})
				}
				message.ToolCalls = toolCalls
			}

			openaiMessages = append(openaiMessages, message)

			// Add tool results as separate messages
			for _, toolResult := range msg.ToolResults {
				var content string
				if toolResult.Success {
					content = toolResult.Content
				} else {
					content = fmt.Sprintf("Error: %s", toolResult.Error)
				}

				openaiMessages = append(openaiMessages, openai.ChatCompletionMessage{
					Role:       openai.ChatMessageRoleTool,
					Content:    content,
					ToolCallID: toolResult.ToolCallID,
				})
			}
		}
	}

	return openaiMessages
}

// convertTools converts MCP tools to OpenAI function format
func (p *OpenAIProvider) convertTools(tools []mcp.Tool) []openai.Tool {
	openaiTools := make([]openai.Tool, len(tools))

	for i, tool := range tools {
		// Convert input schema to map
		var parameters map[string]interface{}
		schemaBytes, _ := json.Marshal(tool.InputSchema)
		json.Unmarshal(schemaBytes, &parameters)

		openaiTools[i] = openai.Tool{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        tool.Name,
				Description: tool.Description,
				Parameters:  parameters,
			},
		}
	}

	return openaiTools
}
