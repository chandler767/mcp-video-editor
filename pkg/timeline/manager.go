package timeline

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Operation represents a single operation in the timeline
type Operation struct {
	ID          string                 `json:"id"`
	Timestamp   time.Time              `json:"timestamp"`
	Operation   string                 `json:"operation"`
	Description string                 `json:"description"`
	Input       interface{}            `json:"input"` // string or []string
	Output      string                 `json:"output"`
	Parameters  map[string]interface{} `json:"parameters"`
	Duration    *int64                 `json:"duration,omitempty"`    // milliseconds
	Status      string                 `json:"status"`                // pending, completed, failed
	Error       *string                `json:"error,omitempty"`
}

// Timeline represents a video editing timeline with undo/redo capabilities
type Timeline struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	Created      time.Time   `json:"created"`
	Modified     time.Time   `json:"modified"`
	CurrentIndex int         `json:"currentIndex"` // -1 = before first operation
	Operations   []Operation `json:"operations"`
	BaseFile     *string     `json:"baseFile,omitempty"` // Original file
}

// TimelineSummary represents a summary of a timeline
type TimelineSummary struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Created        time.Time `json:"created"`
	Modified       time.Time `json:"modified"`
	OperationCount int       `json:"operationCount"`
	CurrentIndex   int       `json:"currentIndex"`
}

// Manager handles timeline operations
type Manager struct {
	timelinesDir string
}

// NewManager creates a new timeline manager
func NewManager(baseDir string) *Manager {
	if baseDir == "" {
		baseDir, _ = os.Getwd()
	}
	return &Manager{
		timelinesDir: filepath.Join(baseDir, ".mcp-video-timelines"),
	}
}

// Initialize creates the timelines directory
func (m *Manager) Initialize() error {
	return os.MkdirAll(m.timelinesDir, 0755)
}

// CreateTimeline creates a new timeline
func (m *Manager) CreateTimeline(name string, baseFile *string) (*Timeline, error) {
	if err := m.Initialize(); err != nil {
		return nil, err
	}

	timeline := &Timeline{
		ID:           uuid.New().String(),
		Name:         name,
		Created:      time.Now(),
		Modified:     time.Now(),
		CurrentIndex: -1,
		Operations:   []Operation{},
		BaseFile:     baseFile,
	}

	if err := m.SaveTimeline(timeline); err != nil {
		return nil, err
	}

	return timeline, nil
}

// LoadTimeline loads a timeline from disk
func (m *Manager) LoadTimeline(timelineID string) (*Timeline, error) {
	timelinePath := filepath.Join(m.timelinesDir, timelineID+".json")

	data, err := os.ReadFile(timelinePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("timeline not found: %s", timelineID)
		}
		return nil, fmt.Errorf("failed to load timeline: %w", err)
	}

	var timeline Timeline
	if err := json.Unmarshal(data, &timeline); err != nil {
		return nil, fmt.Errorf("failed to parse timeline: %w", err)
	}

	return &timeline, nil
}

// SaveTimeline saves a timeline to disk
func (m *Manager) SaveTimeline(timeline *Timeline) error {
	if err := m.Initialize(); err != nil {
		return err
	}

	timeline.Modified = time.Now()
	timelinePath := filepath.Join(m.timelinesDir, timeline.ID+".json")

	data, err := json.MarshalIndent(timeline, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal timeline: %w", err)
	}

	return os.WriteFile(timelinePath, data, 0644)
}

// AddOperation adds an operation to the timeline
func (m *Manager) AddOperation(
	timelineID string,
	operation string,
	description string,
	input interface{},
	output string,
	parameters map[string]interface{},
	duration *int64,
) (*Timeline, error) {
	timeline, err := m.LoadTimeline(timelineID)
	if err != nil {
		return nil, err
	}

	// If not at end of timeline, remove operations after current position
	if timeline.CurrentIndex < len(timeline.Operations)-1 {
		timeline.Operations = timeline.Operations[:timeline.CurrentIndex+1]
	}

	op := Operation{
		ID:          uuid.New().String(),
		Timestamp:   time.Now(),
		Operation:   operation,
		Description: description,
		Input:       input,
		Output:      output,
		Parameters:  parameters,
		Duration:    duration,
		Status:      "completed",
	}

	timeline.Operations = append(timeline.Operations, op)
	timeline.CurrentIndex = len(timeline.Operations) - 1

	if err := m.SaveTimeline(timeline); err != nil {
		return nil, err
	}

	return timeline, nil
}

// Undo moves back one operation in the timeline
func (m *Manager) Undo(timelineID string) (*Timeline, *string, error) {
	timeline, err := m.LoadTimeline(timelineID)
	if err != nil {
		return nil, nil, err
	}

	if timeline.CurrentIndex < 0 {
		return timeline, timeline.BaseFile, nil
	}

	timeline.CurrentIndex--

	if err := m.SaveTimeline(timeline); err != nil {
		return nil, nil, err
	}

	var previousOutput *string
	if timeline.CurrentIndex >= 0 {
		previousOutput = &timeline.Operations[timeline.CurrentIndex].Output
	} else {
		previousOutput = timeline.BaseFile
	}

	return timeline, previousOutput, nil
}

// Redo moves forward one operation in the timeline
func (m *Manager) Redo(timelineID string) (*Timeline, *string, error) {
	timeline, err := m.LoadTimeline(timelineID)
	if err != nil {
		return nil, nil, err
	}

	if timeline.CurrentIndex >= len(timeline.Operations)-1 {
		return timeline, nil, nil
	}

	timeline.CurrentIndex++

	if err := m.SaveTimeline(timeline); err != nil {
		return nil, nil, err
	}

	nextOutput := &timeline.Operations[timeline.CurrentIndex].Output

	return timeline, nextOutput, nil
}

// JumpTo jumps to a specific point in the timeline
func (m *Manager) JumpTo(timelineID string, index int) (*Timeline, *string, error) {
	timeline, err := m.LoadTimeline(timelineID)
	if err != nil {
		return nil, nil, err
	}

	if index < -1 || index >= len(timeline.Operations) {
		return nil, nil, fmt.Errorf("invalid timeline index: %d", index)
	}

	timeline.CurrentIndex = index

	if err := m.SaveTimeline(timeline); err != nil {
		return nil, nil, err
	}

	var output *string
	if index >= 0 {
		output = &timeline.Operations[index].Output
	} else {
		output = timeline.BaseFile
	}

	return timeline, output, nil
}

// GetCurrentState returns the current state of the timeline
func (m *Manager) GetCurrentState(timelineID string) (*Timeline, *string, bool, bool, error) {
	timeline, err := m.LoadTimeline(timelineID)
	if err != nil {
		return nil, nil, false, false, err
	}

	var currentOutput *string
	if timeline.CurrentIndex >= 0 {
		currentOutput = &timeline.Operations[timeline.CurrentIndex].Output
	} else {
		currentOutput = timeline.BaseFile
	}

	canUndo := timeline.CurrentIndex >= 0
	canRedo := timeline.CurrentIndex < len(timeline.Operations)-1

	return timeline, currentOutput, canUndo, canRedo, nil
}

// ListTimelines lists all timelines
func (m *Manager) ListTimelines() ([]TimelineSummary, error) {
	if err := m.Initialize(); err != nil {
		return nil, err
	}

	files, err := os.ReadDir(m.timelinesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []TimelineSummary{}, nil
		}
		return nil, fmt.Errorf("failed to list timelines: %w", err)
	}

	var summaries []TimelineSummary

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".json") {
			continue
		}

		timelineID := strings.TrimSuffix(file.Name(), ".json")
		timeline, err := m.LoadTimeline(timelineID)
		if err != nil {
			continue // Skip invalid timelines
		}

		summaries = append(summaries, TimelineSummary{
			ID:             timeline.ID,
			Name:           timeline.Name,
			Created:        timeline.Created,
			Modified:       timeline.Modified,
			OperationCount: len(timeline.Operations),
			CurrentIndex:   timeline.CurrentIndex,
		})
	}

	// Sort by modified date (most recent first)
	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].Modified.After(summaries[j].Modified)
	})

	return summaries, nil
}

// DeleteTimeline deletes a timeline
func (m *Manager) DeleteTimeline(timelineID string) error {
	timelinePath := filepath.Join(m.timelinesDir, timelineID+".json")

	if err := os.Remove(timelinePath); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("timeline not found: %s", timelineID)
		}
		return fmt.Errorf("failed to delete timeline: %w", err)
	}

	return nil
}

// GetHistory returns the timeline history as a formatted string
func (m *Manager) GetHistory(timelineID string) (string, error) {
	timeline, err := m.LoadTimeline(timelineID)
	if err != nil {
		return "", err
	}

	var lines []string
	lines = append(lines,
		fmt.Sprintf("Timeline: %s (%s)", timeline.Name, timeline.ID),
		fmt.Sprintf("Created: %s", timeline.Created.Format(time.RFC1123)),
		fmt.Sprintf("Modified: %s", timeline.Modified.Format(time.RFC1123)),
		"",
	)

	if timeline.BaseFile != nil {
		lines = append(lines, fmt.Sprintf("Base file: %s", *timeline.BaseFile), "")
	}

	lines = append(lines,
		"OPERATIONS:",
		strings.Repeat("=", 80),
	)

	if len(timeline.Operations) == 0 {
		lines = append(lines, "No operations yet")
	} else {
		for i, op := range timeline.Operations {
			isCurrent := i == timeline.CurrentIndex
			marker := " "
			if isCurrent {
				marker = "▶"
			}

			status := "✓"
			if op.Status == "failed" {
				status = "✗"
			}

			lines = append(lines,
				fmt.Sprintf("%s %d. [%s] %s - %s", marker, i+1, status, op.Operation, op.Description),
				fmt.Sprintf("     Time: %s", op.Timestamp.Format(time.RFC1123)),
			)

			// Format input
			switch v := op.Input.(type) {
			case string:
				lines = append(lines, fmt.Sprintf("     Input: %s", v))
			case []interface{}:
				inputs := make([]string, len(v))
				for j, input := range v {
					inputs[j] = fmt.Sprintf("%v", input)
				}
				lines = append(lines, fmt.Sprintf("     Input: %s", strings.Join(inputs, ", ")))
			default:
				lines = append(lines, fmt.Sprintf("     Input: %v", v))
			}

			lines = append(lines, fmt.Sprintf("     Output: %s", op.Output))

			if op.Duration != nil {
				lines = append(lines, fmt.Sprintf("     Duration: %.2fs", float64(*op.Duration)/1000.0))
			}

			if op.Error != nil {
				lines = append(lines, fmt.Sprintf("     Error: %s", *op.Error))
			}

			lines = append(lines, "")
		}
	}

	lines = append(lines,
		"",
		fmt.Sprintf("Current position: %d/%d", timeline.CurrentIndex+1, len(timeline.Operations)),
		fmt.Sprintf("Can undo: %t", timeline.CurrentIndex >= 0),
		fmt.Sprintf("Can redo: %t", timeline.CurrentIndex < len(timeline.Operations)-1),
	)

	return strings.Join(lines, "\n"), nil
}

// ClearTimeline removes all operations from the timeline
func (m *Manager) ClearTimeline(timelineID string, keepBase bool) (*Timeline, error) {
	timeline, err := m.LoadTimeline(timelineID)
	if err != nil {
		return nil, err
	}

	timeline.Operations = []Operation{}
	timeline.CurrentIndex = -1

	if !keepBase {
		timeline.BaseFile = nil
	}

	if err := m.SaveTimeline(timeline); err != nil {
		return nil, err
	}

	return timeline, nil
}

// GetStatistics returns statistics about the timeline
func (m *Manager) GetStatistics(timelineID string) (map[string]interface{}, error) {
	timeline, err := m.LoadTimeline(timelineID)
	if err != nil {
		return nil, err
	}

	stats := map[string]interface{}{
		"totalOperations":     len(timeline.Operations),
		"completedOperations": 0,
		"failedOperations":    0,
		"totalDuration":       int64(0),
		"averageDuration":     float64(0),
		"operationsByType":    make(map[string]int),
	}

	totalDuration := int64(0)
	opsWithDuration := 0
	operationsByType := make(map[string]int)

	for _, op := range timeline.Operations {
		switch op.Status {
		case "completed":
			stats["completedOperations"] = stats["completedOperations"].(int) + 1
		case "failed":
			stats["failedOperations"] = stats["failedOperations"].(int) + 1
		}

		if op.Duration != nil {
			totalDuration += *op.Duration
			opsWithDuration++
		}

		operationsByType[op.Operation]++
	}

	stats["totalDuration"] = totalDuration
	if opsWithDuration > 0 {
		stats["averageDuration"] = float64(totalDuration) / float64(opsWithDuration)
	}
	stats["operationsByType"] = operationsByType

	return stats, nil
}
