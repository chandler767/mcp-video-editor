# Multi-Take Follow-Up Improvements

## Smarter Take Selection

- Match takes to script sections using transcript similarity once transcripts are reliable enough for the source media.
- Avoid selecting the same take for every section when multiple takes tie on score.
- Preserve deterministic tie-breaking so repeated runs stay reproducible.

## FFmpeg Compatibility Coverage

- Add tests for mixed resolutions, codecs, frame rates, and audio layouts.
- Keep the concat-copy path for fast compatible media, but verify the transcode fallback with intentionally mismatched fixtures.
- Surface FFmpeg fallback details in error messages when both copy and transcode fail.

## Runtime Confidence

- Keep a lightweight JSON-RPC smoke that exercises project creation through final assembly.
- Keep at least one real-media smoke fixture outside the repo for manual verification.
- Consider adding CI coverage once the repository has a stable frontend asset strategy.

