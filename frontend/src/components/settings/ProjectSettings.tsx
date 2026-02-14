import { useState } from 'react'

interface ProjectConfig {
  name: string
  description: string
  outputDirectory: string
  defaultFormat: string
  defaultCodec: string
  autoSave: boolean
  autoSaveInterval: number
}

export default function ProjectSettings() {
  const [config, setConfig] = useState<ProjectConfig>({
    name: 'Untitled Project',
    description: '',
    outputDirectory: '',
    defaultFormat: 'mp4',
    defaultCodec: 'h264',
    autoSave: true,
    autoSaveInterval: 300,
  })

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Project Information</h3>

        <div className="space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="My Video Project"
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Project Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={config.description}
              onChange={(e) =>
                setConfig({ ...config, description: e.target.value })
              }
              placeholder="Describe your project..."
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-lg font-semibold mb-4">Output Settings</h3>

        <div className="space-y-4">
          {/* Output Directory */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Output Directory
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={config.outputDirectory}
                onChange={(e) =>
                  setConfig({ ...config, outputDirectory: e.target.value })
                }
                placeholder="~/Videos/Exports"
                className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button className="px-4 py-2 border border-input rounded-md hover:bg-secondary transition-colors">
                Browse
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Default location for exported videos
            </p>
          </div>

          {/* Default Format */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Default Format
            </label>
            <select
              value={config.defaultFormat}
              onChange={(e) =>
                setConfig({ ...config, defaultFormat: e.target.value })
              }
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="mp4">MP4 (recommended)</option>
              <option value="mov">MOV</option>
              <option value="avi">AVI</option>
              <option value="mkv">MKV</option>
              <option value="webm">WebM</option>
            </select>
          </div>

          {/* Default Codec */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Default Video Codec
            </label>
            <select
              value={config.defaultCodec}
              onChange={(e) =>
                setConfig({ ...config, defaultCodec: e.target.value })
              }
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="h264">H.264 (recommended)</option>
              <option value="h265">H.265 (HEVC)</option>
              <option value="vp9">VP9</option>
              <option value="prores">ProRes</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-lg font-semibold mb-4">Timeline Settings</h3>

        <div className="space-y-4">
          {/* Auto Save */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium">
                Auto-Save Timeline
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Automatically save timeline state
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoSave}
                onChange={(e) =>
                  setConfig({ ...config, autoSave: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Auto Save Interval */}
          {config.autoSave && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Auto-Save Interval (seconds)
              </label>
              <input
                type="number"
                min="30"
                max="600"
                step="30"
                value={config.autoSaveInterval}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    autoSaveInterval: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-lg font-semibold mb-4">Project Actions</h3>

        <div className="space-y-3">
          <button className="w-full px-4 py-2 border border-input rounded-md hover:bg-secondary transition-colors text-left">
            📁 Export Project as JSON
          </button>
          <button className="w-full px-4 py-2 border border-input rounded-md hover:bg-secondary transition-colors text-left">
            📥 Import Project from JSON
          </button>
          <button className="w-full px-4 py-2 border border-red-500 text-red-500 rounded-md hover:bg-red-50 transition-colors text-left">
            🗑️ Delete Project
          </button>
        </div>
      </div>
    </div>
  )
}
