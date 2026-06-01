---
title: Fix Multi-Take Assemble Output
type: fix
status: active
date: 2026-06-01
---

# Fix Multi-Take Assemble Output

## Summary

Implement the missing render path behind `assemble_best_takes` so a selected multi-take project creates a real video at the requested output path, and make the MCP handler report failure if rendering does not produce a usable file.

## Problem Frame

A live smoke test proved that `assemble_best_takes` can return "Final video assembled successfully" while no output file exists. The multi-take manager currently records project completion but never invokes FFmpeg or validates the requested output.

## Assumptions

*This plan was authored without synchronous user confirmation. The items below are agent inferences that fill gaps in the input -- un-validated bets that should be reviewed before implementation proceeds.*

- The immediate fix should make the existing multi-take API truthful and useful without redesigning transcript, vision, or scoring behavior.
- The tracked `bin/mcp-video-editor` binary should be rebuilt only after source changes pass verification, because current local runtime uses that binary.
- Existing local working-tree changes unrelated to this bug should be preserved and not reverted.

## Requirements

- R1. `assemble_best_takes` must write a real final video to the requested output path when a project has selected best takes with accessible media.
- R2. `assemble_best_takes` must fail loudly when rendering fails, selected media is missing, the output path is invalid, or the output file is absent or empty after FFmpeg exits.
- R3. The final project state must only become `complete` after a usable output file exists.
- R4. The server response must not claim success unless the output file exists and is non-empty.
- R5. The fix must preserve the existing MCP tool names, argument shapes, and success response style.
- R6. The implementation must not change Codex/OpenAI auth, API-key handling, transcript extraction, or vision analysis.

## Scope Boundaries

- Do not rewrite take scoring, transcript matching, or vision-based analysis in this fix.
- Do not change the MCP protocol schema or rename any multi-take tools.
- Do not modify unrelated GPT provider, service wiring, or vision files already dirty in the working tree unless implementation directly requires it.
- Do not change CORTE OTIO workflows; they already produced a valid independent rough-cut proof.

## Context & Research

### Relevant Code and Patterns

- `pkg/multitake/manager.go` owns project persistence, selected takes, and the placeholder `AssembleFinal` method.
- `pkg/server/handlers.go` owns `handleAssembleBestTakes` and currently trusts `AssembleFinal` without checking the filesystem.
- `pkg/video/operations.go` contains the existing FFmpeg concat pattern using a concat list file and `ffmpeg.Manager.Execute`.
- `pkg/ffmpeg/manager.go` is the shared FFmpeg wrapper used by video, audio, visual, transcript, and server code.
- `pkg/video/operations_test.go` and `pkg/server/handlers_test.go` show the repo's current FFmpeg-backed test style with synthetic media in temp directories.

### Institutional Learnings

- None found in-repo for this specific bug; the plan is based on current code inspection and the prior smoke-test failure.

### External References

- None used; the repo already has an FFmpeg concat implementation pattern to follow.

## Key Technical Decisions

- Add FFmpeg capability to the multi-take manager instead of routing assembly through the server handler: this keeps multi-take project state transitions and output validation in the domain owner.
- Reuse the repo's concat-demuxer approach first: it matches existing `concatenate_videos` behavior and keeps the fix small.
- Add post-render filesystem validation in both the manager and handler boundary: the manager protects direct callers, while the handler protects the user-facing MCP success message.
- Preserve project status on render failure: callers should be able to inspect or retry the project instead of seeing a falsely completed state.

## Open Questions

### Resolved During Planning

- Should this be implemented as a full scoring/render redesign? No. The failed smoke test is caused by missing output creation and false success, so the first fix should be narrowly scoped.
- Should CORTE be changed instead? No. CORTE's OTIO proof and FFmpeg render succeeded independently, so the broken surface is `mcp-video-editor`.

### Deferred to Implementation

- Whether concat-demuxer copy succeeds for all real-world mixed-codec inputs: implementation should start with existing repo behavior and only add a fallback if tests or smoke prove it necessary.
- Whether one selected take should be supported without invoking concat: implementation should decide based on FFmpeg behavior and test coverage, but the output must still be a valid video.

## Implementation Units

### U1. Render Selected Takes in the Multi-Take Manager

**Goal:** Replace the placeholder assembly method with real media rendering and output validation.

**Requirements:** R1, R2, R3, R5

**Dependencies:** None

**Files:**
- Modify: `pkg/multitake/manager.go`
- Modify: `pkg/server/server.go`
- Test: `pkg/multitake/manager_test.go`

**Approach:**
- Extend `Manager` so it can execute FFmpeg while preserving the existing `NewManager(baseDir string)` call path.
- Build the selected media list from `project.BestTakes` in order and verify every selected file exists before rendering.
- Ensure the output directory exists, render the selected files into the requested output, and validate that the resulting file exists with size greater than zero.
- Save the project as `complete` only after successful validation.

**Patterns to follow:**
- `pkg/video/operations.go` for concat list file creation and FFmpeg invocation style.
- `pkg/video/operations_test.go` for synthetic MP4 fixtures and FFmpeg availability skips.

**Test scenarios:**
- Happy path: two selected takes with accessible MP4 files produce a non-empty output file and set project status to `complete`.
- Happy path: one selected take produces a non-empty output file and sets project status to `complete`.
- Error path: an empty `BestTakes` list returns an error and does not mark the project complete.
- Error path: a selected take path that does not exist returns an error and does not create a success state.
- Error path: an output path in an invalid or unwritable location returns an error and leaves no false success.

**Verification:**
- `go test ./pkg/multitake`

### U2. Harden the MCP Handler Success Boundary

**Goal:** Make the user-facing `assemble_best_takes` response truthful even if a future manager regression skips output creation.

**Requirements:** R2, R4, R5

**Dependencies:** U1

**Files:**
- Modify: `pkg/server/handlers.go`
- Test: `pkg/server/handlers_test.go`

**Approach:**
- After `AssembleFinal` returns, stat the requested output and return an MCP tool error if the file is missing or empty.
- Keep the existing success text shape when validation passes.

**Patterns to follow:**
- Existing handler error style in `pkg/server/handlers.go`.
- Existing direct handler tests in `pkg/server/handlers_test.go`.

**Test scenarios:**
- Happy path: a valid project assembly returns success text only when the output file exists and is non-empty.
- Error path: an invalid output target returns an MCP tool error rather than success text.
- Regression guard: a missing output after manager return is treated as a user-facing error.

**Verification:**
- `go test ./pkg/server`

### U3. Rebuild and Smoke the Runtime Binary

**Goal:** Ensure the executable used by local MCP smoke tests includes the fix and behaves correctly end-to-end.

**Requirements:** R1, R2, R4, R5, R6

**Dependencies:** U1, U2

**Files:**
- Modify: `bin/mcp-video-editor`

**Approach:**
- Run the package tests first, then rebuild `bin/mcp-video-editor` from the repository's main command.
- Run a lightweight MCP JSON-RPC smoke using generated synthetic clips to verify `create_multi_take_project`, `add_takes_to_project`, `analyze_takes`, `select_best_takes`, and `assemble_best_takes` produce a real output file.
- Re-run the real Wong smoke only if the lightweight smoke passes and the local runtime cost is reasonable.

**Patterns to follow:**
- Existing binary target path `bin/mcp-video-editor`.
- Existing local MCP stdio smoke pattern from the prior failure reproduction.

**Test scenarios:**
- Integration: JSON-RPC `assemble_best_takes` creates the requested MP4 and the file has size greater than zero.
- Integration: invalid output path produces an MCP error result, not success text.

**Verification:**
- `go test ./...`
- `go build -o bin/mcp-video-editor ./cmd/mcp-video-editor`
- Local MCP smoke confirms the requested output file exists and is non-empty.

## System-Wide Impact

- **Interaction graph:** Multi-take server handlers, direct manager callers, and the tracked binary are affected.
- **Error propagation:** FFmpeg and filesystem failures should bubble up from `pkg/multitake` to MCP tool errors without becoming successful text responses.
- **State lifecycle risks:** Project status must not be persisted as `complete` before output validation succeeds.
- **API surface parity:** MCP tool names and arguments remain unchanged.
- **Integration coverage:** Package tests prove domain behavior; JSON-RPC smoke proves the local binary path users call.
- **Unchanged invariants:** Existing single-purpose video operations, transcript extraction, vision analysis, and auth configuration remain outside this fix.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| FFmpeg concat copy can fail for mixed codec or stream layouts. | Start with the repo's existing concat behavior and add a transcode fallback only if verification demonstrates the need. |
| Existing dirty working-tree changes could be accidentally reverted or hidden. | Inspect status before staging and preserve unrelated files. |
| Rebuilding the tracked binary can capture unrelated local source changes. | Report the dirty-state constraint explicitly and stage intentionally. |
| Handler tests may be hard to isolate because the server constructs real FFmpeg dependencies. | Prefer focused manager tests first and add handler coverage at the smallest stable boundary. |

## Documentation / Operational Notes

- No user-facing docs are required for this bug fix unless smoke verification reveals a behavior caveat worth documenting.
- The final handoff should include the plan path, package tests, binary rebuild status, and smoke output path.

## Sources & References

- Related code: `pkg/multitake/manager.go`
- Related code: `pkg/server/handlers.go`
- Related code: `pkg/video/operations.go`
- Related code: `pkg/ffmpeg/manager.go`
- Related tests: `pkg/video/operations_test.go`
- Related tests: `pkg/server/handlers_test.go`
