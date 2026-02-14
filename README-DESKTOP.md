# MCP Video Editor - Desktop Application

## Architecture Overview

We've built a **service-oriented architecture** where the AI agent runs entirely in the Go backend and communicates with the MCP tools. The frontend is a simple chat interface.

```
┌─────────────────────────────────────────────────────────┐
│                  FRONTEND (React)                        │
│              Simple Chat Interface                       │
│         - Send messages to agent                         │
│         - Display responses                              │
│         - Show tool execution status                     │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Wails Bindings
                  │
┌─────────────────▼───────────────────────────────────────┐
│           TRANSPORT LAYER (Wails)                        │
│         internal/transport/wails/bridge.go               │
│    - SendMessage(message string)                         │
│    - GetConversationHistory()                            │
│    - ClearConversation()                                 │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│              SERVICES LAYER (Go)                         │
│          internal/services/services.go                   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │     AGENT ORCHESTRATOR (Go)                     │    │
│  │  internal/services/agent/orchestrator.go        │    │
│  │                                                   │    │
│  │  - Manages conversation loop                     │    │
│  │  - Calls Claude/OpenAI APIs                      │    │
│  │  - Executes MCP tools                            │    │
│  │  - Returns streaming responses                   │    │
│  │                                                   │    │
│  │  ┌─────────────┐      ┌──────────────┐          │    │
│  │  │   Claude    │      │   OpenAI     │          │    │
│  │  │  Provider   │      │   Provider   │          │    │
│  │  └─────────────┘      └──────────────┘          │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                                │
│                          ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │           MCP SERVER (Go)                        │    │
│  │    70+ Video Editing Tools                       │    │
│  │  - Video ops (trim, concat, resize)              │    │
│  │  - Visual FX (blur, color grade, chroma key)     │    │
│  │  - Audio ops (mix, normalize, TTS)               │    │
│  │  - Timeline (undo/redo)                          │    │
│  │  - Multi-take editing                            │    │
│  │  - Vision analysis (GPT-4)                       │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

## What We Built

### ✅ Backend (Complete)

#### 1. Service Layer (`internal/services/`)
- **Transport-agnostic** - Can support Wails, HTTP API, or any frontend
- **Agent Orchestrator** - Manages AI conversation loop
- **Provider Interface** - Pluggable Claude/OpenAI support
- **Message Types** - Structured conversation history

#### 2. Agent System (`internal/services/agent/`)
- **`orchestrator.go`** - Main conversation loop with tool execution
- **`claude_provider.go`** - Claude integration (stub - needs SDK implementation)
- **`openai_provider.go`** - OpenAI integration (stub - needs SDK implementation)
- **`types.go`** - Message, ToolCall, ToolResult types

#### 3. Wails Transport (`internal/transport/wails/`)
- **`bridge.go`** - Thin wrapper exposing services to React
- Methods: `SendMessage()`, `GetConversationHistory()`, `ClearConversation()`

#### 4. MCP Server Enhancements (`pkg/server/`)
- **`ExecuteToolDirect()`** - Direct tool execution (bypasses JSON-RPC)
- **`GetToolDefinitions()`** - Returns all 70+ tool schemas
- **Tool registry** - Internal tracking of all registered tools

#### 5. Configuration (`pkg/config/`)
- **New fields added:**
  - `ClaudeAPIKey` - For Claude API
  - `AgentProvider` - "claude" or "openai"
  - `AgentModel` - Specific model to use
  - `LastProjectDir` - Remember last project location

#### 6. Desktop Entry Point (`cmd/desktop/main.go`)
- Initializes services layer
- Creates Wails app
- Configures window (1440x900)
- Embeds React frontend

### 🚧 Frontend (Basic Structure)

#### Created Files:
- **`frontend/package.json`** - Dependencies installed ✅
- **`frontend/vite.config.ts`** - Vite configuration ✅
- **`frontend/tailwind.config.ts`** - Orange/gray theme ✅
- **`frontend/src/App.tsx`** - Basic app shell ✅
- **`frontend/src/styles/globals.css`** - Theme colors ✅

#### Directory Structure:
```
frontend/src/
├── components/
│   ├── chat/          # Chat interface (TODO)
│   ├── video/         # Video preview (TODO)
│   ├── timeline/      # Timeline view (TODO)
│   ├── settings/      # Settings UI (TODO)
│   └── ui/            # Reusable components (TODO)
├── lib/
│   ├── hooks/         # React hooks (TODO)
│   └── store/         # State management (TODO)
└── styles/
    └── globals.css    # ✅ Theme defined
```

## What Needs to Be Done

### 1. Implement Claude Provider (Priority 1)

```go
// internal/services/agent/claude_provider.go
func (p *ClaudeProvider) SendMessage(ctx context.Context, messages []Message, tools []mcp.Tool) (<-chan SendMessageResponse, error) {
    // Use github.com/anthropics/anthropic-sdk-go
    // Convert messages to Claude format
    // Convert MCP tools to Claude tool format
    // Stream responses
    // Handle tool calls
}
```

### 2. Implement OpenAI Provider (Priority 2)

```go
// internal/services/agent/openai_provider.go
func (p *OpenAIProvider) SendMessage(ctx context.Context, messages []Message, tools []mcp.Tool) (<-chan SendMessageResponse, error) {
    // Use official OpenAI SDK
    // Convert messages to OpenAI format
    // Convert MCP tools to function calling format
    // Stream responses
    // Handle function calls
}
```

### 3. Build Chat UI (Priority 3)

```typescript
// frontend/src/components/chat/ChatDialog.tsx
// - Message list with user/assistant bubbles
// - Input field with send button
// - Tool call visualization
// - Streaming response display
// - Auto-scroll to bottom
```

### 4. Wire Wails Bindings (Priority 4)

```typescript
// frontend/src/lib/wails.ts
import { SendMessage, GetConversationHistory } from '../../wailsjs/go/wails/Bridge'

// Use generated bindings from Wails
```

### 5. Test End-to-End (Priority 5)

```bash
# Build and run
wails3 dev

# Test flow:
# 1. User types: "Extract info from video.mp4"
# 2. Agent receives message
# 3. Agent calls get_video_info tool
# 4. Tool executes FFmpeg
# 5. Result returned to agent
# 6. Agent responds to user
```

## Current Project State

### Files Created: 30+
### Lines of Code: ~2000+
### Architecture: ✅ Complete
### Backend Logic: ✅ Complete (providers need SDK integration)
### Frontend: 🚧 Basic structure only

## Next Session Plan

1. **Implement Claude Provider** (~30 min)
   - Use Anthropic SDK
   - Handle streaming
   - Convert tool formats

2. **Implement OpenAI Provider** (~30 min)
   - Use OpenAI SDK
   - Handle function calling
   - Convert tool formats

3. **Build Chat UI** (~45 min)
   - Message list component
   - Input component
   - Tool call cards
   - Streaming display

4. **Wire Everything Together** (~15 min)
   - Generate Wails bindings
   - Connect React to Go
   - Test messaging flow

5. **Test & Debug** (~30 min)
   - Send test messages
   - Verify tool execution
   - Check streaming works
   - Fix any bugs

**Total Estimated Time: ~2.5 hours to MVP**

## Key Design Decisions

### Why Agent in Go Backend?
1. **Simpler frontend** - Just a chat UI, no complex logic
2. **Reusable service layer** - Can add HTTP API later
3. **Better security** - API keys stay server-side
4. **Easier testing** - Test agent logic without UI
5. **Transport agnostic** - Can support web, mobile, CLI

### Why Service Layer?
1. **Separation of concerns** - Business logic separate from transport
2. **Testability** - Can test services without Wails
3. **Flexibility** - Easy to add REST API, gRPC, etc.
4. **Maintainability** - Clear boundaries between layers

### Why Wails v3?
1. **Small bundle** - ~15MB vs 100MB for Electron
2. **Native performance** - Uses system WebView
3. **Type-safe bindings** - Go functions accessible from TypeScript
4. **Single binary** - Easy distribution
5. **Cross-platform** - macOS, Windows, Linux

## Configuration

### Environment Variables
```bash
# Required for agent
export CLAUDE_API_KEY="sk-ant-..."
# OR
export OPENAI_API_KEY="sk-..."

# Required for video ops
export FFMPEG_PATH="/usr/local/bin/ffmpeg"
export FFPROBE_PATH="/usr/local/bin/ffprobe"

# Optional
export ELEVENLABS_API_KEY="..."  # For voice features
```

### Config File
`~/.mcp-video-config.json`
```json
{
  "claudeApiKey": "sk-ant-...",
  "openaiApiKey": "sk-...",
  "elevenLabsApiKey": "...",
  "agentProvider": "claude",
  "agentModel": "claude-opus-4-6",
  "defaultQuality": "high",
  "lastProjectDir": "/path/to/projects"
}
```

## Building the App

```bash
# Development (hot reload)
wails3 dev

# Production build
wails3 build

# Outputs:
# - macOS: build/bin/MCP-Video-Editor.app
# - Windows: build/bin/MCP-Video-Editor.exe
# - Linux: build/bin/mcp-video-editor
```

## Architecture Benefits

1. **Future-proof**: Can add web interface using same service layer
2. **Testable**: Each layer can be tested independently
3. **Maintainable**: Clear separation of concerns
4. **Scalable**: Agent orchestrator can handle complex workflows
5. **Flexible**: Easy to swap providers or add new ones
6. **Secure**: API keys and sensitive data stay in Go backend

## Dependencies

### Go
- `github.com/wailsapp/wails/v3` - Desktop framework
- `github.com/anthropics/anthropic-sdk-go` - Claude API (added)
- `github.com/mark3labs/mcp-go` - MCP protocol
- `github.com/chandler-mayo/mcp-video-editor/pkg/*` - Existing packages

### Frontend
- `react` - UI framework
- `vite` - Build tool
- `tailwindcss` - Styling
- Wails runtime (auto-generated bindings)

## Timeline of Work

### Phase 1: Foundation ✅
- Wails project structure
- Service layer architecture
- Agent orchestrator
- Provider interface
- Config updates
- Desktop entry point

### Phase 2: Implementation 🚧 (Next)
- Claude provider with SDK
- OpenAI provider with SDK
- Chat UI components
- Wails bindings

### Phase 3: Features 📋 (Future)
- Video preview component
- Timeline visualization
- Project management
- Settings UI
- File import
- Workflow presets

### Phase 4: Polish 📋 (Future)
- Animations
- Error handling
- Loading states
- Keyboard shortcuts
- Auto-updater
- Distribution packages

## Summary

We've successfully created a **production-ready architecture** for an AI-powered video editing desktop application. The agent orchestrator runs in Go, providing a clean separation between business logic and UI. The service layer is transport-agnostic, making it easy to add web or mobile interfaces in the future.

**What's working:**
- ✅ Complete backend architecture
- ✅ Service layer with agent orchestrator
- ✅ MCP server integration (70+ tools)
- ✅ Configuration management
- ✅ Desktop app structure

**What needs implementation:**
- ⏳ Claude/OpenAI SDK integration
- ⏳ Chat UI components
- ⏳ Wails bindings connection
- ⏳ End-to-end testing

**Estimated time to working MVP: 2-3 hours**
