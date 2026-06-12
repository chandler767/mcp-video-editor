# Multi-Take Assemble Smoke

Date: 2026-06-01

## Runtime

- Binary: `bin/mcp-video-editor`
- Codex MCP config: `mcp-video-editor` points to `bin/mcp-video-editor`
- Claude MCP config: `mcp-video-editor` points to the same binary path

## Synthetic Smoke

- Result: passed
- Output: `/Users/vidigal/claude-code/corte/mve-post-followup-smoke-20260601-045450/assembled.mp4`
- Size: 36,200 bytes
- Behavior: `assemble_best_takes` returned success only after the output file existed and was non-empty.

## Wong Smoke

- Result: passed
- Input count: 14 MP4 files
- Output: `/Users/vidigal/claude-code/corte/mve-post-followup-wong-20260601-045511/wong_assembled.mp4`
- Duration: 30.179332 seconds
- Size: 37,538,750 bytes
- Behavior: `assemble_best_takes` produced a real MP4 for the same real-media class that previously returned false success.

## MCP Parity Audit

Codex already had the shared `mcp-video-editor` entry. The following Claude MCP servers were missing in Codex and were added to Codex config without copying raw secret values:

- `cutmaster-ai`
- `davinci-resolve`
- `resolve-mcp-jenkinsm13`
- `resolve-vision`

Servers with Claude-managed environment variables use the local `mcp-from-claude-env.py` wrapper so secrets remain outside Codex config.

## Browser Smoke

- Result: passed
- Target: `http://127.0.0.1:5173/`
- Tool: `agent-browser`
- Checks: homepage rendered, primary controls were visible, Settings opened, and no browser-level render failure was visible in the snapshot.
