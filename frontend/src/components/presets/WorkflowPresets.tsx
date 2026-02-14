import Tooltip from '../ui/Tooltip'

interface Preset {
  id: string
  name: string
  description: string
  icon: string
  category: 'quick' | 'social' | 'professional' | 'audio'
  steps: string[]
}

interface WorkflowPresetsProps {
  onSelectPreset: (preset: Preset) => void
}

export default function WorkflowPresets({ onSelectPreset }: WorkflowPresetsProps) {
  const presets: Preset[] = [
    {
      id: 'quick-trim',
      name: 'Quick Trim',
      description: 'Trim video and optimize for web',
      icon: '✂️',
      category: 'quick',
      steps: [
        'Trim video to desired length',
        'Transcode for web (H.264, optimized bitrate)',
        'Export'
      ]
    },
    {
      id: 'color-correction',
      name: 'Color Correction',
      description: 'Enhance colors, brightness, and contrast',
      icon: '🎨',
      category: 'professional',
      steps: [
        'Apply color grading (saturation +20%)',
        'Adjust brightness (+10%)',
        'Enhance contrast (+15%)',
        'Export'
      ]
    },
    {
      id: 'social-media',
      name: 'Social Media',
      description: 'Optimize for Instagram/TikTok (1080x1080)',
      icon: '📱',
      category: 'social',
      steps: [
        'Resize to 1080x1080 (square)',
        'Add watermark (bottom right)',
        'Compress for social media',
        'Export'
      ]
    },
    {
      id: 'youtube',
      name: 'YouTube Upload',
      description: 'Optimize for YouTube (1080p or 4K)',
      icon: '▶️',
      category: 'social',
      steps: [
        'Ensure 16:9 aspect ratio',
        'Transcode to H.264 (high quality)',
        'Normalize audio',
        'Export'
      ]
    },
    {
      id: 'podcast-edit',
      name: 'Podcast Edit',
      description: 'Extract and enhance audio',
      icon: '🎙️',
      category: 'audio',
      steps: [
        'Extract audio from video',
        'Normalize audio levels',
        'Remove silence (threshold: -40dB)',
        'Export as MP3'
      ]
    },
    {
      id: 'remove-background',
      name: 'Remove Background',
      description: 'Chroma key (green screen removal)',
      icon: '🖼️',
      category: 'professional',
      steps: [
        'Apply chroma key (green)',
        'Adjust similarity and blend',
        'Add new background (optional)',
        'Export'
      ]
    },
    {
      id: 'blur-effect',
      name: 'Blur Effect',
      description: 'Add professional blur',
      icon: '🌫️',
      category: 'professional',
      steps: [
        'Apply Gaussian blur (strength: 10)',
        'Adjust opacity if needed',
        'Export'
      ]
    },
    {
      id: 'add-subtitles',
      name: 'Add Subtitles',
      description: 'Burn subtitles from SRT file',
      icon: '📝',
      category: 'professional',
      steps: [
        'Upload SRT subtitle file',
        'Burn subtitles to video',
        'Customize font and position',
        'Export'
      ]
    },
    {
      id: 'merge-videos',
      name: 'Merge Videos',
      description: 'Concatenate multiple videos',
      icon: '🔗',
      category: 'quick',
      steps: [
        'Select videos to merge',
        'Concatenate in order',
        'Add transitions (optional)',
        'Export'
      ]
    },
    {
      id: 'speed-change',
      name: 'Speed Change',
      description: 'Speed up or slow down video',
      icon: '⏩',
      category: 'quick',
      steps: [
        'Set playback speed (0.5x - 2x)',
        'Adjust audio pitch (optional)',
        'Export'
      ]
    },
    {
      id: 'extract-frames',
      name: 'Extract Frames',
      description: 'Export individual frames as images',
      icon: '📸',
      category: 'professional',
      steps: [
        'Select frame rate (e.g., 1 fps)',
        'Extract frames as PNG/JPEG',
        'Export to folder'
      ]
    },
    {
      id: 'voice-enhance',
      name: 'Voice Enhancement',
      description: 'Improve voice clarity',
      icon: '🎤',
      category: 'audio',
      steps: [
        'Extract audio',
        'Apply noise reduction',
        'Normalize volume',
        'Enhance voice frequencies',
        'Export'
      ]
    }
  ]

  const categories = [
    { id: 'quick', name: 'Quick Actions', color: 'blue' },
    { id: 'social', name: 'Social Media', color: 'purple' },
    { id: 'professional', name: 'Professional', color: 'orange' },
    { id: 'audio', name: 'Audio', color: 'green' }
  ]

  const getCategoryColor = (category: string): string => {
    const colorMap: Record<string, string> = {
      quick: 'border-blue-500 bg-blue-50 text-blue-700',
      social: 'border-purple-500 bg-purple-50 text-purple-700',
      professional: 'border-orange-500 bg-orange-50 text-orange-700',
      audio: 'border-green-500 bg-green-50 text-green-700'
    }
    return colorMap[category] || 'border-gray-500 bg-gray-50 text-gray-700'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Workflow Presets</h2>
        <p className="text-sm text-muted-foreground">
          Quick-start templates for common video editing tasks
        </p>
      </div>

      {categories.map((category) => (
        <div key={category.id}>
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <span
              className={`inline-block w-3 h-3 rounded-full mr-2 border-2 ${getCategoryColor(
                category.id
              )}`}
            ></span>
            {category.name}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {presets
              .filter((p) => p.category === category.id)
              .map((preset) => (
                <Tooltip content={`Click to start ${preset.name} workflow`} placement="top" key={preset.id}>
                  <button
                    onClick={() => onSelectPreset(preset)}
                    className="text-left border border-border rounded-lg p-4 hover:shadow-lg hover:border-primary transition-all group"
                  >
                  <div className="flex items-start space-x-3">
                    <div className="text-3xl group-hover:scale-110 transition-transform">
                      {preset.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold group-hover:text-primary transition-colors">
                        {preset.name}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {preset.description}
                      </p>
                      <div className="mt-3">
                        <details className="text-xs">
                          <summary className="cursor-pointer text-primary hover:underline">
                            View steps
                          </summary>
                          <ul className="mt-2 space-y-1 text-muted-foreground">
                            {preset.steps.map((step, i) => (
                              <li key={i}>
                                {i + 1}. {step}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    </div>
                  </div>
                  </button>
                </Tooltip>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
