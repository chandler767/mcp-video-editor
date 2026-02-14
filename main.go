package main

import (
	"embed"
	"fmt"
	"log"
	"os"

	"github.com/chandler-mayo/mcp-video-editor/internal/services"
	wailsbridge "github.com/chandler-mayo/mcp-video-editor/internal/transport/wails"
	"github.com/chandler-mayo/mcp-video-editor/pkg/config"
	"github.com/chandler-mayo/mcp-video-editor/pkg/server"
	"github.com/joho/godotenv"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Load .env file if exists
	_ = godotenv.Load()

	// Initialize configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Create MCP server
	mcpServer, err := server.NewMCPServer(cfg)
	if err != nil {
		log.Fatalf("Failed to create MCP server: %v", err)
	}

	// Create service layer
	services, err := services.NewServices(cfg, mcpServer)
	if err != nil {
		log.Fatalf("Failed to create services: %v", err)
	}

	// Create Wails bridge
	bridge := wailsbridge.NewBridge(services)

	// Log initialization
	fmt.Fprintln(os.Stderr, "MCP Video Editor Desktop - Starting...")
	fmt.Fprintf(os.Stderr, "FFmpeg initialized successfully\n")
	if cfg.OpenAIKey != "" {
		fmt.Fprintln(os.Stderr, "Agent enabled (OpenAI)")
	}
	if cfg.ClaudeAPIKey != "" {
		fmt.Fprintln(os.Stderr, "Agent enabled (Claude)")
	}
	if cfg.ElevenLabsKey != "" {
		fmt.Fprintln(os.Stderr, "Voice features enabled (ElevenLabs)")
	}

	// Create Wails application
	app := application.New(application.Options{
		Name:        "MCP Video Editor",
		Description: "AI-powered video editing desktop application",
		Services: []application.Service{
			application.NewService(bridge),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Create main window
	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "MCP Video Editor",
		Width:  1440,
		Height: 900,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/",
	})

	// Run the application
	err = app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
