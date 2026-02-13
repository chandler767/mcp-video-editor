package vision

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
	"github.com/chandler-mayo/mcp-video-editor/pkg/video"
	openai "github.com/sashabaranov/go-openai"
)

// FrameAnalysis represents analysis of a single frame
type FrameAnalysis struct {
	Timestamp       float64  `json:"timestamp"`
	FrameNumber     int      `json:"frameNumber"`
	ImagePath       string   `json:"imagePath"`
	Description     string   `json:"description"`
	DetectedObjects []string `json:"detectedObjects,omitempty"`
	DetectedText    []string `json:"detectedText,omitempty"`
	SceneType       string   `json:"sceneType,omitempty"`
	Confidence      float64  `json:"confidence,omitempty"`
}

// VideoSceneAnalysis represents complete video analysis
type VideoSceneAnalysis struct {
	VideoPath string          `json:"videoPath"`
	Duration  float64         `json:"duration"`
	Frames    []FrameAnalysis `json:"frames"`
	Summary   string          `json:"summary"`
}

// VisualSearchMatch represents a search match
type VisualSearchMatch struct {
	Timestamp   float64 `json:"timestamp"`
	FrameNumber int     `json:"frameNumber"`
	Description string  `json:"description"`
	Confidence  float64 `json:"confidence"`
}

// VisualSearchResult represents search results
type VisualSearchResult struct {
	Found   bool                `json:"found"`
	Matches []VisualSearchMatch `json:"matches"`
}

// Analyzer handles video vision analysis
type Analyzer struct {
	client   *openai.Client
	videoOps *video.Operations
	ffmpeg   *ffmpeg.Manager
	tempDir  string
}

// NewAnalyzer creates a new vision analyzer
func NewAnalyzer(apiKey string, videoOps *video.Operations, ffmpegMgr *ffmpeg.Manager) *Analyzer {
	var client *openai.Client
	if apiKey != "" {
		client = openai.NewClient(apiKey)
	}

	tempDir := filepath.Join(os.TempDir(), ".mcp-video-vision-temp")
	os.MkdirAll(tempDir, 0755)

	return &Analyzer{
		client:   client,
		videoOps: videoOps,
		ffmpeg:   ffmpegMgr,
		tempDir:  tempDir,
	}
}

// AnalyzeFrame analyzes a single frame with GPT-4 Vision
func (a *Analyzer) AnalyzeFrame(ctx context.Context, imagePath string, prompt string) (string, error) {
	if a.client == nil {
		return "", fmt.Errorf("OpenAI API key not configured")
	}

	// Read image and encode to base64
	imageData, err := os.ReadFile(imagePath)
	if err != nil {
		return "", fmt.Errorf("failed to read image: %w", err)
	}

	base64Image := base64.StdEncoding.EncodeToString(imageData)
	imageURL := fmt.Sprintf("data:image/jpeg;base64,%s", base64Image)

	// Default prompt if not provided
	if prompt == "" {
		prompt = "Describe what you see in this video frame in detail. Include any visible objects, people, text, actions, and the overall scene."
	}

	// Call GPT-4 Vision API
	resp, err := a.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: openai.GPT4o,
		Messages: []openai.ChatCompletionMessage{
			{
				Role: openai.ChatMessageRoleUser,
				MultiContent: []openai.ChatMessagePart{
					{
						Type: openai.ChatMessagePartTypeText,
						Text: prompt,
					},
					{
						Type: openai.ChatMessagePartTypeImageURL,
						ImageURL: &openai.ChatMessageImageURL{
							URL: imageURL,
						},
					},
				},
			},
		},
		MaxTokens: 500,
	})

	if err != nil {
		return "", fmt.Errorf("failed to analyze frame: %w", err)
	}

	if len(resp.Choices) == 0 {
		return "No description available", nil
	}

	return resp.Choices[0].Message.Content, nil
}

// extractFrameAtTimestamp extracts a single frame at a specific timestamp
func (a *Analyzer) extractFrameAtTimestamp(ctx context.Context, videoPath string, timestamp float64, outputPath string) error {
	args := []string{
		"-ss", fmt.Sprintf("%.3f", timestamp),
		"-i", videoPath,
		"-frames:v", "1",
		"-q:v", "2",
		"-y",
		outputPath,
	}
	return a.ffmpeg.Execute(ctx, args...)
}

// AnalyzeVideo analyzes multiple frames from a video
func (a *Analyzer) AnalyzeVideo(ctx context.Context, videoPath string, interval float64, count *int) (*VideoSceneAnalysis, error) {
	if a.client == nil {
		return nil, fmt.Errorf("OpenAI API key not configured")
	}

	// Get video info
	info, err := a.videoOps.GetVideoInfo(ctx, videoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to get video info: %w", err)
	}

	// Calculate timestamps
	var timestamps []float64
	if count != nil {
		// Extract N evenly-spaced frames
		frameInterval := info.Duration / float64(*count+1)
		for i := 1; i <= *count; i++ {
			timestamps = append(timestamps, float64(i)*frameInterval)
		}
	} else {
		// Extract at regular intervals (default: every 5 seconds)
		if interval == 0 {
			interval = 5.0
		}
		for t := 0.0; t < info.Duration; t += interval {
			timestamps = append(timestamps, t)
		}
	}

	// Extract and analyze each frame
	var frames []FrameAnalysis
	for i, timestamp := range timestamps {
		framePath := filepath.Join(a.tempDir, fmt.Sprintf("frame-%d.jpg", i+1))

		// Extract frame at specific timestamp
		if err := a.extractFrameAtTimestamp(ctx, videoPath, timestamp, framePath); err != nil {
			return nil, fmt.Errorf("failed to extract frame %d: %w", i, err)
		}

		description, err := a.AnalyzeFrame(ctx, framePath, "")
		if err != nil {
			return nil, fmt.Errorf("failed to analyze frame %d: %w", i, err)
		}

		frames = append(frames, FrameAnalysis{
			Timestamp:   timestamp,
			FrameNumber: i,
			ImagePath:   framePath,
			Description: description,
		})
	}

	// Generate summary
	summary, err := a.generateSummary(ctx, frames)
	if err != nil {
		summary = "Summary unavailable"
	}

	return &VideoSceneAnalysis{
		VideoPath: videoPath,
		Duration:  info.Duration,
		Frames:    frames,
		Summary:   summary,
	}, nil
}

// SearchVisualContent searches for specific content in video
func (a *Analyzer) SearchVisualContent(ctx context.Context, videoPath string, query string, interval float64) (*VisualSearchResult, error) {
	if a.client == nil {
		return nil, fmt.Errorf("OpenAI API key not configured")
	}

	// Get video info
	info, err := a.videoOps.GetVideoInfo(ctx, videoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to get video info: %w", err)
	}

	// Calculate timestamps
	if interval == 0 {
		interval = 5.0
	}
	var timestamps []float64
	for t := 0.0; t < info.Duration; t += interval {
		timestamps = append(timestamps, t)
	}

	// Search each frame
	searchPrompt := fmt.Sprintf(`Does this frame contain or show: %s?

Respond in this exact JSON format:
{
  "found": true/false,
  "confidence": 0-100,
  "description": "brief description of what matches or why it doesn't match"
}`, query)

	var matches []VisualSearchMatch
	for i, timestamp := range timestamps {
		framePath := filepath.Join(a.tempDir, fmt.Sprintf("search-frame-%d.jpg", i+1))

		// Extract frame at specific timestamp
		if err := a.extractFrameAtTimestamp(ctx, videoPath, timestamp, framePath); err != nil {
			continue
		}

		response, err := a.AnalyzeFrame(ctx, framePath, searchPrompt)
		if err != nil {
			continue
		}

		// Parse JSON response
		var result struct {
			Found       bool    `json:"found"`
			Confidence  float64 `json:"confidence"`
			Description string  `json:"description"`
		}

		if err := json.Unmarshal([]byte(response), &result); err != nil {
			// Try to extract JSON from response
			start := -1
			end := -1
			for j, c := range response {
				if c == '{' && start == -1 {
					start = j
				}
				if c == '}' {
					end = j + 1
				}
			}
			if start != -1 && end != -1 {
				jsonStr := response[start:end]
				if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
					continue
				}
			} else {
				continue
			}
		}

		if result.Found {
			matches = append(matches, VisualSearchMatch{
				Timestamp:   timestamp,
				FrameNumber: i,
				Description: result.Description,
				Confidence:  result.Confidence / 100.0,
			})
		}
	}

	return &VisualSearchResult{
		Found:   len(matches) > 0,
		Matches: matches,
	}, nil
}

// CompareFrames compares two video frames
func (a *Analyzer) CompareFrames(ctx context.Context, videoPath string, timestamp1, timestamp2 float64) (string, error) {
	if a.client == nil {
		return "", fmt.Errorf("OpenAI API key not configured")
	}

	// Extract both frames
	frame1Path := filepath.Join(a.tempDir, "compare-frame-1.jpg")
	frame2Path := filepath.Join(a.tempDir, "compare-frame-2.jpg")

	if err := a.extractFrameAtTimestamp(ctx, videoPath, timestamp1, frame1Path); err != nil {
		return "", fmt.Errorf("failed to extract first frame: %w", err)
	}
	if err := a.extractFrameAtTimestamp(ctx, videoPath, timestamp2, frame2Path); err != nil {
		return "", fmt.Errorf("failed to extract second frame: %w", err)
	}

	// Read and encode both images
	imageData1, err := os.ReadFile(frame1Path)
	if err != nil {
		return "", fmt.Errorf("failed to read first frame: %w", err)
	}
	imageData2, err := os.ReadFile(frame2Path)
	if err != nil {
		return "", fmt.Errorf("failed to read second frame: %w", err)
	}

	base64Image1 := base64.StdEncoding.EncodeToString(imageData1)
	base64Image2 := base64.StdEncoding.EncodeToString(imageData2)

	// Compare frames using GPT-4 Vision
	prompt := "Compare these two video frames. Describe the differences, similarities, and any notable changes between them."

	resp, err := a.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: openai.GPT4o,
		Messages: []openai.ChatCompletionMessage{
			{
				Role: openai.ChatMessageRoleUser,
				MultiContent: []openai.ChatMessagePart{
					{
						Type: openai.ChatMessagePartTypeText,
						Text: prompt,
					},
					{
						Type: openai.ChatMessagePartTypeImageURL,
						ImageURL: &openai.ChatMessageImageURL{
							URL: fmt.Sprintf("data:image/jpeg;base64,%s", base64Image1),
						},
					},
					{
						Type: openai.ChatMessagePartTypeImageURL,
						ImageURL: &openai.ChatMessageImageURL{
							URL: fmt.Sprintf("data:image/jpeg;base64,%s", base64Image2),
						},
					},
				},
			},
		},
		MaxTokens: 500,
	})

	if err != nil {
		return "", fmt.Errorf("failed to compare frames: %w", err)
	}

	if len(resp.Choices) == 0 {
		return "No comparison available", nil
	}

	return resp.Choices[0].Message.Content, nil
}

// generateSummary generates an overall summary from frame analyses
func (a *Analyzer) generateSummary(ctx context.Context, frames []FrameAnalysis) (string, error) {
	if len(frames) == 0 {
		return "No frames analyzed", nil
	}

	// Collect all descriptions
	var descriptions []string
	for _, frame := range frames {
		descriptions = append(descriptions, fmt.Sprintf("Frame at %.1fs: %s", frame.Timestamp, frame.Description))
	}

	prompt := fmt.Sprintf("Based on these video frame descriptions, provide a brief overall summary of the video content:\n\n%s",
		string(descriptions[0]))
	if len(descriptions) > 1 {
		for _, desc := range descriptions[1:] {
			prompt += "\n" + desc
		}
	}

	resp, err := a.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: openai.GPT4o,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleUser,
				Content: prompt,
			},
		},
		MaxTokens: 300,
	})

	if err != nil {
		return "", err
	}

	if len(resp.Choices) == 0 {
		return "No summary available", nil
	}

	return resp.Choices[0].Message.Content, nil
}

// Cleanup removes temporary files
func (a *Analyzer) Cleanup() error {
	return os.RemoveAll(a.tempDir)
}
