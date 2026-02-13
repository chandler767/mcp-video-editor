package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/chandler-mayo/mcp-video-editor/pkg/config"
	"github.com/chandler-mayo/mcp-video-editor/pkg/server"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if exists
	_ = godotenv.Load()

	// Initialize configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Create MCP server
	srv, err := server.NewMCPServer(cfg)
	if err != nil {
		log.Fatalf("Failed to create MCP server: %v", err)
	}

	// Log initialization
	fmt.Fprintln(os.Stderr, "MCP Video Editor (Go) - Starting...")
	fmt.Fprintf(os.Stderr, "FFmpeg initialized successfully\n")
	if cfg.OpenAIKey != "" {
		fmt.Fprintln(os.Stderr, "Transcript and vision features enabled (OpenAI API key configured)")
	} else {
		fmt.Fprintln(os.Stderr, "Transcript and vision features disabled (no OpenAI API key)")
	}

	// Start server
	ctx := context.Background()
	if err := srv.Start(ctx); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
