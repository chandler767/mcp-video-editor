package multitake

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Project represents a multi-take project
type Project struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Created     time.Time         `json:"created"`
	Modified    time.Time         `json:"modified"`
	Script      string            `json:"script"`
	Sections    []ScriptSection   `json:"sections"`
	Takes       []Take            `json:"takes"`
	BestTakes   []BestTake        `json:"bestTakes,omitempty"`
	Directories ProjectDirectories `json:"directories"`
	Status      string            `json:"status"` // setup, analyzing, selecting, complete
}

// ScriptSection represents a section of the script
type ScriptSection struct {
	ID   string `json:"id"`
	Text string `json:"text"`
	Line int    `json:"line"`
}

// Take represents a single video take
type Take struct {
	ID          string     `json:"id"`
	FilePath    string     `json:"filePath"`
	FileName    string     `json:"fileName"`
	Analyzed    bool       `json:"analyzed"`
	Score       float64    `json:"score"`       // 0-100
	Issues      []string   `json:"issues"`
	Transcript  *string    `json:"transcript,omitempty"`
	AnalyzedAt  *time.Time `json:"analyzedAt,omitempty"`
}

// BestTake represents the best take for a script section
type BestTake struct {
	SectionID string  `json:"sectionId"`
	TakeID    string  `json:"takeId"`
	FilePath  string  `json:"filePath"`
	Score     float64 `json:"score"`
	Reason    string  `json:"reason"`
}

// ProjectDirectories holds the directory structure
type ProjectDirectories struct {
	Root     string `json:"root"`
	Source   string `json:"source"`
	Temp     string `json:"temp"`
	Output   string `json:"output"`
	Analysis string `json:"analysis"`
}

// Manager handles multi-take projects
type Manager struct {
	baseDir string
}

// NewManager creates a new multi-take manager
func NewManager(baseDir string) *Manager {
	if baseDir == "" {
		baseDir, _ = os.Getwd()
		baseDir = filepath.Join(baseDir, ".mcp-multi-take-projects")
	}
	return &Manager{baseDir: baseDir}
}

// Initialize creates the projects directory
func (m *Manager) Initialize() error {
	return os.MkdirAll(m.baseDir, 0755)
}

// CreateProject creates a new multi-take project
func (m *Manager) CreateProject(name string, script string, projectRoot *string) (*Project, error) {
	if err := m.Initialize(); err != nil {
		return nil, err
	}

	// Parse script into sections (simple line-based parsing)
	sections := parseScript(script)

	projectID := uuid.New().String()

	// Determine project root
	root := ""
	if projectRoot != nil {
		root = *projectRoot
	} else {
		sanitizedName := strings.Map(func(r rune) rune {
			if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
				return r
			}
			return '_'
		}, name)
		cwd, _ := os.Getwd()
		root = filepath.Join(cwd, sanitizedName)
	}

	// Initialize workspace
	dirs := ProjectDirectories{
		Root:     root,
		Source:   filepath.Join(root, "source"),
		Temp:     filepath.Join(root, "temp"),
		Output:   filepath.Join(root, "output"),
		Analysis: filepath.Join(root, "analysis"),
	}

	// Create directories
	for _, dir := range []string{dirs.Source, dirs.Temp, dirs.Output, dirs.Analysis} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}

	project := &Project{
		ID:          projectID,
		Name:        name,
		Created:     time.Now(),
		Modified:    time.Now(),
		Script:      script,
		Sections:    sections,
		Takes:       []Take{},
		BestTakes:   []BestTake{},
		Directories: dirs,
		Status:      "setup",
	}

	if err := m.SaveProject(project); err != nil {
		return nil, err
	}

	return project, nil
}

// LoadProject loads a project from disk
func (m *Manager) LoadProject(projectID string) (*Project, error) {
	projectPath := filepath.Join(m.baseDir, projectID+".json")

	data, err := os.ReadFile(projectPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("project not found: %s", projectID)
		}
		return nil, fmt.Errorf("failed to load project: %w", err)
	}

	var project Project
	if err := json.Unmarshal(data, &project); err != nil {
		return nil, fmt.Errorf("failed to parse project: %w", err)
	}

	return &project, nil
}

// SaveProject saves a project to disk
func (m *Manager) SaveProject(project *Project) error {
	if err := m.Initialize(); err != nil {
		return err
	}

	project.Modified = time.Now()
	projectPath := filepath.Join(m.baseDir, project.ID+".json")

	data, err := json.MarshalIndent(project, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal project: %w", err)
	}

	return os.WriteFile(projectPath, data, 0644)
}

// AddTakes adds video files to the project
func (m *Manager) AddTakes(project *Project, sourceFiles []string, copyFiles bool) (int, error) {
	added := 0

	for _, sourcePath := range sourceFiles {
		// Validate file exists
		if _, err := os.Stat(sourcePath); err != nil {
			return added, fmt.Errorf("file not found: %s", sourcePath)
		}

		// Generate take ID
		takeID := uuid.New().String()
		fileName := filepath.Base(sourcePath)

		// Determine destination
		destPath := filepath.Join(project.Directories.Source, fileName)

		// Copy or reference file
		if copyFiles {
			// Copy file to source directory
			input, err := os.ReadFile(sourcePath)
			if err != nil {
				return added, fmt.Errorf("failed to read source file: %w", err)
			}
			if err := os.WriteFile(destPath, input, 0644); err != nil {
				return added, fmt.Errorf("failed to write destination file: %w", err)
			}
		} else {
			// Just reference the original file
			destPath = sourcePath
		}

		// Add take to project
		take := Take{
			ID:       takeID,
			FilePath: destPath,
			FileName: fileName,
			Analyzed: false,
			Score:    0,
			Issues:   []string{},
		}

		project.Takes = append(project.Takes, take)
		added++
	}

	if err := m.SaveProject(project); err != nil {
		return added, err
	}

	return added, nil
}

// AnalyzeTakes performs basic analysis on takes (simplified)
func (m *Manager) AnalyzeTakes(project *Project) error {
	project.Status = "analyzing"

	for i := range project.Takes {
		take := &project.Takes[i]

		// Check if file exists
		if _, err := os.Stat(take.FilePath); err != nil {
			take.Issues = append(take.Issues, "File not accessible")
			take.Score = 0
		} else {
			// Simplified scoring (in real implementation, would analyze quality, transcript matching, etc.)
			take.Score = 75.0 // Default score
			take.Issues = []string{}
		}

		take.Analyzed = true
		now := time.Now()
		take.AnalyzedAt = &now
	}

	project.Status = "analyzed"
	return m.SaveProject(project)
}

// SelectBestTakes selects the best take for each script section (simplified)
func (m *Manager) SelectBestTakes(project *Project) error {
	project.Status = "selecting"
	project.BestTakes = []BestTake{}

	// Simple selection: pick the take with highest score for each section
	for _, section := range project.Sections {
		var bestTake *Take
		bestScore := 0.0

		for i := range project.Takes {
			take := &project.Takes[i]
			if take.Analyzed && take.Score > bestScore {
				bestScore = take.Score
				bestTake = take
			}
		}

		if bestTake != nil {
			project.BestTakes = append(project.BestTakes, BestTake{
				SectionID: section.ID,
				TakeID:    bestTake.ID,
				FilePath:  bestTake.FilePath,
				Score:     bestTake.Score,
				Reason:    fmt.Sprintf("Highest score: %.1f", bestTake.Score),
			})
		}
	}

	project.Status = "selected"
	return m.SaveProject(project)
}

// AssembleFinal assembles the final video from best takes (placeholder)
func (m *Manager) AssembleFinal(project *Project, outputPath string) error {
	if len(project.BestTakes) == 0 {
		return fmt.Errorf("no best takes selected")
	}

	// In a full implementation, this would:
	// 1. Extract segments from each best take
	// 2. Apply transitions between segments
	// 3. Concatenate into final video
	// 4. Export to output path

	project.Status = "complete"
	return m.SaveProject(project)
}

// ListProjects lists all projects
func (m *Manager) ListProjects() ([]ProjectSummary, error) {
	if err := m.Initialize(); err != nil {
		return nil, err
	}

	files, err := os.ReadDir(m.baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []ProjectSummary{}, nil
		}
		return nil, fmt.Errorf("failed to list projects: %w", err)
	}

	var summaries []ProjectSummary

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".json") {
			continue
		}

		projectID := strings.TrimSuffix(file.Name(), ".json")
		project, err := m.LoadProject(projectID)
		if err != nil {
			continue
		}

		summaries = append(summaries, ProjectSummary{
			ID:        project.ID,
			Name:      project.Name,
			Created:   project.Created,
			Modified:  project.Modified,
			TakeCount: len(project.Takes),
			Status:    project.Status,
		})
	}

	return summaries, nil
}

// DeleteProject deletes a project
func (m *Manager) DeleteProject(projectID string) error {
	projectPath := filepath.Join(m.baseDir, projectID+".json")
	if err := os.Remove(projectPath); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("project not found: %s", projectID)
		}
		return fmt.Errorf("failed to delete project: %w", err)
	}
	return nil
}

// CleanupTemp cleans up temporary files for a project
func (m *Manager) CleanupTemp(project *Project) (int, error) {
	tempDir := project.Directories.Temp
	files, err := os.ReadDir(tempDir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}

	deleted := 0
	for _, file := range files {
		if !file.IsDir() {
			filePath := filepath.Join(tempDir, file.Name())
			if err := os.Remove(filePath); err == nil {
				deleted++
			}
		}
	}

	return deleted, nil
}

// ProjectSummary represents a project summary
type ProjectSummary struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Created   time.Time `json:"created"`
	Modified  time.Time `json:"modified"`
	TakeCount int       `json:"takeCount"`
	Status    string    `json:"status"`
}

// parseScript parses a script into sections (simple implementation)
func parseScript(script string) []ScriptSection {
	lines := strings.Split(script, "\n")
	var sections []ScriptSection

	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		sections = append(sections, ScriptSection{
			ID:   uuid.New().String(),
			Text: line,
			Line: i + 1,
		})
	}

	return sections
}
