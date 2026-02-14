package server

import (
	"context"
	"fmt"

	"github.com/chandler-mayo/mcp-video-editor/pkg/audio"
	"github.com/chandler-mayo/mcp-video-editor/pkg/config"
	"github.com/chandler-mayo/mcp-video-editor/pkg/diagrams"
	"github.com/chandler-mayo/mcp-video-editor/pkg/elements"
	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
	"github.com/chandler-mayo/mcp-video-editor/pkg/multitake"
	"github.com/chandler-mayo/mcp-video-editor/pkg/text"
	"github.com/chandler-mayo/mcp-video-editor/pkg/timeline"
	"github.com/chandler-mayo/mcp-video-editor/pkg/transcript"
	"github.com/chandler-mayo/mcp-video-editor/pkg/video"
	"github.com/chandler-mayo/mcp-video-editor/pkg/vision"
	"github.com/chandler-mayo/mcp-video-editor/pkg/visual"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// MCPServer wraps the MCP server with video editing capabilities
type MCPServer struct {
	server           *server.MCPServer
	config           *config.Config
	ffmpeg           *ffmpeg.Manager
	videoOps         *video.Operations
	textOps          *text.Operations
	visualFx         *visual.Effects
	composite        *visual.Composite
	transitions      *visual.Transitions
	elements         *elements.Operations
	transcriptOps    *transcript.Operations
	timeline         *timeline.Manager
	multitake        *multitake.Manager
	visionAnalyzer   *vision.Analyzer
	diagramGen       *diagrams.Generator
	ttsOps           *audio.TTSOperations
	audioReplacement *audio.ReplacementOperations
	audioOps         *audio.Operations
}

// NewMCPServer creates a new MCP server instance
func NewMCPServer(cfg *config.Config) (*MCPServer, error) {
	// Initialize FFmpeg
	ffmpegMgr, err := ffmpeg.NewManager(cfg.FFmpegPath, cfg.FFprobePath)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize FFmpeg: %w", err)
	}

	// Create operations handlers
	videoOps := video.NewOperations(ffmpegMgr)
	textOps := text.NewOperations(ffmpegMgr)
	visualFx := visual.NewEffects(ffmpegMgr)
	composite := visual.NewComposite(ffmpegMgr)
	transitions := visual.NewTransitions(ffmpegMgr)
	elementsOps := elements.NewOperations(ffmpegMgr)
	transcriptOps := transcript.NewOperations(cfg.OpenAIKey, ffmpegMgr)
	timelineMgr := timeline.NewManager("")
	multitakeMgr := multitake.NewManager("")
	visionAnalyzer := vision.NewAnalyzer(cfg.OpenAIKey, videoOps, ffmpegMgr)
	diagramGen := diagrams.NewGenerator()

	// Create audio operations
	ttsOps := audio.NewTTSOperations(cfg.ElevenLabsKey, cfg)
	spliceOps := audio.NewSpliceOperations(ffmpegMgr)
	audioReplacement := audio.NewReplacementOperations(ttsOps, spliceOps, transcriptOps, videoOps)
	audioOps := audio.NewOperations(ffmpegMgr)

	// Create MCP server
	s := server.NewMCPServer(
		"mcp-video-editor",
		"0.2.0",
	)

	srv := &MCPServer{
		server:           s,
		config:           cfg,
		ffmpeg:           ffmpegMgr,
		videoOps:         videoOps,
		textOps:          textOps,
		visualFx:         visualFx,
		composite:        composite,
		transitions:      transitions,
		elements:         elementsOps,
		transcriptOps:    transcriptOps,
		timeline:         timelineMgr,
		multitake:        multitakeMgr,
		visionAnalyzer:   visionAnalyzer,
		diagramGen:       diagramGen,
		ttsOps:           ttsOps,
		audioReplacement: audioReplacement,
		audioOps:         audioOps,
	}

	// Register all tools
	srv.registerTools()

	return srv, nil
}

// Start starts the MCP server
func (s *MCPServer) Start(ctx context.Context) error {
	return server.ServeStdio(s.server)
}

// registerTools registers all available MCP tools
func (s *MCPServer) registerTools() {
	// Video operations
	s.registerGetVideoInfo()
	s.registerTrimVideo()
	s.registerConcatenateVideos()
	s.registerResizeVideo()
	s.registerExtractAudio()
	s.registerTranscodeVideo()

	// Visual effects
	s.registerApplyBlur()
	s.registerApplyColorGrade()
	s.registerApplyChromaKey()
	s.registerApplyVignette()
	s.registerApplySharpen()

	// Composite operations
	s.registerCreatePictureInPicture()
	s.registerCreateSplitScreen()
	s.registerCreateSideBySide()

	// Transitions
	s.registerAddTransition()
	s.registerCrossfadeVideos()

	// Text operations
	s.registerAddTextOverlay()
	s.registerAddAnimatedText()
	s.registerBurnSubtitles()

	// Additional video operations
	s.registerExtractFrames()
	s.registerAdjustSpeed()
	s.registerConvertVideo()
	s.registerTranscodeForWeb()
	s.registerCreateVideoFromImages()

	// Additional audio operations
	s.registerGetAudioStats()

	// Audio editing operations
	s.registerTrimAudio()
	s.registerConcatenateAudio()
	s.registerAdjustAudioVolume()
	s.registerNormalizeAudio()
	s.registerFadeAudio()
	s.registerMixAudio()
	s.registerConvertAudio()
	s.registerAdjustAudioSpeed()
	s.registerRemoveAudioSection()
	s.registerSplitAudio()
	s.registerReverseAudio()
	s.registerExtractAudioChannel()

	// Audio word replacement
	s.registerReplaceSpokenWord()
	s.registerCloneVoiceFromAudio()
	s.registerGenerateSpeech()
	s.registerGetWordTimestamps()

	// Voice management
	s.registerListCachedVoices()
	s.registerClearCachedVoice()
	s.registerClearAllCachedVoices()

	// Config management
	s.registerGetConfig()
	s.registerSetConfig()
	s.registerResetConfig()

	// Additional visual effects
	s.registerApplyKenBurns()

	// Visual elements
	s.registerAddImageOverlay()
	s.registerAddShape()

	// Transcript operations
	s.registerExtractTranscript()
	s.registerFindInTranscript()
	s.registerRemoveByTranscript()
	s.registerTrimToScript()

	// Timeline operations
	s.registerCreateTimeline()
	s.registerAddToTimeline()
	s.registerViewTimeline()
	s.registerJumpToTimelinePoint()
	s.registerUndo()
	s.registerRedo()
	s.registerListTimelines()
	s.registerGetTimelineStats()

	// Multi-take operations
	s.registerCreateMultiTakeProject()
	s.registerAddTakesToProject()
	s.registerAnalyzeTakes()
	s.registerSelectBestTakes()
	s.registerAssembleBestTakes()
	s.registerListMultiTakeProjects()
	s.registerCleanupProjectTemp()
	s.registerExportFinalVideo()

	// Video vision analysis
	s.registerAnalyzeVideoContent()
	s.registerCompareVideoFrames()
	s.registerDescribeScene()
	s.registerFindObjectsInVideo()
	s.registerSearchVisualContent()

	// Diagram generation
	s.registerGenerateTimeline()
	s.registerGenerateFlowchart()
	s.registerGenerateOrgChart()
	s.registerGenerateMindMap()
}

// Tool registration methods

func (s *MCPServer) registerGetVideoInfo() {
	s.server.AddTool(mcp.Tool{
		Name:        "get_video_info",
		Description: "Get metadata and information about a video file",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"filePath": map[string]interface{}{
					"type":        "string",
					"description": "Path to the video file",
				},
			},
			Required: []string{"filePath"},
		},
	}, s.handleGetVideoInfo)
}

func (s *MCPServer) registerTrimVideo() {
	s.server.AddTool(mcp.Tool{
		Name:        "trim_video",
		Description: "Cut/trim a video by specifying start time and end time or duration",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"startTime": map[string]interface{}{
					"type":        "number",
					"description": "Start time in seconds",
				},
				"endTime": map[string]interface{}{
					"type":        "number",
					"description": "End time in seconds (optional)",
				},
				"duration": map[string]interface{}{
					"type":        "number",
					"description": "Duration in seconds (optional)",
				},
			},
			Required: []string{"input", "output", "startTime"},
		},
	}, s.handleTrimVideo)
}

func (s *MCPServer) registerConcatenateVideos() {
	s.server.AddTool(mcp.Tool{
		Name:        "concatenate_videos",
		Description: "Join multiple videos together into a single video file",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"inputs": map[string]interface{}{
					"type": "array",
					"items": map[string]interface{}{
						"type": "string",
					},
					"description": "Array of input video file paths",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
			},
			Required: []string{"inputs", "output"},
		},
	}, s.handleConcatenateVideos)
}

func (s *MCPServer) registerResizeVideo() {
	s.server.AddTool(mcp.Tool{
		Name:        "resize_video",
		Description: "Change the resolution of a video",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"width": map[string]interface{}{
					"type":        "number",
					"description": "Target width",
				},
				"height": map[string]interface{}{
					"type":        "number",
					"description": "Target height",
				},
				"maintainAspectRatio": map[string]interface{}{
					"type":        "boolean",
					"description": "Maintain aspect ratio",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleResizeVideo)
}

func (s *MCPServer) registerExtractAudio() {
	s.server.AddTool(mcp.Tool{
		Name:        "extract_audio",
		Description: "Extract audio track from a video file",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output audio file path",
				},
				"format": map[string]interface{}{
					"type":        "string",
					"description": "Audio format (mp3, aac, etc.)",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleExtractAudio)
}

func (s *MCPServer) registerTranscodeVideo() {
	s.server.AddTool(mcp.Tool{
		Name:        "transcode_video",
		Description: "Convert video to different format/codec",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"quality": map[string]interface{}{
					"type":        "string",
					"description": "Quality: high, medium, low",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleTranscodeVideo)
}

func (s *MCPServer) registerApplyBlur() {
	s.server.AddTool(mcp.Tool{
		Name:        "apply_blur_effect",
		Description: "Apply blur effect to video",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video path",
				},
				"type": map[string]interface{}{
					"type":        "string",
					"description": "Blur type: gaussian, box, motion, radial",
				},
				"strength": map[string]interface{}{
					"type":        "number",
					"description": "Blur strength 0-10",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleApplyBlur)
}

func (s *MCPServer) registerApplyColorGrade() {
	s.server.AddTool(mcp.Tool{
		Name:        "apply_color_grade",
		Description: "Apply color grading adjustments",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video path",
				},
				"brightness": map[string]interface{}{
					"type":        "number",
					"description": "Brightness -1 to 1",
				},
				"contrast": map[string]interface{}{
					"type":        "number",
					"description": "Contrast -1 to 1",
				},
				"saturation": map[string]interface{}{
					"type":        "number",
					"description": "Saturation -1 to 1",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleApplyColorGrade)
}

func (s *MCPServer) registerApplyChromaKey() {
	s.server.AddTool(mcp.Tool{
		Name:        "apply_chroma_key",
		Description: "Remove green screen (chroma key)",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video path",
				},
				"keyColor": map[string]interface{}{
					"type":        "string",
					"description": "Color to key out (default: green)",
				},
				"similarity": map[string]interface{}{
					"type":        "number",
					"description": "Color similarity 0-1",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleApplyChromaKey)
}

func (s *MCPServer) registerApplyVignette() {
	s.server.AddTool(mcp.Tool{
		Name:        "apply_vignette",
		Description: "Apply vignette effect (darkened edges)",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video path",
				},
				"intensity": map[string]interface{}{
					"type":        "number",
					"description": "Intensity 0-1",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleApplyVignette)
}

func (s *MCPServer) registerApplySharpen() {
	s.server.AddTool(mcp.Tool{
		Name:        "apply_sharpen",
		Description: "Apply sharpen effect to video",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video path",
				},
				"strength": map[string]interface{}{
					"type":        "number",
					"description": "Sharpen strength 0-10",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleApplySharpen)
}

func (s *MCPServer) registerCreatePictureInPicture() {
	s.server.AddTool(mcp.Tool{
		Name:        "create_picture_in_picture",
		Description: "Create picture-in-picture effect",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"mainVideo": map[string]interface{}{
					"type":        "string",
					"description": "Main video path",
				},
				"pipVideo": map[string]interface{}{
					"type":        "string",
					"description": "PiP video path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video path",
				},
				"position": map[string]interface{}{
					"type":        "string",
					"description": "Position: top-left, top-right, bottom-left, bottom-right, center",
				},
			},
			Required: []string{"mainVideo", "pipVideo", "output"},
		},
	}, s.handleCreatePictureInPicture)
}

func (s *MCPServer) registerCreateSplitScreen() {
	s.server.AddTool(mcp.Tool{
		Name:        "create_split_screen",
		Description: "Create split screen layout",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"videos": map[string]interface{}{
					"type": "array",
					"items": map[string]interface{}{
						"type": "string",
					},
					"description": "Array of video paths",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video path",
				},
				"layout": map[string]interface{}{
					"type":        "string",
					"description": "Layout: horizontal, vertical, grid-2x2, grid-3x3",
				},
			},
			Required: []string{"videos", "output", "layout"},
		},
	}, s.handleCreateSplitScreen)
}

func (s *MCPServer) registerAddTransition() {
	s.server.AddTool(mcp.Tool{
		Name:        "add_transition",
		Description: "Add transition between two videos",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input1": map[string]interface{}{
					"type":        "string",
					"description": "First video path",
				},
				"input2": map[string]interface{}{
					"type":        "string",
					"description": "Second video path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video path",
				},
				"type": map[string]interface{}{
					"type":        "string",
					"description": "Transition type: fade, wipeleft, wiperight, etc.",
				},
				"duration": map[string]interface{}{
					"type":        "number",
					"description": "Transition duration in seconds",
				},
			},
			Required: []string{"input1", "input2", "output", "type"},
		},
	}, s.handleAddTransition)
}

func (s *MCPServer) registerCrossfadeVideos() {
	s.server.AddTool(mcp.Tool{
		Name:        "crossfade_videos",
		Description: "Smoothly crossfade between two videos",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input1": map[string]interface{}{
					"type":        "string",
					"description": "First video path",
				},
				"input2": map[string]interface{}{
					"type":        "string",
					"description": "Second video path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video path",
				},
				"duration": map[string]interface{}{
					"type":        "number",
					"description": "Crossfade duration in seconds",
				},
			},
			Required: []string{"input1", "input2", "output"},
		},
	}, s.handleCrossfadeVideos)
}

// Text operation registrations

func (s *MCPServer) registerAddTextOverlay() {
	s.server.AddTool(mcp.Tool{
		Name:        "add_text_overlay",
		Description: "Add text overlay to video with positioning, styling, and effects",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"text": map[string]interface{}{
					"type":        "string",
					"description": "Text to overlay",
				},
				"position": map[string]interface{}{
					"type":        "string",
					"description": "Position: top-left, top-center, top-right, center, bottom-left, bottom-center, bottom-right",
				},
				"x": map[string]interface{}{
					"type":        "string",
					"description": "X position (can be expression like 'w/2')",
				},
				"y": map[string]interface{}{
					"type":        "string",
					"description": "Y position (can be expression like 'h/2')",
				},
				"fontSize": map[string]interface{}{
					"type":        "number",
					"description": "Font size (default: 24)",
				},
				"fontColor": map[string]interface{}{
					"type":        "string",
					"description": "Font color (default: white)",
				},
				"borderWidth": map[string]interface{}{
					"type":        "number",
					"description": "Border width",
				},
				"startTime": map[string]interface{}{
					"type":        "number",
					"description": "Start time in seconds",
				},
				"duration": map[string]interface{}{
					"type":        "number",
					"description": "Duration in seconds",
				},
			},
			Required: []string{"input", "output", "text"},
		},
	}, s.handleAddTextOverlay)
}

func (s *MCPServer) registerAddAnimatedText() {
	s.server.AddTool(mcp.Tool{
		Name:        "add_animated_text",
		Description: "Add animated text to video (fade, slide, zoom effects)",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"text": map[string]interface{}{
					"type":        "string",
					"description": "Text to animate",
				},
				"animation": map[string]interface{}{
					"type":        "string",
					"description": "Animation type: fade, slide-left, slide-right, slide-up, slide-down, zoom",
				},
				"animationDuration": map[string]interface{}{
					"type":        "number",
					"description": "Animation duration in seconds",
				},
				"fontSize": map[string]interface{}{
					"type":        "number",
					"description": "Font size",
				},
				"fontColor": map[string]interface{}{
					"type":        "string",
					"description": "Font color",
				},
			},
			Required: []string{"input", "output", "text", "animation"},
		},
	}, s.handleAddAnimatedText)
}

func (s *MCPServer) registerBurnSubtitles() {
	s.server.AddTool(mcp.Tool{
		Name:        "burn_subtitles",
		Description: "Burn subtitles into video from SRT/VTT file",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"subtitleFile": map[string]interface{}{
					"type":        "string",
					"description": "Subtitle file path (SRT, VTT, or ASS)",
				},
				"fontSize": map[string]interface{}{
					"type":        "number",
					"description": "Font size",
				},
				"fontColor": map[string]interface{}{
					"type":        "string",
					"description": "Font color",
				},
			},
			Required: []string{"input", "output", "subtitleFile"},
		},
	}, s.handleBurnSubtitles)
}

// Additional video operation registrations

func (s *MCPServer) registerExtractFrames() {
	s.server.AddTool(mcp.Tool{
		Name:        "extract_frames",
		Description: "Extract frames from video as images",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"outputDir": map[string]interface{}{
					"type":        "string",
					"description": "Output directory for frames",
				},
				"fps": map[string]interface{}{
					"type":        "number",
					"description": "Frames per second to extract",
				},
				"format": map[string]interface{}{
					"type":        "string",
					"description": "Output format: jpg, png (default: jpg)",
				},
				"startTime": map[string]interface{}{
					"type":        "number",
					"description": "Start time in seconds",
				},
				"duration": map[string]interface{}{
					"type":        "number",
					"description": "Duration in seconds",
				},
			},
			Required: []string{"input", "outputDir"},
		},
	}, s.handleExtractFrames)
}

func (s *MCPServer) registerAdjustSpeed() {
	s.server.AddTool(mcp.Tool{
		Name:        "adjust_speed",
		Description: "Adjust video playback speed (slow motion or fast forward)",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"speed": map[string]interface{}{
					"type":        "number",
					"description": "Speed multiplier (0.5 = half speed, 2.0 = double speed)",
				},
			},
			Required: []string{"input", "output", "speed"},
		},
	}, s.handleAdjustSpeed)
}

func (s *MCPServer) registerConvertVideo() {
	s.server.AddTool(mcp.Tool{
		Name:        "convert_video",
		Description: "Convert video to different format with codec and quality options",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"format": map[string]interface{}{
					"type":        "string",
					"description": "Output format: mp4, webm, avi, mkv",
				},
				"videoCodec": map[string]interface{}{
					"type":        "string",
					"description": "Video codec: h264, vp9, mpeg4",
				},
				"quality": map[string]interface{}{
					"type":        "string",
					"description": "Quality: high, medium, low",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleConvertVideo)
}

func (s *MCPServer) registerTranscodeForWeb() {
	s.server.AddTool(mcp.Tool{
		Name:        "transcode_for_web",
		Description: "Transcode video optimized for web platforms (YouTube, Vimeo, social media)",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"profile": map[string]interface{}{
					"type":        "string",
					"description": "Profile: youtube, vimeo, twitter, instagram, facebook, web (default)",
				},
				"resolution": map[string]interface{}{
					"type":        "string",
					"description": "Resolution: 1080p, 720p, 480p, 360p (default: 1080p)",
				},
				"format": map[string]interface{}{
					"type":        "string",
					"description": "Format: mp4 (default), webm",
				},
			},
			Required: []string{"input", "output"},
		},
	}, s.handleTranscodeForWeb)
}

// Config management registrations

func (s *MCPServer) registerGetConfig() {
	s.server.AddTool(mcp.Tool{
		Name:        "get_config",
		Description: "Get current configuration settings",
		InputSchema: mcp.ToolInputSchema{
			Type:       "object",
			Properties: map[string]interface{}{},
			Required:   []string{},
		},
	}, s.handleGetConfig)
}

func (s *MCPServer) registerSetConfig() {
	s.server.AddTool(mcp.Tool{
		Name:        "set_config",
		Description: "Update configuration settings",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"openaiKey": map[string]interface{}{
					"type":        "string",
					"description": "OpenAI API key",
				},
				"ffmpegPath": map[string]interface{}{
					"type":        "string",
					"description": "Path to FFmpeg binary",
				},
				"ffprobePath": map[string]interface{}{
					"type":        "string",
					"description": "Path to FFprobe binary",
				},
				"defaultQuality": map[string]interface{}{
					"type":        "string",
					"description": "Default quality: high, medium, low",
				},
				"tempDir": map[string]interface{}{
					"type":        "string",
					"description": "Temporary directory path",
				},
			},
			Required: []string{},
		},
	}, s.handleSetConfig)
}

func (s *MCPServer) registerResetConfig() {
	s.server.AddTool(mcp.Tool{
		Name:        "reset_config",
		Description: "Reset configuration to defaults",
		InputSchema: mcp.ToolInputSchema{
			Type:       "object",
			Properties: map[string]interface{}{},
			Required:   []string{},
		},
	}, s.handleResetConfig)
}

// Additional visual effects registrations

func (s *MCPServer) registerApplyKenBurns() {
	s.server.AddTool(mcp.Tool{
		Name:        "apply_ken_burns",
		Description: "Apply Ken Burns effect (zoom and pan) to still image",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input image file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"duration": map[string]interface{}{
					"type":        "number",
					"description": "Duration in seconds",
				},
				"startZoom": map[string]interface{}{
					"type":        "number",
					"description": "Starting zoom level (1.0 = no zoom, default: 1.0)",
				},
				"endZoom": map[string]interface{}{
					"type":        "number",
					"description": "Ending zoom level (default: 1.2)",
				},
				"startX": map[string]interface{}{
					"type":        "number",
					"description": "Starting X position (0-1, 0.5 = center)",
				},
				"startY": map[string]interface{}{
					"type":        "number",
					"description": "Starting Y position (0-1, 0.5 = center)",
				},
				"endX": map[string]interface{}{
					"type":        "number",
					"description": "Ending X position (0-1)",
				},
				"endY": map[string]interface{}{
					"type":        "number",
					"description": "Ending Y position (0-1)",
				},
			},
			Required: []string{"input", "output", "duration"},
		},
	}, s.handleApplyKenBurns)
}

// Visual elements registrations

func (s *MCPServer) registerAddImageOverlay() {
	s.server.AddTool(mcp.Tool{
		Name:        "add_image_overlay",
		Description: "Overlay an image on video with positioning, scaling, and effects",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"image": map[string]interface{}{
					"type":        "string",
					"description": "Image file path to overlay",
				},
				"position": map[string]interface{}{
					"type":        "string",
					"description": "Position: top-left, top-right, bottom-left, bottom-right, center, etc.",
				},
				"x": map[string]interface{}{
					"type":        "string",
					"description": "X position (can be expression like 'W-w-10')",
				},
				"y": map[string]interface{}{
					"type":        "string",
					"description": "Y position (can be expression)",
				},
				"scale": map[string]interface{}{
					"type":        "number",
					"description": "Scale factor (e.g., 0.5 for 50%)",
				},
				"width": map[string]interface{}{
					"type":        "number",
					"description": "Overlay width in pixels",
				},
				"height": map[string]interface{}{
					"type":        "number",
					"description": "Overlay height in pixels",
				},
				"opacity": map[string]interface{}{
					"type":        "number",
					"description": "Opacity 0-1 (default: 1.0)",
				},
				"rotation": map[string]interface{}{
					"type":        "number",
					"description": "Rotation in degrees",
				},
				"startTime": map[string]interface{}{
					"type":        "number",
					"description": "Start time in seconds",
				},
				"duration": map[string]interface{}{
					"type":        "number",
					"description": "Duration in seconds",
				},
			},
			Required: []string{"input", "output", "image"},
		},
	}, s.handleAddImageOverlay)
}

func (s *MCPServer) registerAddShape() {
	s.server.AddTool(mcp.Tool{
		Name:        "add_shape",
		Description: "Draw shapes on video (rectangle, circle, line, arrow)",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"shape": map[string]interface{}{
					"type":        "string",
					"description": "Shape type: rectangle, circle, line, arrow",
				},
				"x": map[string]interface{}{
					"type":        "number",
					"description": "X position",
				},
				"y": map[string]interface{}{
					"type":        "number",
					"description": "Y position",
				},
				"width": map[string]interface{}{
					"type":        "number",
					"description": "Width (for rectangle)",
				},
				"height": map[string]interface{}{
					"type":        "number",
					"description": "Height (for rectangle)",
				},
				"radius": map[string]interface{}{
					"type":        "number",
					"description": "Radius (for circle)",
				},
				"x2": map[string]interface{}{
					"type":        "number",
					"description": "End X (for line/arrow)",
				},
				"y2": map[string]interface{}{
					"type":        "number",
					"description": "End Y (for line/arrow)",
				},
				"color": map[string]interface{}{
					"type":        "string",
					"description": "Color (e.g., 'red', 'white', '0xFF0000')",
				},
				"borderWidth": map[string]interface{}{
					"type":        "number",
					"description": "Border width (0 = filled shape)",
				},
				"opacity": map[string]interface{}{
					"type":        "number",
					"description": "Opacity 0-1",
				},
				"startTime": map[string]interface{}{
					"type":        "number",
					"description": "Start time in seconds",
				},
				"duration": map[string]interface{}{
					"type":        "number",
					"description": "Duration in seconds",
				},
			},
			Required: []string{"input", "output", "shape", "x", "y"},
		},
	}, s.handleAddShape)
}

// Transcript operation registrations

func (s *MCPServer) registerExtractTranscript() {
	s.server.AddTool(mcp.Tool{
		Name:        "extract_transcript",
		Description: "Extract transcript from video using OpenAI Whisper",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"videoPath": map[string]interface{}{
					"type":        "string",
					"description": "Path to video file",
				},
				"language": map[string]interface{}{
					"type":        "string",
					"description": "Language code (e.g., 'en', 'es', 'fr')",
				},
				"outputPath": map[string]interface{}{
					"type":        "string",
					"description": "Path to save transcript JSON file (optional)",
				},
				"format": map[string]interface{}{
					"type":        "string",
					"description": "Output format: json, text, srt (default: json)",
				},
			},
			Required: []string{"videoPath"},
		},
	}, s.handleExtractTranscript)
}

func (s *MCPServer) registerFindInTranscript() {
	s.server.AddTool(mcp.Tool{
		Name:        "find_in_transcript",
		Description: "Search for text in transcript and get timestamps",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"transcriptPath": map[string]interface{}{
					"type":        "string",
					"description": "Path to transcript JSON file",
				},
				"searchText": map[string]interface{}{
					"type":        "string",
					"description": "Text to search for",
				},
			},
			Required: []string{"transcriptPath", "searchText"},
		},
	}, s.handleFindInTranscript)
}

func (s *MCPServer) registerRemoveByTranscript() {
	s.server.AddTool(mcp.Tool{
		Name:        "remove_by_transcript",
		Description: "Remove portions of video based on transcript text",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"transcriptPath": map[string]interface{}{
					"type":        "string",
					"description": "Path to transcript JSON file",
				},
				"textToRemove": map[string]interface{}{
					"type":        "string",
					"description": "Text to find and remove from video",
				},
			},
			Required: []string{"input", "output", "transcriptPath", "textToRemove"},
		},
	}, s.handleRemoveByTranscript)
}

func (s *MCPServer) registerTrimToScript() {
	s.server.AddTool(mcp.Tool{
		Name:        "trim_to_script",
		Description: "Trim video to keep only portions matching a script",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"transcriptPath": map[string]interface{}{
					"type":        "string",
					"description": "Path to transcript JSON file",
				},
				"script": map[string]interface{}{
					"type":        "string",
					"description": "Script text to match (keeps only matching portions)",
				},
			},
			Required: []string{"input", "output", "transcriptPath", "script"},
		},
	}, s.handleTrimToScript)
}

// Timeline operation registrations

func (s *MCPServer) registerCreateTimeline() {
	s.server.AddTool(mcp.Tool{
		Name:        "create_timeline",
		Description: "Create a new timeline for tracking video editing operations with undo/redo support",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name for the timeline",
				},
				"baseFile": map[string]interface{}{
					"type":        "string",
					"description": "Base video file (optional)",
				},
			},
			Required: []string{"name"},
		},
	}, s.handleCreateTimeline)
}

func (s *MCPServer) registerAddToTimeline() {
	s.server.AddTool(mcp.Tool{
		Name:        "add_to_timeline",
		Description: "Add an operation to the timeline",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"timelineId": map[string]interface{}{
					"type":        "string",
					"description": "Timeline ID",
				},
				"operation": map[string]interface{}{
					"type":        "string",
					"description": "Operation name (e.g., 'trim', 'blur', 'text_overlay')",
				},
				"description": map[string]interface{}{
					"type":        "string",
					"description": "Description of what was done",
				},
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output file path",
				},
				"parameters": map[string]interface{}{
					"type":        "object",
					"description": "Operation parameters",
				},
			},
			Required: []string{"timelineId", "operation", "description", "input", "output"},
		},
	}, s.handleAddToTimeline)
}

func (s *MCPServer) registerViewTimeline() {
	s.server.AddTool(mcp.Tool{
		Name:        "view_timeline",
		Description: "View timeline history and current state",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"timelineId": map[string]interface{}{
					"type":        "string",
					"description": "Timeline ID",
				},
			},
			Required: []string{"timelineId"},
		},
	}, s.handleViewTimeline)
}

func (s *MCPServer) registerJumpToTimelinePoint() {
	s.server.AddTool(mcp.Tool{
		Name:        "jump_to_timeline_point",
		Description: "Jump to a specific point in the timeline",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"timelineId": map[string]interface{}{
					"type":        "string",
					"description": "Timeline ID",
				},
				"index": map[string]interface{}{
					"type":        "number",
					"description": "Operation index (0-based, -1 for before first operation)",
				},
			},
			Required: []string{"timelineId", "index"},
		},
	}, s.handleJumpToTimelinePoint)
}

func (s *MCPServer) registerUndo() {
	s.server.AddTool(mcp.Tool{
		Name:        "undo",
		Description: "Undo the last operation in the timeline",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"timelineId": map[string]interface{}{
					"type":        "string",
					"description": "Timeline ID",
				},
			},
			Required: []string{"timelineId"},
		},
	}, s.handleUndo)
}

func (s *MCPServer) registerRedo() {
	s.server.AddTool(mcp.Tool{
		Name:        "redo",
		Description: "Redo the next operation in the timeline",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"timelineId": map[string]interface{}{
					"type":        "string",
					"description": "Timeline ID",
				},
			},
			Required: []string{"timelineId"},
		},
	}, s.handleRedo)
}

// Multi-take registration methods

func (s *MCPServer) registerCreateMultiTakeProject() {
	s.server.AddTool(mcp.Tool{
		Name:        "create_multi_take_project",
		Description: "Create a new multi-take editing project",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Project name",
				},
				"script": map[string]interface{}{
					"type":        "string",
					"description": "Script content (newline-separated sections)",
				},
			},
			Required: []string{"name", "script"},
		},
	}, s.handleCreateMultiTakeProject)
}

func (s *MCPServer) registerAddTakesToProject() {
	s.server.AddTool(mcp.Tool{
		Name:        "add_takes_to_project",
		Description: "Add video takes to a multi-take project",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"projectId": map[string]interface{}{
					"type":        "string",
					"description": "Project ID",
				},
				"takePaths": map[string]interface{}{
					"type": "array",
					"items": map[string]interface{}{
						"type": "string",
					},
					"description": "Array of video file paths for takes",
				},
			},
			Required: []string{"projectId", "takePaths"},
		},
	}, s.handleAddTakesToProject)
}

func (s *MCPServer) registerAnalyzeTakes() {
	s.server.AddTool(mcp.Tool{
		Name:        "analyze_takes",
		Description: "Analyze all takes in the project and match to script sections",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"projectId": map[string]interface{}{
					"type":        "string",
					"description": "Project ID",
				},
			},
			Required: []string{"projectId"},
		},
	}, s.handleAnalyzeTakes)
}

func (s *MCPServer) registerSelectBestTakes() {
	s.server.AddTool(mcp.Tool{
		Name:        "select_best_takes",
		Description: "Select the best takes for each script section",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"projectId": map[string]interface{}{
					"type":        "string",
					"description": "Project ID",
				},
			},
			Required: []string{"projectId"},
		},
	}, s.handleSelectBestTakes)
}

func (s *MCPServer) registerAssembleBestTakes() {
	s.server.AddTool(mcp.Tool{
		Name:        "assemble_best_takes",
		Description: "Assemble the best takes into a final video",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"projectId": map[string]interface{}{
					"type":        "string",
					"description": "Project ID",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
			},
			Required: []string{"projectId", "output"},
		},
	}, s.handleAssembleBestTakes)
}

func (s *MCPServer) registerListMultiTakeProjects() {
	s.server.AddTool(mcp.Tool{
		Name:        "list_multi_take_projects",
		Description: "List all multi-take projects",
		InputSchema: mcp.ToolInputSchema{
			Type:       "object",
			Properties: map[string]interface{}{},
		},
	}, s.handleListMultiTakeProjects)
}

func (s *MCPServer) registerCleanupProjectTemp() {
	s.server.AddTool(mcp.Tool{
		Name:        "cleanup_project_temp",
		Description: "Clean up temporary files for a project",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"projectId": map[string]interface{}{
					"type":        "string",
					"description": "Project ID",
				},
			},
			Required: []string{"projectId"},
		},
	}, s.handleCleanupProjectTemp)
}

func (s *MCPServer) registerListTimelines() {
	s.server.AddTool(mcp.Tool{
		Name:        "list_timelines",
		Description: "List all editing timelines",
		InputSchema: mcp.ToolInputSchema{
			Type:       "object",
			Properties: map[string]interface{}{},
		},
	}, s.handleListTimelines)
}

func (s *MCPServer) registerGetTimelineStats() {
	s.server.AddTool(mcp.Tool{
		Name:        "get_timeline_stats",
		Description: "Get statistics about timeline operations (total, completed, failed, duration, etc.)",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"timelineId": map[string]interface{}{
					"type":        "string",
					"description": "Timeline ID",
				},
			},
			Required: []string{"timelineId"},
		},
	}, s.handleGetTimelineStats)
}

func (s *MCPServer) registerExportFinalVideo() {
	s.server.AddTool(mcp.Tool{
		Name:        "export_final_video",
		Description: "Export and transcode the final assembled video for web delivery",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"projectId": map[string]interface{}{
					"type":        "string",
					"description": "Project ID",
				},
				"quality": map[string]interface{}{
					"type":        "string",
					"enum":        []string{"high", "medium", "low"},
					"description": "Export quality preset (default: medium)",
				},
				"exportPath": map[string]interface{}{
					"type":        "string",
					"description": "Optional export path (defaults to project exports directory)",
				},
			},
			Required: []string{"projectId"},
		},
	}, s.handleExportFinalVideo)
}

// Video vision analysis registration methods

func (s *MCPServer) registerAnalyzeVideoContent() {
	s.server.AddTool(mcp.Tool{
		Name:        "analyze_video_content",
		Description: "Analyze visual content of video by extracting and analyzing frames with GPT-4 Vision. Returns frame descriptions, objects detected, and overall summary.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"interval": map[string]interface{}{
					"type":        "number",
					"description": "Interval in seconds between frame extractions (default: 5)",
				},
				"count": map[string]interface{}{
					"type":        "number",
					"description": "Number of evenly-spaced frames to analyze (alternative to interval)",
				},
			},
			Required: []string{"input"},
		},
	}, s.handleAnalyzeVideoContent)
}

func (s *MCPServer) registerCompareVideoFrames() {
	s.server.AddTool(mcp.Tool{
		Name:        "compare_video_frames",
		Description: "Compare two frames from a video at different timestamps and describe the differences",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"timestamp1": map[string]interface{}{
					"type":        "number",
					"description": "First timestamp in seconds",
				},
				"timestamp2": map[string]interface{}{
					"type":        "number",
					"description": "Second timestamp in seconds",
				},
			},
			Required: []string{"input", "timestamp1", "timestamp2"},
		},
	}, s.handleCompareVideoFrames)
}

func (s *MCPServer) registerDescribeScene() {
	s.server.AddTool(mcp.Tool{
		Name:        "describe_scene",
		Description: "Describe a specific scene in the video at a given timestamp using GPT-4 Vision",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"timestamp": map[string]interface{}{
					"type":        "number",
					"description": "Timestamp in seconds",
				},
				"prompt": map[string]interface{}{
					"type":        "string",
					"description": "Optional custom prompt for the description",
				},
			},
			Required: []string{"input", "timestamp"},
		},
	}, s.handleDescribeScene)
}

func (s *MCPServer) registerFindObjectsInVideo() {
	s.server.AddTool(mcp.Tool{
		Name:        "find_objects_in_video",
		Description: "Find specific objects or elements in video frames using GPT-4 Vision",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"query": map[string]interface{}{
					"type":        "string",
					"description": "Description of object(s) to find",
				},
				"interval": map[string]interface{}{
					"type":        "number",
					"description": "Interval in seconds between frame checks (default: 5)",
				},
			},
			Required: []string{"input", "query"},
		},
	}, s.handleFindObjectsInVideo)
}

func (s *MCPServer) registerSearchVisualContent() {
	s.server.AddTool(mcp.Tool{
		Name:        "search_visual_content",
		Description: "Search for specific visual content throughout the video and return matching timestamps",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video file path",
				},
				"query": map[string]interface{}{
					"type":        "string",
					"description": "Description of content to search for",
				},
				"interval": map[string]interface{}{
					"type":        "number",
					"description": "Interval in seconds between frame checks (default: 5)",
				},
			},
			Required: []string{"input", "query"},
		},
	}, s.handleSearchVisualContent)
}

func (s *MCPServer) registerGenerateTimeline() {
	s.server.AddTool(mcp.Tool{
		Name:        "generate_timeline",
		Description: "Generate a timeline diagram from events data and save as image",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"title": map[string]interface{}{
					"type":        "string",
					"description": "Title of the timeline",
				},
				"events": map[string]interface{}{
					"type":        "array",
					"description": "Array of timeline events with label, date, and optional description",
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"label": map[string]interface{}{
								"type":        "string",
								"description": "Event label",
							},
							"date": map[string]interface{}{
								"type":        "string",
								"description": "Event date",
							},
							"description": map[string]interface{}{
								"type":        "string",
								"description": "Optional event description",
							},
						},
						"required": []string{"label", "date"},
					},
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output image file path (PNG)",
				},
				"orientation": map[string]interface{}{
					"type":        "string",
					"description": "Timeline orientation: 'horizontal' or 'vertical' (default: horizontal)",
				},
				"width": map[string]interface{}{
					"type":        "number",
					"description": "Image width in pixels (default: 1200)",
				},
				"height": map[string]interface{}{
					"type":        "number",
					"description": "Image height in pixels (default: 600)",
				},
			},
			Required: []string{"title", "events", "output"},
		},
	}, s.handleGenerateTimeline)
}

func (s *MCPServer) registerGenerateFlowchart() {
	s.server.AddTool(mcp.Tool{
		Name:        "generate_flowchart",
		Description: "Generate a flowchart diagram from nodes and connections and save as image",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"title": map[string]interface{}{
					"type":        "string",
					"description": "Title of the flowchart",
				},
				"nodes": map[string]interface{}{
					"type":        "array",
					"description": "Array of flowchart nodes",
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"id": map[string]interface{}{
								"type":        "string",
								"description": "Unique node ID",
							},
							"label": map[string]interface{}{
								"type":        "string",
								"description": "Node label text",
							},
							"type": map[string]interface{}{
								"type":        "string",
								"description": "Node type: 'process', 'decision', 'start', 'end', or 'data'",
							},
							"connections": map[string]interface{}{
								"type":        "array",
								"description": "Array of node IDs this node connects to",
								"items": map[string]interface{}{
									"type": "string",
								},
							},
						},
						"required": []string{"id", "label", "type"},
					},
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output image file path (PNG)",
				},
				"width": map[string]interface{}{
					"type":        "number",
					"description": "Image width in pixels (default: 1200)",
				},
				"height": map[string]interface{}{
					"type":        "number",
					"description": "Image height in pixels (default: 800)",
				},
			},
			Required: []string{"title", "nodes", "output"},
		},
	}, s.handleGenerateFlowchart)
}

func (s *MCPServer) registerGenerateOrgChart() {
	s.server.AddTool(mcp.Tool{
		Name:        "generate_org_chart",
		Description: "Generate an organization chart from hierarchical data and save as image",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"title": map[string]interface{}{
					"type":        "string",
					"description": "Title of the org chart",
				},
				"root": map[string]interface{}{
					"type":        "object",
					"description": "Root node of the organizational hierarchy",
					"properties": map[string]interface{}{
						"id": map[string]interface{}{
							"type":        "string",
							"description": "Unique node ID",
						},
						"name": map[string]interface{}{
							"type":        "string",
							"description": "Person's name",
						},
						"title": map[string]interface{}{
							"type":        "string",
							"description": "Job title",
						},
						"children": map[string]interface{}{
							"type":        "array",
							"description": "Array of child nodes",
							"items": map[string]interface{}{
								"type": "object",
							},
						},
					},
					"required": []string{"id", "name", "title"},
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output image file path (PNG)",
				},
				"width": map[string]interface{}{
					"type":        "number",
					"description": "Image width in pixels (default: 1200)",
				},
				"height": map[string]interface{}{
					"type":        "number",
					"description": "Image height in pixels (default: 800)",
				},
			},
			Required: []string{"title", "root", "output"},
		},
	}, s.handleGenerateOrgChart)
}

func (s *MCPServer) registerGenerateMindMap() {
	s.server.AddTool(mcp.Tool{
		Name:        "generate_mind_map",
		Description: "Generate a mind map diagram from hierarchical data with radial layout and save as image",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"title": map[string]interface{}{
					"type":        "string",
					"description": "Title of the mind map",
				},
				"root": map[string]interface{}{
					"type":        "object",
					"description": "Root node of the mind map",
					"properties": map[string]interface{}{
						"id": map[string]interface{}{
							"type":        "string",
							"description": "Unique node ID",
						},
						"text": map[string]interface{}{
							"type":        "string",
							"description": "Node text/label",
						},
						"color": map[string]interface{}{
							"type":        "string",
							"description": "Optional custom color for this branch (hex)",
						},
						"children": map[string]interface{}{
							"type":        "array",
							"description": "Array of child nodes",
							"items": map[string]interface{}{
								"type": "object",
							},
						},
					},
					"required": []string{"id", "text"},
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output image file path (PNG)",
				},
				"width": map[string]interface{}{
					"type":        "number",
					"description": "Image width in pixels (default: 1200)",
				},
				"height": map[string]interface{}{
					"type":        "number",
					"description": "Image height in pixels (default: 800)",
				},
			},
			Required: []string{"title", "root", "output"},
		},
	}, s.handleGenerateMindMap)
}

func (s *MCPServer) registerCreateSideBySide() {
	s.server.AddTool(mcp.Tool{
		Name:        "create_side_by_side",
		Description: "Place two videos side by side horizontally",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input1": map[string]interface{}{
					"type":        "string",
					"description": "First input video file path",
				},
				"input2": map[string]interface{}{
					"type":        "string",
					"description": "Second input video file path",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
			},
			Required: []string{"input1", "input2", "output"},
		},
	}, s.handleCreateSideBySide)
}

func (s *MCPServer) registerCreateVideoFromImages() {
	s.server.AddTool(mcp.Tool{
		Name:        "create_video_from_images",
		Description: "Create a video from a sequence of image files",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"imagePattern": map[string]interface{}{
					"type":        "string",
					"description": "Image file pattern (e.g., 'frame-%03d.png' or 'image*.jpg')",
				},
				"output": map[string]interface{}{
					"type":        "string",
					"description": "Output video file path",
				},
				"fps": map[string]interface{}{
					"type":        "number",
					"description": "Frames per second (default: 30)",
				},
			},
			Required: []string{"imagePattern", "output"},
		},
	}, s.handleCreateVideoFromImages)
}

func (s *MCPServer) registerGetAudioStats() {
	s.server.AddTool(mcp.Tool{
		Name:        "get_audio_stats",
		Description: "Get audio statistics and analysis from a video or audio file",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "string",
					"description": "Input video or audio file path",
				},
			},
			Required: []string{"input"},
		},
	}, s.handleGetAudioStats)
}
