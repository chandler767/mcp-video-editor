---
title: Post-PR Clean Test MCP Follow-Up
type: fix
status: active
date: 2026-06-01
---

# Post-PR Clean Test MCP Follow-Up

## Summary

Complete the post-PR follow-up for `mcp-video-editor`: validate PR #1, preserve or update the tracked runtime binary intentionally, resolve the local dirty GPT/vision/backups state, make the remaining test failures actionable, verify the Codex MCP runtime, and document the multi-take workflow and follow-up improvements.

## Problem Frame

The multi-take assemble bug is fixed and PR #1 is open, but the repo still has pre-existing local modifications and test-suite blockers. The next task is to turn that state into a clean, reviewable branch with a clear PR/update path and reproducible MCP validation.

## Assumptions

*This plan was authored without synchronous user confirmation. The items below are agent inferences that fill gaps in the input -- un-validated bets that should be reviewed before implementation proceeds.*

- Work should continue in `mcp-video-editor` on the existing `fix/multitake-assemble-output` branch unless merge permissions require a different path.
- If upstream merge permissions are unavailable, the correct durable result is a PR/body/status update plus a pushed branch, not a forced local workaround.
- Codex/Claude MCP parity may require reading agent config files, but secrets must not be printed, copied, or committed.
- Backups should be preserved by moving them into a repo-local ignored archive or leaving them untracked if deletion would be risky.

## Requirements

- R1. Validate PR #1 state and attempt merge only if permissions allow it without bypassing review safeguards.
- R2. Decide and document tracked `bin/mcp-video-editor` handling so the branch does not accidentally mix unrelated compiled state.
- R3. Resolve the pre-existing GPT/vision source changes into a coherent committed update, separate documentation, or a preserved local state.
- R4. Handle loose backup files so the working tree can become clean without destroying recoverability.
- R5. Fix or isolate the known `go test ./...` blockers: missing `frontend/dist`, stale OpenAI default-model expectation, and ElevenLabs-dependent tests.
- R6. Confirm the MCP server definition used by Codex points at the intended `mcp-video-editor` binary and does not rely on unsafe secret exposure.
- R7. Re-run MCP smoke after any merge/update using `assemble_best_takes` and verify a non-empty MP4 output.
- R8. Add durable docs for the multi-take MCP workflow and record future improvements for take selection and FFmpeg fallback coverage.
- R9. Preserve existing public API names and MCP tool schemas unless a test failure proves a schema bug.

## Scope Boundaries

- Do not print API keys, OAuth tokens, auth JSON, or raw secret-bearing MCP config.
- Do not rewrite the whole multi-take scoring model in this pass; document deeper scoring as follow-up unless it is needed for tests.
- Do not force-push over upstream history or bypass GitHub permission failures.
- Do not delete backup files without first making a reversible archive decision.
- Do not change Codex auth mode or introduce OpenAI API-key auth for Codex.

## Context & Research

### Relevant Code and Patterns

- `docs/plans/2026-06-01-001-fix-multitake-assemble-output-plan.md` records the previous assemble fix.
- `pkg/multitake/manager.go` and `pkg/server/handlers.go` contain the fixed assemble behavior.
- `main.go` embeds `all:frontend/dist`, which currently blocks root-package tests when frontend assets are missing.
- `internal/services/agent/openai_provider.go`, `internal/services/services.go`, and `pkg/vision/analyzer.go` contain pre-existing GPT-5.5 local changes.
- `internal/services/agent/openai_provider_test.go` still expects `gpt-4-turbo-preview`.
- `pkg/audio/*_test.go` currently fails hard when ElevenLabs credentials are absent.
- `pkg/config/config.go` already centralizes ElevenLabs key loading and masked config output.

### Institutional Learnings

- PR #1 was opened from fork `andretoledo1-lang:mcp-video-editor` because direct push to `origin` returned 403.
- GitHub currently reports no checks for PR #1, so local tests and smokes are the main verification signal.

### External References

- None needed for plan-time decisions; this is local repo and GitHub state work.

## Key Technical Decisions

- Keep PR #1 as the integration surface if possible: the branch already carries the assemble fix and can receive follow-up commits.
- Treat `bin/mcp-video-editor` as an intentional release/runtime artifact: commit it only if source changes it depends on are also committed, otherwise keep it local and document why.
- Update stale tests to match deliberate GPT-5.5 defaults if the source changes are coherent and already present; otherwise preserve those changes separately and avoid committing mismatched source.
- Convert external-credential tests to skip when credentials are absent instead of failing a developer's local suite.
- Prefer generating or gating frontend embed assets in a way that lets `go test ./...` run locally without requiring an unrelated frontend build step.

## Open Questions

### Resolved During Planning

- Should merge be forced from local Git? No. GitHub permission state must be respected.
- Should secret-bearing MCP config be copied into the repo? No. Only redacted audit notes or non-secret config changes are acceptable.

### Deferred to Implementation

- Whether `bin/mcp-video-editor` should be committed in this branch depends on whether GPT/vision source changes are committed too.
- Whether the missing frontend asset fix should create a minimal placeholder `frontend/dist` or adjust the embed/build contract depends on the repo's existing frontend structure.
- Whether MCP parity requires Codex config edits depends on the current Claude and Codex MCP definitions.

## Implementation Units

### U1. PR State and Merge Permission Handling

**Goal:** Validate PR #1 and perform only the merge or PR update actions allowed by current GitHub permissions.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: PR body only if merge is not possible or residual state must be recorded.

**Approach:**
- Re-check PR state, mergeability, and checks.
- Attempt merge only through `gh pr merge` if permissions allow it.
- If permission denies merge, keep the PR open and record the blocked merge state in the final handoff or PR body.

**Test scenarios:**
- Integration: PR #1 remains reachable and reports a concrete state.
- Error path: permission-denied merge is captured as an operational blocker, not ignored.

**Verification:**
- `gh pr view 1 --repo chandler767/mcp-video-editor --json state,mergeStateStatus,statusCheckRollup`

### U2. Normalize Pre-Existing GPT/Vision and Binary State

**Goal:** Turn dirty GPT/vision/source/binary state into a coherent branch decision without losing local backup recoverability.

**Requirements:** R2, R3, R4

**Dependencies:** U1

**Files:**
- Modify: `internal/services/agent/openai_provider.go`
- Modify: `internal/services/services.go`
- Modify: `pkg/vision/analyzer.go`
- Modify: `internal/services/agent/openai_provider_test.go`
- Modify: `bin/mcp-video-editor` only if source changes are committed with it.
- Maybe create: `docs/local-backups/README.md` or update `.gitignore` if a repo-local backup archive is used.

**Approach:**
- Inspect the pre-existing diffs and backup files before changing anything.
- If the GPT-5.5 source changes are coherent, update stale tests and include them as a deliberate commit.
- Rebuild the binary only after source/test changes pass.
- Move backups to a durable ignored location only if the repo already ignores that location or a safe `.gitignore` rule is added.

**Test scenarios:**
- Happy path: OpenAI provider tests pass with the intended default model.
- Regression guard: source defaults, tests, and runtime binary agree on the selected model.
- Error path: backup files are not destroyed during cleanup.

**Verification:**
- `go test -count=1 ./internal/services/agent`
- `git status --short`

### U3. Make Full Go Tests Locally Actionable

**Goal:** Remove known local test blockers without weakening real assertions.

**Requirements:** R5, R9

**Dependencies:** U2

**Files:**
- Modify: `main.go` or add minimal frontend asset files under `frontend/dist`
- Modify: `pkg/audio/replacement_test.go`
- Modify: `pkg/audio/tts_test.go`
- Modify: `pkg/audio/voice_management_test.go`

**Approach:**
- Resolve the root embed failure with the smallest repo-consistent frontend asset strategy.
- Convert ElevenLabs credential-dependent tests from hard failures to `t.Skipf` when credentials are absent.
- Keep tests active when credentials are present.

**Test scenarios:**
- Happy path: `go test ./...` reaches package execution instead of failing on missing embed assets.
- Credential absent: ElevenLabs integration tests skip with clear messages.
- Credential present: ElevenLabs tests still run their assertions.

**Verification:**
- `go test ./...`

### U4. Verify MCP/Codex Runtime Parity and Smoke

**Goal:** Confirm Codex calls the intended `mcp-video-editor` runtime and that post-update `assemble_best_takes` still renders a file.

**Requirements:** R6, R7

**Dependencies:** U2, U3

**Files:**
- Maybe modify Codex MCP config only if it is missing or points at the wrong binary.
- Create: `docs/smokes/multitake-assemble-smoke.md`

**Approach:**
- Inspect Claude and Codex MCP server definitions with redaction and no secret output.
- Update Codex MCP config only for non-secret command/path parity if needed.
- Run a synthetic JSON-RPC smoke and, if still available, the Wong smoke.
- Record smoke command shape, output path, duration/size, and result.

**Test scenarios:**
- Integration: Codex MCP entry points to the rebuilt `bin/mcp-video-editor`.
- Integration: `assemble_best_takes` returns success only when output exists and is non-empty.

**Verification:**
- Redacted MCP config audit.
- MCP JSON-RPC smoke output file exists and has size greater than zero.

### U5. Document Workflow and Future Improvements

**Goal:** Leave durable guidance for using multi-take and tracking deeper improvements.

**Requirements:** R8

**Dependencies:** U4

**Files:**
- Create: `docs/multitake-workflow.md`
- Create or update: `docs/follow-ups/multitake-improvements.md`

**Approach:**
- Document the current MCP workflow from project creation through assembly.
- Record follow-up items for smarter take selection, mixed-codec fallback coverage, and broader media compatibility tests.

**Test scenarios:**
- Documentation check: workflow includes the exact MCP tool sequence and expected success/failure behavior.
- Documentation check: future improvements are clearly separated from current shipped behavior.

**Verification:**
- File review and PR diff inspection.

## System-Wide Impact

- **Interaction graph:** GitHub PR state, local working tree, Go tests, tracked runtime binary, and Codex MCP configuration are affected.
- **Error propagation:** Merge or permission failures become explicit blockers; test and smoke failures should fail the pipeline instead of being hidden.
- **State lifecycle risks:** Backup cleanup and config edits must preserve recoverability and avoid secret exposure.
- **API surface parity:** Multi-take MCP API shape should remain stable.
- **Integration coverage:** `go test ./...` plus MCP smokes provide the final confidence signal because PR #1 has no CI checks.
- **Unchanged invariants:** Codex OAuth/native auth must remain unchanged, and raw secrets must not enter logs or commits.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Upstream merge requires write permissions the current GitHub user does not have. | Attempt merge once, then record the permission blocker and keep work pushed through the fork PR. |
| Cleaning backup files could remove useful recovery points. | Move or ignore backups only after reviewing names and preserving recoverability. |
| Committing `bin/mcp-video-editor` can capture unrelated source state. | Commit the binary only when the matching source changes are staged in the same branch. |
| MCP config may contain secrets. | Inspect with redaction and never print or commit secret values. |
| `go test ./...` may reveal additional pre-existing failures after the known blockers are fixed. | Fix only in-scope failures or record durable residuals if they require separate work. |

## Documentation / Operational Notes

- PR body should be updated if merge remains blocked or if local verification becomes the substitute for absent CI.
- Final handoff should list merge state, PR URL, exact tests/smokes run, MCP config parity result, and any remaining residuals.

## Sources & References

- Prior plan: `docs/plans/2026-06-01-001-fix-multitake-assemble-output-plan.md`
- Related code: `main.go`
- Related code: `internal/services/agent/openai_provider.go`
- Related code: `internal/services/services.go`
- Related code: `pkg/vision/analyzer.go`
- Related tests: `internal/services/agent/openai_provider_test.go`
- Related tests: `pkg/audio/replacement_test.go`
- Related tests: `pkg/audio/tts_test.go`
- Related tests: `pkg/audio/voice_management_test.go`
- Related code: `pkg/multitake/manager.go`
- Related code: `pkg/server/handlers.go`
