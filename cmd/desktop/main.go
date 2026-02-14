package main

import (
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

// Note: Assets are handled by Wails build system.
// During development (wails dev), frontend is served from dev server.
// During production build (wails build), assets are automatically embedded.

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

	// Log initialization
	fmt.Fprintln(os.Stderr, "MCP Video Editor Desktop - Starting...")
	fmt.Fprintf(os.Stderr, "FFmpeg initialized successfully\n")
	if cfg.OpenAIKey != "" {
		fmt.Fprintln(os.Stderr, "Agent enabled (OpenAI)")
	}
	if cfg.ElevenLabsKey != "" {
		fmt.Fprintln(os.Stderr, "Voice features enabled (ElevenLabs)")
	}

	// Create Wails application
	// Note: In development mode, assets are served from the dev server.
	// In production builds, Wails automatically handles asset embedding.
	app := application.New(application.Options{
		Name:        "MCP Video Editor",
		Description: "AI-powered video editing desktop application",
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Create Wails bridge (needs app reference for dialogs)
	bridge := wailsbridge.NewBridge(app, services)

	// Register bridge as a service
	app.RegisterService(application.NewService(bridge))

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
