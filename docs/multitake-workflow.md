# Multi-Take MCP Workflow

This document records the current MCP tool sequence for assembling a multi-take video.

## Tool Sequence

1. `create_multi_take_project` creates a project from a newline-separated script.
2. `add_takes_to_project` adds source video paths to the project.
3. `analyze_takes` marks accessible takes as analyzed and assigns the current simplified score.
4. `select_best_takes` records one selected take for each script section.
5. `assemble_best_takes` renders the selected takes to the requested output path.

## Success Contract

`assemble_best_takes` only returns success after the requested output file exists and is non-empty. Render failures, missing selected media, empty output paths, directory outputs, and missing output files return MCP tool errors.

## Current Selection Behavior

Take scoring is intentionally simple in the current implementation. Accessible takes receive the same default score, so selection may reuse the first highest-scoring take across sections. Smarter section-to-take matching is tracked as follow-up work.

## Minimal JSON-RPC Flow

```json
{"name":"create_multi_take_project","arguments":{"name":"demo","script":"opening\nclosing"}}
{"name":"add_takes_to_project","arguments":{"projectId":"<project-id>","takePaths":["/path/take1.mp4","/path/take2.mp4"]}}
{"name":"analyze_takes","arguments":{"projectId":"<project-id>"}}
{"name":"select_best_takes","arguments":{"projectId":"<project-id>"}}
{"name":"assemble_best_takes","arguments":{"projectId":"<project-id>","output":"/path/final.mp4"}}
```

