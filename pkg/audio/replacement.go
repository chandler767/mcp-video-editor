package audio

import (
	"context"
	"fmt"
	"math"
	"os"
	"path/filepath"

	"github.com/chandler-mayo/mcp-video-editor/pkg/transcript"
	"github.com/chandler-mayo/mcp-video-editor/pkg/video"
)

// ReplacementOperations orchestrates word replacement in audio/video
type ReplacementOperations struct {
	tts      *TTSOperations
	splice   *SpliceOperations
	trans    *transcript.Operations
	videoOps *video.Operations
}

// ReplaceOptions contains parameters for word replacement
type ReplaceOptions struct {
	VideoPath       string
	TranscriptPath  string // optional, will generate if not provided
	SearchText      string
	ReplacementText string
	VoiceSamplePath string // optional, will extract from video
	VoiceID         string // optional, reuse existing voice
	MatchIndex      int    // which match to replace (-1 for all)
	OutputPath      string
}

// NewReplacementOperations creates a new word replacement orchestrator
func NewReplacementOperations(tts *TTSOperations, splice *SpliceOperations, trans *transcript.Operations, videoOps *video.Operations) *ReplacementOperations {
	return &ReplacementOperations{
		tts:      tts,
		splice:   splice,
		trans:    trans,
		videoOps: videoOps,
	}
}

// ReplaceWord is the main entry point for word replacement
func (r *ReplacementOperations) ReplaceWord(ctx context.Context, opts ReplaceOptions) error {
	// Step 1: Get or generate transcript with word-level timestamps
	var trans *transcript.Transcript
	var err error

	if opts.TranscriptPath != "" {
		trans, err = r.trans.LoadTranscript(opts.TranscriptPath)
		if err != nil {
			return fmt.Errorf("failed to load transcript: %w", err)
		}
	} else {
		trans, err = r.trans.ExtractTranscript(ctx, opts.VideoPath, "")
		if err != nil {
			return fmt.Errorf("failed to extract transcript: %w", err)
		}
	}

	// Step 2: Find word/phrase in transcript
	matches := r.trans.FindInTranscript(trans, opts.SearchText)
	if len(matches) == 0 {
		return fmt.Errorf("word/phrase '%s' not found in transcript", opts.SearchText)
	}

	// Select which matches to replace
	var selectedMatches []transcript.Match
	if opts.MatchIndex == -1 {
		// Replace all occurrences
		selectedMatches = matches
	} else if opts.MatchIndex >= 0 && opts.MatchIndex < len(matches) {
		// Replace specific occurrence
		selectedMatches = []transcript.Match{matches[opts.MatchIndex]}
	} else {
		return fmt.Errorf("match index %d out of range (found %d matches)", opts.MatchIndex, len(matches))
	}

	// Step 3: Get voice ID for TTS
	voiceID := opts.VoiceID
	if voiceID == "" {
		voiceID, err = r.getVoiceIDFromVideo(ctx, opts.VideoPath, opts.VoiceSamplePath, selectedMatches[0])
		if err != nil {
			return fmt.Errorf("failed to get voice ID: %w", err)
		}
	}

	// Step 4: Create temporary directory for processing
	tempDir, err := os.MkdirTemp("", "word-replacement-*")
	if err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(tempDir)

	// Step 5: Extract audio from video
	audioPath := filepath.Join(tempDir, "original_audio.mp3")
	err = r.videoOps.ExtractAudio(ctx, video.ExtractAudioOptions{
		Input:  opts.VideoPath,
		Output: audioPath,
	})
	if err != nil {
		return fmt.Errorf("failed to extract audio: %w", err)
	}

	// Step 6: Replace each selected match
	currentAudioPath := audioPath
	for i, match := range selectedMatches {
		// Generate TTS for replacement text
		ttsPath := filepath.Join(tempDir, fmt.Sprintf("tts_%d.mp3", i))
		err = r.tts.GenerateSpeech(ctx, SpeechOptions{
			Text:    opts.ReplacementText,
			VoiceID: voiceID,
		}, ttsPath)
		if err != nil {
			return fmt.Errorf("failed to generate TTS: %w", err)
		}

		// Replace the audio segment
		nextAudioPath := filepath.Join(tempDir, fmt.Sprintf("replaced_%d.mp3", i))
		err = r.splice.ReplaceSegment(ctx, SpliceOptions{
			InputAudio:      currentAudioPath,
			OutputAudio:     nextAudioPath,
			ReplacementPath: ttsPath,
			StartTime:       match.Start,
			EndTime:         match.End,
			CrossfadeDur:    0.05, // 50ms
		})
		if err != nil {
			return fmt.Errorf("failed to splice audio: %w", err)
		}

		currentAudioPath = nextAudioPath
	}

	// Step 7: Determine if input is video or audio
	isVideo, err := r.isVideoFile(ctx, opts.VideoPath)
	if err != nil {
		return fmt.Errorf("failed to determine file type: %w", err)
	}

	// Step 8: Handle output based on file type
	if isVideo {
		// Re-mux replaced audio with original video
		err = r.remuxVideoWithAudio(ctx, opts.VideoPath, currentAudioPath, opts.OutputPath)
		if err != nil {
			return fmt.Errorf("failed to remux video: %w", err)
		}
	} else {
		// Just copy the replaced audio
		err = r.copyFile(currentAudioPath, opts.OutputPath)
		if err != nil {
			return fmt.Errorf("failed to copy output: %w", err)
		}
	}

	return nil
}

// getVoiceIDFromVideo extracts voice sample and clones voice
func (r *ReplacementOperations) getVoiceIDFromVideo(ctx context.Context, videoPath string, voiceSamplePath string, match transcript.Match) (string, error) {
	// If voice sample path is provided, use it
	if voiceSamplePath != "" {
		return r.tts.GetOrCreateVoiceID(ctx, voiceSamplePath, "Speaker")
	}

	// Extract audio sample from video (30-60 seconds around the target word)
	tempDir, err := os.MkdirTemp("", "voice-sample-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tempDir)

	// Get video info to determine duration
	info, err := r.videoOps.GetVideoInfo(ctx, videoPath)
	if err != nil {
		return "", err
	}

	// Calculate sample extraction time (30s before to 30s after the match)
	sampleStart := math.Max(0, match.Start-15.0)
	sampleEnd := math.Min(info.Duration, match.Start+45.0)

	// Extract audio sample
	samplePath := filepath.Join(tempDir, "voice_sample.mp3")
	endTime := sampleEnd
	err = r.videoOps.Trim(ctx, video.TrimOptions{
		Input:     videoPath,
		Output:    samplePath,
		StartTime: sampleStart,
		EndTime:   &endTime,
	})
	if err != nil {
		return "", fmt.Errorf("failed to extract voice sample: %w", err)
	}

	// Extract just the audio from the trimmed segment
	audioSamplePath := filepath.Join(tempDir, "voice_sample_audio.mp3")
	err = r.videoOps.ExtractAudio(ctx, video.ExtractAudioOptions{
		Input:  samplePath,
		Output: audioSamplePath,
	})
	if err != nil {
		return "", fmt.Errorf("failed to extract audio from sample: %w", err)
	}

	// Clone voice
	return r.tts.GetOrCreateVoiceID(ctx, audioSamplePath, "Speaker")
}

// isVideoFile checks if file is video (vs audio only)
func (r *ReplacementOperations) isVideoFile(ctx context.Context, filePath string) (bool, error) {
	info, err := r.videoOps.GetVideoInfo(ctx, filePath)
	if err != nil {
		return false, err
	}
	return info.Width > 0 && info.Height > 0, nil
}

// remuxVideoWithAudio combines original video with replaced audio
func (r *ReplacementOperations) remuxVideoWithAudio(ctx context.Context, videoPath, audioPath, outputPath string) error {
	args := []string{
		"-i", videoPath,
		"-i", audioPath,
		"-c:v", "copy",        // Copy video stream (no re-encoding)
		"-c:a", "aac",         // Re-encode audio to AAC
		"-map", "0:v:0",       // Map video from first input
		"-map", "1:a:0",       // Map audio from second input
		"-shortest",           // End when shortest stream ends
		"-y",
		outputPath,
	}

	return r.videoOps.GetFFmpegManager().Execute(ctx, args...)
}

// copyFile copies a file from src to dst
func (r *ReplacementOperations) copyFile(src, dst string) error {
	input, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, input, 0644)
}
