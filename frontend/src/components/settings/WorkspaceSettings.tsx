import { useState, useEffect } from 'react'
import { BridgeService, isWailsEnvironment } from '../../lib/wails'

interface WorkspaceConfig {
  openaiApiKey?: string
  claudeApiKey?: string
  elevenLabsKey?: string
  agentProvider: 'openai' | 'claude'
  agentModel: string
  ffmpegPath?: string
  ffprobePath?: string
  defaultQuality: 'high' | 'medium' | 'low'
}

export default function WorkspaceSettings() {
  const [config, setConfig] = useState<WorkspaceConfig>({
    agentProvider: 'openai',
    agentModel: 'gpt-4-turbo-preview',
    defaultQuality: 'high',
  })

  const [showKeys, setShowKeys] = useState({
    openai: false,
    claude: false,
    elevenlabs: false,
  })

  useEffect(() => {
    // Load config from backend
    if (isWailsEnvironment()) {
      // TODO: Implement config loading via BridgeService
      // For now, config is managed locally
      console.log('Wails environment detected', BridgeService)
    }
  }, [])

  const maskKey = (key?: string) => {
    if (!key) return ''
    if (key.length <= 8) return '••••••••'
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">AI Provider</h3>

        <div className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Agent Provider
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="provider"
                  value="openai"
                  checked={config.agentProvider === 'openai'}
                  onChange={(e) =>
                    setConfig({ ...config, agentProvider: e.target.value as 'openai' })
                  }
                  className="mr-2"
                />
                OpenAI
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="provider"
                  value="claude"
                  checked={config.agentProvider === 'claude'}
                  onChange={(e) =>
                    setConfig({ ...config, agentProvider: e.target.value as 'claude' })
                  }
                  className="mr-2"
                />
                Claude
              </label>
            </div>
          </div>

          {/* OpenAI API Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              OpenAI API Key
            </label>
            <div className="flex space-x-2">
              <input
                type={showKeys.openai ? 'text' : 'password'}
                value={config.openaiApiKey || ''}
                onChange={(e) =>
                  setConfig({ ...config, openaiApiKey: e.target.value })
                }
                placeholder={showKeys.openai ? 'sk-...' : maskKey(config.openaiApiKey)}
                className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() =>
                  setShowKeys({ ...showKeys, openai: !showKeys.openai })
                }
                className="px-3 py-2 border border-input rounded-md hover:bg-secondary transition-colors"
              >
                {showKeys.openai ? '👁️' : '🔒'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Get your API key from{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                OpenAI Platform
              </a>
            </p>
          </div>

          {/* Claude API Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Claude API Key
            </label>
            <div className="flex space-x-2">
              <input
                type={showKeys.claude ? 'text' : 'password'}
                value={config.claudeApiKey || ''}
                onChange={(e) =>
                  setConfig({ ...config, claudeApiKey: e.target.value })
                }
                placeholder={showKeys.claude ? 'sk-ant-...' : maskKey(config.claudeApiKey)}
                className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() =>
                  setShowKeys({ ...showKeys, claude: !showKeys.claude })
                }
                className="px-3 py-2 border border-input rounded-md hover:bg-secondary transition-colors"
              >
                {showKeys.claude ? '👁️' : '🔒'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Get your API key from{' '}
              <a
                href="https://console.anthropic.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Anthropic Console
              </a>
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Model
            </label>
            <select
              value={config.agentModel}
              onChange={(e) =>
                setConfig({ ...config, agentModel: e.target.value })
              }
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {config.agentProvider === 'openai' ? (
                <>
                  <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </>
              ) : (
                <>
                  <option value="claude-opus-4-20250514">Claude Opus 4</option>
                  <option value="claude-sonnet-3-5-20241022">Claude Sonnet 3.5</option>
                  <option value="claude-haiku-3-5-20241022">Claude Haiku 3.5</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-lg font-semibold mb-4">Advanced Features</h3>

        <div className="space-y-4">
          {/* ElevenLabs API Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              ElevenLabs API Key (Optional)
            </label>
            <div className="flex space-x-2">
              <input
                type={showKeys.elevenlabs ? 'text' : 'password'}
                value={config.elevenLabsKey || ''}
                onChange={(e) =>
                  setConfig({ ...config, elevenLabsKey: e.target.value })
                }
                placeholder={showKeys.elevenlabs ? 'key...' : maskKey(config.elevenLabsKey)}
                className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() =>
                  setShowKeys({ ...showKeys, elevenlabs: !showKeys.elevenlabs })
                }
                className="px-3 py-2 border border-input rounded-md hover:bg-secondary transition-colors"
              >
                {showKeys.elevenlabs ? '👁️' : '🔒'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Required for voice cloning and TTS features
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-lg font-semibold mb-4">System Paths</h3>

        <div className="space-y-4">
          {/* FFmpeg Path */}
          <div>
            <label className="block text-sm font-medium mb-2">
              FFmpeg Path
            </label>
            <input
              type="text"
              value={config.ffmpegPath || ''}
              onChange={(e) =>
                setConfig({ ...config, ffmpegPath: e.target.value })
              }
              placeholder="/usr/local/bin/ffmpeg (auto-detected)"
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty for auto-detection
            </p>
          </div>

          {/* FFprobe Path */}
          <div>
            <label className="block text-sm font-medium mb-2">
              FFprobe Path
            </label>
            <input
              type="text"
              value={config.ffprobePath || ''}
              onChange={(e) =>
                setConfig({ ...config, ffprobePath: e.target.value })
              }
              placeholder="/usr/local/bin/ffprobe (auto-detected)"
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty for auto-detection
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-lg font-semibold mb-4">Default Settings</h3>

        <div className="space-y-4">
          {/* Default Quality */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Default Quality
            </label>
            <select
              value={config.defaultQuality}
              onChange={(e) =>
                setConfig({
                  ...config,
                  defaultQuality: e.target.value as 'high' | 'medium' | 'low',
                })
              }
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="high">High (best quality)</option>
              <option value="medium">Medium (balanced)</option>
              <option value="low">Low (faster processing)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
