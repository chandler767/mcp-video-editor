interface AboutDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  if (!isOpen) return null

  const version = '1.0.0'
  const buildDate = new Date().toLocaleDateString()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary">About MCP Video Editor</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-primary transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Logo and Title */}
          <div className="text-center">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-2xl font-bold text-primary mb-2">MCP Video Editor</h3>
            <p className="text-sm text-muted-foreground">
              AI-Powered Professional Video Editing Desktop Application
            </p>
            <div className="mt-4 inline-block bg-secondary px-4 py-2 rounded-full">
              <span className="text-sm font-medium">Version {version}</span>
              <span className="text-xs text-muted-foreground ml-2">• Built {buildDate}</span>
            </div>
          </div>

          {/* Description */}
          <div className="bg-secondary/50 rounded-lg p-4">
            <p className="text-sm text-secondary-foreground leading-relaxed">
              A desktop video editing application powered by AI agents (Claude & OpenAI) with 70+
              professional editing tools via the Model Context Protocol (MCP). Features include visual
              effects, audio editing, voice cloning, timeline management, multi-take assembly, and
              AI-powered vision analysis.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="text-2xl mb-1">🤖</div>
              <h4 className="font-semibold text-sm mb-1">AI Agents</h4>
              <p className="text-xs text-muted-foreground">
                Claude & OpenAI integration with natural language editing
              </p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="text-2xl mb-1">🛠️</div>
              <h4 className="font-semibold text-sm mb-1">70+ Tools</h4>
              <p className="text-xs text-muted-foreground">
                Professional video, audio, and effects operations
              </p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="text-2xl mb-1">⚡</div>
              <h4 className="font-semibold text-sm mb-1">Fast & Native</h4>
              <p className="text-xs text-muted-foreground">
                Wails-powered desktop app with native performance
              </p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="text-2xl mb-1">🎨</div>
              <h4 className="font-semibold text-sm mb-1">Timeline & Presets</h4>
              <p className="text-xs text-muted-foreground">
                Visual timeline with undo/redo and workflow templates
              </p>
            </div>
          </div>

          {/* Credits */}
          <div className="border-t border-border pt-4">
            <h4 className="font-semibold text-sm mb-3">Built With</h4>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="font-medium">Backend</div>
                <div className="text-muted-foreground">Go • Wails v3 • FFmpeg</div>
              </div>
              <div>
                <div className="font-medium">Frontend</div>
                <div className="text-muted-foreground">React • TypeScript • Tailwind</div>
              </div>
              <div>
                <div className="font-medium">AI & APIs</div>
                <div className="text-muted-foreground">Claude • OpenAI • ElevenLabs</div>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center justify-center space-x-6 pt-4">
            <a
              href="https://github.com/chandler767/mcp-video-editor"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <span>GitHub</span>
            </a>
            <a
              href="https://github.com/chandler767/mcp-video-editor/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Report Issue</span>
            </a>
            <a
              href="https://docs.claude.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Documentation</span>
            </a>
          </div>

          {/* Copyright */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
            <p>© 2026 MCP Video Editor. Released under MIT License.</p>
            <p className="mt-1">Built with ❤️ by the MCP community</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 bg-secondary/30">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
