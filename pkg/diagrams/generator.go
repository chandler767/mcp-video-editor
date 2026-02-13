package diagrams

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// TimelineEvent represents an event in a timeline
type TimelineEvent struct {
	Label       string
	Date        string
	Description string
}

// TimelineOptions configures timeline generation
type TimelineOptions struct {
	Title       string
	Events      []TimelineEvent
	Orientation string // "horizontal" or "vertical"
	Width       int
	Height      int
	Style       DiagramStyle
}

// FlowchartNode represents a node in a flowchart
type FlowchartNode struct {
	ID          string
	Label       string
	Type        string // "process", "decision", "start", "end", "data"
	Connections []string
}

// FlowchartOptions configures flowchart generation
type FlowchartOptions struct {
	Title  string
	Nodes  []FlowchartNode
	Width  int
	Height int
	Style  DiagramStyle
}

// OrgChartNode represents a node in an organization chart
type OrgChartNode struct {
	ID       string
	Name     string
	Title    string
	Children []OrgChartNode
}

// OrgChartOptions configures org chart generation
type OrgChartOptions struct {
	Title  string
	Root   OrgChartNode
	Width  int
	Height int
	Style  DiagramStyle
}

// MindMapNode represents a node in a mind map
type MindMapNode struct {
	ID       string
	Text     string
	Children []MindMapNode
	Color    string // Optional custom color for this branch
}

// MindMapOptions configures mind map generation
type MindMapOptions struct {
	Title  string
	Root   MindMapNode
	Width  int
	Height int
	Style  DiagramStyle
}

// DiagramStyle defines visual styling
type DiagramStyle struct {
	FontFamily     string
	FontSize       int
	PrimaryColor   string
	SecondaryColor string
	TextColor      string
	BackgroundColor string
	BorderWidth    int
}

// Generator handles diagram generation
type Generator struct {
	tempDir string
}

// NewGenerator creates a new diagram generator
func NewGenerator() *Generator {
	tempDir := filepath.Join(os.TempDir(), ".mcp-diagram-temp")
	os.MkdirAll(tempDir, 0755)
	return &Generator{tempDir: tempDir}
}

// DefaultStyle returns default styling
func DefaultStyle() DiagramStyle {
	return DiagramStyle{
		FontFamily:      "Arial, sans-serif",
		FontSize:        14,
		PrimaryColor:    "#4A90E2",
		SecondaryColor:  "#7ED321",
		TextColor:       "#333333",
		BackgroundColor: "#FFFFFF",
		BorderWidth:     2,
	}
}

// GenerateTimeline creates a timeline diagram
func (g *Generator) GenerateTimeline(ctx context.Context, options TimelineOptions, outputPath string) error {
	if options.Width == 0 {
		options.Width = 1200
	}
	if options.Height == 0 {
		options.Height = 600
	}
	if options.Orientation == "" {
		options.Orientation = "horizontal"
	}
	if options.Style.FontFamily == "" {
		options.Style = DefaultStyle()
	}

	svg := g.generateTimelineSVG(options)
	return g.saveSVGAsPNG(ctx, svg, outputPath, options.Width, options.Height)
}

// GenerateFlowchart creates a flowchart diagram
func (g *Generator) GenerateFlowchart(ctx context.Context, options FlowchartOptions, outputPath string) error {
	if options.Width == 0 {
		options.Width = 1200
	}
	if options.Height == 0 {
		options.Height = 800
	}
	if options.Style.FontFamily == "" {
		options.Style = DefaultStyle()
	}

	svg := g.generateFlowchartSVG(options)
	return g.saveSVGAsPNG(ctx, svg, outputPath, options.Width, options.Height)
}

// GenerateOrgChart creates an organization chart
func (g *Generator) GenerateOrgChart(ctx context.Context, options OrgChartOptions, outputPath string) error {
	if options.Width == 0 {
		options.Width = 1200
	}
	if options.Height == 0 {
		options.Height = 800
	}
	if options.Style.FontFamily == "" {
		options.Style = DefaultStyle()
	}

	svg := g.generateOrgChartSVG(options)
	return g.saveSVGAsPNG(ctx, svg, outputPath, options.Width, options.Height)
}

// GenerateMindMap creates a mind map diagram
func (g *Generator) GenerateMindMap(ctx context.Context, options MindMapOptions, outputPath string) error {
	if options.Width == 0 {
		options.Width = 1200
	}
	if options.Height == 0 {
		options.Height = 800
	}
	if options.Style.FontFamily == "" {
		options.Style = DefaultStyle()
	}

	svg := g.generateMindMapSVG(options)
	return g.saveSVGAsPNG(ctx, svg, outputPath, options.Width, options.Height)
}

// generateTimelineSVG creates SVG markup for a timeline
func (g *Generator) generateTimelineSVG(options TimelineOptions) string {
	var buf bytes.Buffer

	buf.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">`,
		options.Width, options.Height, options.Width, options.Height))
	buf.WriteString(fmt.Sprintf(`<rect width="100%%" height="100%%" fill="%s"/>`, options.Style.BackgroundColor))

	// Title
	if options.Title != "" {
		buf.WriteString(fmt.Sprintf(`<text x="%d" y="40" font-family="%s" font-size="%d" font-weight="bold" fill="%s" text-anchor="middle">%s</text>`,
			options.Width/2, options.Style.FontFamily, options.Style.FontSize+6, options.Style.TextColor, options.Title))
	}

	if options.Orientation == "horizontal" {
		g.drawHorizontalTimeline(&buf, options)
	} else {
		g.drawVerticalTimeline(&buf, options)
	}

	buf.WriteString("</svg>")
	return buf.String()
}

func (g *Generator) drawHorizontalTimeline(buf *bytes.Buffer, options TimelineOptions) {
	if len(options.Events) == 0 {
		return
	}

	lineY := options.Height / 2
	startX := 100
	endX := options.Width - 100
	spacing := (endX - startX) / (len(options.Events) - 1)
	if len(options.Events) == 1 {
		spacing = 0
	}

	// Draw main line
	buf.WriteString(fmt.Sprintf(`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="%d"/>`,
		startX, lineY, endX, lineY, options.Style.PrimaryColor, options.Style.BorderWidth))

	// Draw events
	for i, event := range options.Events {
		x := startX + (i * spacing)

		// Event circle
		buf.WriteString(fmt.Sprintf(`<circle cx="%d" cy="%d" r="8" fill="%s" stroke="%s" stroke-width="2"/>`,
			x, lineY, options.Style.BackgroundColor, options.Style.PrimaryColor))

		// Date (above line)
		buf.WriteString(fmt.Sprintf(`<text x="%d" y="%d" font-family="%s" font-size="%d" fill="%s" text-anchor="middle" font-weight="bold">%s</text>`,
			x, lineY-25, options.Style.FontFamily, options.Style.FontSize-2, options.Style.TextColor, event.Date))

		// Label (below line)
		buf.WriteString(fmt.Sprintf(`<text x="%d" y="%d" font-family="%s" font-size="%d" fill="%s" text-anchor="middle">%s</text>`,
			x, lineY+30, options.Style.FontFamily, options.Style.FontSize, options.Style.TextColor, event.Label))

		// Description (below label, wrapped)
		if event.Description != "" {
			buf.WriteString(fmt.Sprintf(`<text x="%d" y="%d" font-family="%s" font-size="%d" fill="%s" text-anchor="middle" opacity="0.7">%s</text>`,
				x, lineY+48, options.Style.FontFamily, options.Style.FontSize-3, options.Style.TextColor, truncate(event.Description, 20)))
		}
	}
}

func (g *Generator) drawVerticalTimeline(buf *bytes.Buffer, options TimelineOptions) {
	if len(options.Events) == 0 {
		return
	}

	lineX := 150
	startY := 100
	endY := options.Height - 100
	spacing := (endY - startY) / (len(options.Events) - 1)
	if len(options.Events) == 1 {
		spacing = 0
	}

	// Draw main line
	buf.WriteString(fmt.Sprintf(`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="%d"/>`,
		lineX, startY, lineX, endY, options.Style.PrimaryColor, options.Style.BorderWidth))

	// Draw events
	for i, event := range options.Events {
		y := startY + (i * spacing)
		isLeft := i%2 == 0

		// Event circle
		buf.WriteString(fmt.Sprintf(`<circle cx="%d" cy="%d" r="8" fill="%s" stroke="%s" stroke-width="2"/>`,
			lineX, y, options.Style.BackgroundColor, options.Style.PrimaryColor))

		// Content positioning
		textX := lineX + 30
		anchor := "start"
		if isLeft {
			textX = lineX - 30
			anchor = "end"
		}

		// Date
		buf.WriteString(fmt.Sprintf(`<text x="%d" y="%d" font-family="%s" font-size="%d" fill="%s" text-anchor="%s" font-weight="bold">%s</text>`,
			textX, y-10, options.Style.FontFamily, options.Style.FontSize-2, options.Style.TextColor, anchor, event.Date))

		// Label
		buf.WriteString(fmt.Sprintf(`<text x="%d" y="%d" font-family="%s" font-size="%d" fill="%s" text-anchor="%s">%s</text>`,
			textX, y+8, options.Style.FontFamily, options.Style.FontSize, options.Style.TextColor, anchor, event.Label))

		// Description
		if event.Description != "" {
			buf.WriteString(fmt.Sprintf(`<text x="%d" y="%d" font-family="%s" font-size="%d" fill="%s" text-anchor="%s" opacity="0.7">%s</text>`,
				textX, y+24, options.Style.FontFamily, options.Style.FontSize-3, options.Style.TextColor, anchor, truncate(event.Description, 30)))
		}
	}
}

// generateFlowchartSVG creates SVG markup for a flowchart
func (g *Generator) generateFlowchartSVG(options FlowchartOptions) string {
	var buf bytes.Buffer

	buf.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">`,
		options.Width, options.Height, options.Width, options.Height))
	buf.WriteString(fmt.Sprintf(`<rect width="100%%" height="100%%" fill="%s"/>`, options.Style.BackgroundColor))
	buf.WriteString(`<defs><marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><polygon points="0 0, 10 3, 0 6" fill="#666"/></marker></defs>`)

	// Title
	if options.Title != "" {
		buf.WriteString(fmt.Sprintf(`<text x="%d" y="40" font-family="%s" font-size="%d" font-weight="bold" fill="%s" text-anchor="middle">%s</text>`,
			options.Width/2, options.Style.FontFamily, options.Style.FontSize+6, options.Style.TextColor, options.Title))
	}

	// Calculate node positions (simple vertical layout)
	nodePositions := make(map[string]struct{ x, y int })
	startY := 100
	spacing := 120
	centerX := options.Width / 2

	for i, node := range options.Nodes {
		nodePositions[node.ID] = struct{ x, y int}{centerX, startY + (i * spacing)}
	}

	// Draw connections first (so they appear behind nodes)
	for _, node := range options.Nodes {
		fromPos := nodePositions[node.ID]
		for _, toID := range node.Connections {
			if toPos, ok := nodePositions[toID]; ok {
				buf.WriteString(fmt.Sprintf(`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>`,
					fromPos.x, fromPos.y+30, toPos.x, toPos.y-30))
			}
		}
	}

	// Draw nodes
	for _, node := range options.Nodes {
		pos := nodePositions[node.ID]
		g.drawFlowchartNode(&buf, node, pos.x, pos.y, options.Style)
	}

	buf.WriteString("</svg>")
	return buf.String()
}

func (g *Generator) drawFlowchartNode(buf *bytes.Buffer, node FlowchartNode, x, y int, style DiagramStyle) {
	switch node.Type {
	case "decision":
		// Diamond shape
		buf.WriteString(fmt.Sprintf(`<polygon points="%d,%d %d,%d %d,%d %d,%d" fill="%s" stroke="%s" stroke-width="%d"/>`,
			x, y-40, x+60, y, x, y+40, x-60, y,
			"#FFF", style.PrimaryColor, style.BorderWidth))
	case "start", "end":
		// Rounded rectangle
		buf.WriteString(fmt.Sprintf(`<rect x="%d" y="%d" width="120" height="60" rx="30" ry="30" fill="%s" stroke="%s" stroke-width="%d"/>`,
			x-60, y-30, "#FFF", style.SecondaryColor, style.BorderWidth))
	default:
		// Rectangle (process, data)
		buf.WriteString(fmt.Sprintf(`<rect x="%d" y="%d" width="120" height="60" rx="5" ry="5" fill="%s" stroke="%s" stroke-width="%d"/>`,
			x-60, y-30, "#FFF", style.PrimaryColor, style.BorderWidth))
	}

	// Label (centered, wrapped)
	lines := wrapText(node.Label, 15)
	startY := y - (len(lines)*7 - 7)
	for i, line := range lines {
		buf.WriteString(fmt.Sprintf(`<text x="%d" y="%d" font-family="%s" font-size="%d" fill="%s" text-anchor="middle">%s</text>`,
			x, startY+(i*14), style.FontFamily, style.FontSize-2, style.TextColor, line))
	}
}

// generateOrgChartSVG creates SVG markup for an org chart
func (g *Generator) generateOrgChartSVG(options OrgChartOptions) string {
	var buf bytes.Buffer

	buf.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">`,
		options.Width, options.Height, options.Width, options.Height))
	buf.WriteString(fmt.Sprintf(`<rect width="100%%" height="100%%" fill="%s"/>`, options.Style.BackgroundColor))

	// Title
	if options.Title != "" {
		buf.WriteString(fmt.Sprintf(`<text x="%d" y="40" font-family="%s" font-size="%d" font-weight="bold" fill="%s" text-anchor="middle">%s</text>`,
			options.Width/2, options.Style.FontFamily, options.Style.FontSize+6, options.Style.TextColor, options.Title))
	}

	// Draw org chart tree
	g.drawOrgChartNode(&buf, options.Root, options.Width/2, 100, options.Width, options.Style)

	buf.WriteString("</svg>")
	return buf.String()
}

func (g *Generator) drawOrgChartNode(buf *bytes.Buffer, node OrgChartNode, x, y, availableWidth int, style DiagramStyle) int {
	// Draw current node
	boxWidth := 160
	boxHeight := 70

	buf.WriteString(fmt.Sprintf(`<rect x="%d" y="%d" width="%d" height="%d" rx="5" fill="%s" stroke="%s" stroke-width="%d"/>`,
		x-boxWidth/2, y, boxWidth, boxHeight, "#FFF", style.PrimaryColor, style.BorderWidth))

	// Name (bold)
	buf.WriteString(fmt.Sprintf(`<text x="%d" y="%d" font-family="%s" font-size="%d" font-weight="bold" fill="%s" text-anchor="middle">%s</text>`,
		x, y+25, style.FontFamily, style.FontSize, style.TextColor, truncate(node.Name, 20)))

	// Title
	buf.WriteString(fmt.Sprintf(`<text x="%d" y="%d" font-family="%s" font-size="%d" fill="%s" text-anchor="middle" opacity="0.7">%s</text>`,
		x, y+45, style.FontFamily, style.FontSize-3, style.TextColor, truncate(node.Title, 22)))

	if len(node.Children) == 0 {
		return y + boxHeight
	}

	// Draw children
	childY := y + boxHeight + 60
	childWidth := availableWidth / len(node.Children)

	// Draw connecting lines
	// Vertical line down from parent
	buf.WriteString(fmt.Sprintf(`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="2"/>`,
		x, y+boxHeight, x, y+boxHeight+30, "#999"))

	if len(node.Children) > 1 {
		// Horizontal line across children
		leftmostX := x - (len(node.Children)-1)*childWidth/2
		rightmostX := x + (len(node.Children)-1)*childWidth/2
		buf.WriteString(fmt.Sprintf(`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="2"/>`,
			leftmostX, y+boxHeight+30, rightmostX, y+boxHeight+30, "#999"))
	}

	maxChildBottom := childY
	for i, child := range node.Children {
		childX := x + (i-len(node.Children)/2)*childWidth
		if len(node.Children)%2 == 0 {
			childX += childWidth / 2
		}

		// Vertical line down to child
		buf.WriteString(fmt.Sprintf(`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="2"/>`,
			childX, y+boxHeight+30, childX, childY, "#999"))

		bottom := g.drawOrgChartNode(buf, child, childX, childY, childWidth, style)
		if bottom > maxChildBottom {
			maxChildBottom = bottom
		}
	}

	return maxChildBottom
}

// generateMindMapSVG creates SVG markup for a mind map with radial layout
func (g *Generator) generateMindMapSVG(options MindMapOptions) string {
	var buf bytes.Buffer

	buf.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">`,
		options.Width, options.Height, options.Width, options.Height))
	buf.WriteString(fmt.Sprintf(`<rect width="100%%" height="100%%" fill="%s"/>`, options.Style.BackgroundColor))

	// Title
	if options.Title != "" {
		buf.WriteString(fmt.Sprintf(`<text x="%d" y="40" font-family="%s" font-size="%d" font-weight="bold" fill="%s" text-anchor="middle">%s</text>`,
			options.Width/2, options.Style.FontFamily, options.Style.FontSize+6, options.Style.TextColor, options.Title))
	}

	// Center of the mind map
	centerX := options.Width / 2
	centerY := options.Height / 2

	// Draw the mind map starting from root
	g.drawMindMapNode(&buf, options.Root, centerX, centerY, 0, 360, 0, options.Style, true)

	buf.WriteString("</svg>")
	return buf.String()
}

// drawMindMapNode draws a node and its children in radial layout
func (g *Generator) drawMindMapNode(buf *bytes.Buffer, node MindMapNode, x, y int, startAngle, endAngle float64, level int, style DiagramStyle, isRoot bool) {
	nodeWidth := 140
	nodeHeight := 60

	// Determine color for this branch
	color := style.PrimaryColor
	if node.Color != "" {
		color = node.Color
	} else if level == 1 {
		// Use different colors for first-level branches
		colors := []string{"#4A90E2", "#7ED321", "#F5A623", "#BD10E0", "#50E3C2", "#FF6B6B"}
		branchIndex := int(startAngle / 60) % len(colors)
		color = colors[branchIndex]
	}

	// Draw node
	if isRoot {
		// Root node is larger and centered
		nodeWidth = 180
		nodeHeight = 80
		buf.WriteString(fmt.Sprintf(`<ellipse cx="%d" cy="%d" rx="%d" ry="%d" fill="%s" stroke="%s" stroke-width="3"/>`,
			x, y, nodeWidth/2, nodeHeight/2, "#FFF", color))
	} else {
		// Branch nodes are rounded rectangles
		buf.WriteString(fmt.Sprintf(`<rect x="%d" y="%d" width="%d" height="%d" rx="10" ry="10" fill="%s" stroke="%s" stroke-width="2"/>`,
			x-nodeWidth/2, y-nodeHeight/2, nodeWidth, nodeHeight, "#FFF", color))
	}

	// Node text (wrapped)
	lines := wrapText(node.Text, 18)
	startY := y - (len(lines)*7 - 7)
	for i, line := range lines {
		fontSize := style.FontSize
		if isRoot {
			fontSize += 2
		}
		buf.WriteString(fmt.Sprintf(`<text x="%d" y="%d" font-family="%s" font-size="%d" fill="%s" text-anchor="middle"%s>%s</text>`,
			x, startY+(i*14), style.FontFamily, fontSize, style.TextColor,
			func() string {
				if isRoot {
					return ` font-weight="bold"`
				}
				return ""
			}(), line))
	}

	// Draw children in radial layout
	if len(node.Children) > 0 {
		angleStep := (endAngle - startAngle) / float64(len(node.Children))
		radius := 180 + (level * 40) // Distance from parent increases with level

		for i, child := range node.Children {
			childAngle := startAngle + (float64(i)+0.5)*angleStep

			// Calculate child position
			angleRad := childAngle * 3.14159 / 180.0
			childX := x + int(float64(radius)*cosApprox(angleRad))
			childY := y + int(float64(radius)*sinApprox(angleRad))

			// Draw connection line (curved)
			controlX := (x + childX) / 2
			controlY := (y + childY) / 2
			buf.WriteString(fmt.Sprintf(`<path d="M %d %d Q %d %d %d %d" stroke="%s" stroke-width="2" fill="none"/>`,
				x, y, controlX, controlY, childX, childY, color))

			// Recursively draw child and its descendants
			childStartAngle := startAngle + float64(i)*angleStep
			childEndAngle := startAngle + float64(i+1)*angleStep
			g.drawMindMapNode(buf, child, childX, childY, childStartAngle, childEndAngle, level+1, style, false)
		}
	}
}

// Helper functions for trigonometry (approximate)
func sinApprox(rad float64) float64 {
	// Simple approximation - for production, use math.Sin
	// This is simplified to avoid importing math package
	// Convert to degrees for lookup
	deg := rad * 180.0 / 3.14159
	deg = float64(int(deg) % 360)
	if deg < 0 {
		deg += 360
	}

	// Quadrant-based approximation
	if deg <= 90 {
		return deg / 90.0
	} else if deg <= 180 {
		return (180.0 - deg) / 90.0
	} else if deg <= 270 {
		return -(deg - 180.0) / 90.0
	} else {
		return -(360.0 - deg) / 90.0
	}
}

func cosApprox(rad float64) float64 {
	// cos(x) = sin(x + π/2)
	return sinApprox(rad + 3.14159/2.0)
}

// saveSVGAsPNG converts SVG to PNG using ImageMagick or rsvg-convert
func (g *Generator) saveSVGAsPNG(ctx context.Context, svg string, outputPath string, width, height int) error {
	// Save SVG to temp file
	svgPath := filepath.Join(g.tempDir, "temp-diagram.svg")
	if err := os.WriteFile(svgPath, []byte(svg), 0644); err != nil {
		return fmt.Errorf("failed to write SVG file: %w", err)
	}
	defer os.Remove(svgPath)

	// Try rsvg-convert first (most reliable)
	cmd := exec.CommandContext(ctx, "rsvg-convert", "-w", fmt.Sprintf("%d", width), "-h", fmt.Sprintf("%d", height), "-o", outputPath, svgPath)
	if err := cmd.Run(); err == nil {
		return nil
	}

	// Try ImageMagick convert
	cmd = exec.CommandContext(ctx, "convert", "-background", "white", "-density", "300", svgPath, outputPath)
	if err := cmd.Run(); err == nil {
		return nil
	}

	// Try ImageMagick magick (newer versions)
	cmd = exec.CommandContext(ctx, "magick", "convert", "-background", "white", "-density", "300", svgPath, outputPath)
	if err := cmd.Run(); err == nil {
		return nil
	}

	return fmt.Errorf("failed to convert SVG to PNG: neither rsvg-convert nor ImageMagick are available")
}

// Cleanup removes temporary files
func (g *Generator) Cleanup() error {
	return os.RemoveAll(g.tempDir)
}

// Helper functions

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func wrapText(text string, maxLen int) []string {
	if len(text) <= maxLen {
		return []string{text}
	}

	var lines []string
	words := strings.Fields(text)
	var currentLine string

	for _, word := range words {
		if len(currentLine)+len(word)+1 <= maxLen {
			if currentLine != "" {
				currentLine += " "
			}
			currentLine += word
		} else {
			if currentLine != "" {
				lines = append(lines, currentLine)
			}
			currentLine = word
		}
	}

	if currentLine != "" {
		lines = append(lines, currentLine)
	}

	return lines
}
