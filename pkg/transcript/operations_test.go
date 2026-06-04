package transcript

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestTranscribeFileUsesWhisperBaseURL(t *testing.T) {
	var sawRequest bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/audio/transcriptions" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer local-whisper" {
			t.Fatalf("unexpected auth header: %q", got)
		}
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Fatalf("parse multipart form: %v", err)
		}
		if got := r.FormValue("model"); got != "whisper-1" {
			t.Fatalf("unexpected model: %q", got)
		}
		if got := r.FormValue("response_format"); got != "verbose_json" {
			t.Fatalf("unexpected response format: %q", got)
		}
		sawRequest = true

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"task":"transcribe",
			"language":"en",
			"duration":1.25,
			"text":"hello local whisper",
			"segments":[{"id":0,"start":0,"end":1.25,"text":"hello local whisper"}],
			"words":[{"word":"hello","start":0,"end":0.5},{"word":"local","start":0.5,"end":0.9},{"word":"whisper","start":0.9,"end":1.25}]
		}`))
	}))
	defer server.Close()

	audioPath := filepath.Join(t.TempDir(), "audio.mp3")
	if err := os.WriteFile(audioPath, []byte("not really audio"), 0600); err != nil {
		t.Fatalf("write fake audio: %v", err)
	}

	ops := NewOperationsWithBaseURL("", server.URL+"/v1/", nil)
	transcript, err := ops.transcribeFile(context.Background(), audioPath, "")
	if err != nil {
		t.Fatalf("transcribeFile: %v", err)
	}
	if !sawRequest {
		t.Fatal("local Whisper server was not called")
	}
	if transcript.Text != "hello local whisper" {
		t.Fatalf("unexpected text: %q", transcript.Text)
	}
	if len(transcript.Segments) != 1 {
		t.Fatalf("unexpected segment count: %d", len(transcript.Segments))
	}
	if len(transcript.Segments[0].Words) != 3 {
		t.Fatalf("unexpected word count: %d", len(transcript.Segments[0].Words))
	}
}
