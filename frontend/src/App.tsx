import { useState, useEffect } from 'react'
import ChatDialog from './components/chat/ChatDialog'
import SettingsDialog from './components/settings/SettingsDialog'
import AboutDialog from './components/about/AboutDialog'
import KeyboardShortcutsHelp from './components/keyboard/KeyboardShortcutsHelp'
import Timeline from './components/timeline/Timeline'
import VideoPreview from './components/video/VideoPreview'
import FileImportZone from './components/import/FileImportZone'
import FileList from './components/import/FileList'
import WorkflowPresets from './components/presets/WorkflowPresets'
import RecentFilesList from './components/recent/RecentFilesList'
import LogsViewer from './components/logs/LogsViewer'
import Tooltip from './components/ui/Tooltip'
import { useKeyboardShortcuts, KeyboardShortcut } from './lib/hooks/useKeyboardShortcuts'
import { useRecentFiles, RecentFile } from './lib/hooks/useRecentFiles'
import { logger } from './lib/hooks/useLogs'

type View = 'chat' | 'timeline' | 'import' | 'presets' | 'logs'

interface ImportedFile {
  id: string
  name: string
  size: number
  type: string
  duration?: number
  resolution?: string
  path?: string
}

interface Operation {
  id: string
  name: string
  type: string
  timestamp: number
  status: 'success' | 'failed' | 'pending'
  input?: string
  output?: string
  parameters?: Record<string, any>
  error?: string
}

function App() {
  const [activeView, setActiveView] = useState<View>('chat')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<string>()
  const [operations] = useState<Operation[]>([])
  const [currentVideoPath, setCurrentVideoPath] = useState<string>()

  // Log app initialization
  useEffect(() => {
    logger.info('MCP Video Editor started', 'App', { version: '1.0.0' })
  }, [])

  // Define keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    {
      key: '1',
      metaKey: true,
      description: 'Switch to Chat view',
      action: () => setActiveView('chat'),
    },
    {
      key: '2',
      metaKey: true,
      description: 'Switch to Timeline view',
      action: () => setActiveView('timeline'),
    },
    {
      key: '3',
      metaKey: true,
      description: 'Switch to Files view',
      action: () => setActiveView('import'),
    },
    {
      key: '4',
      metaKey: true,
      description: 'Switch to Presets view',
      action: () => setActiveView('presets'),
    },
    {
      key: '5',
      metaKey: true,
      description: 'Switch to Logs view',
      action: () => setActiveView('logs'),
    },
    {
      key: ',',
      metaKey: true,
      description: 'Open settings',
      action: () => setIsSettingsOpen(true),
    },
    {
      key: '?',
      shiftKey: true,
      description: 'Show keyboard shortcuts help',
      action: () => setIsHelpOpen(true),
      preventDefault: false,
    },
    {
      key: 'F1',
      description: 'Show keyboard shortcuts help',
      action: () => setIsHelpOpen(true),
    },
    {
      key: 'Escape',
      description: 'Close dialogs',
      action: () => {
        setIsSettingsOpen(false)
        setIsAboutOpen(false)
        setIsHelpOpen(false)
      },
      preventDefault: false,
    },
  ]

  // Enable keyboard shortcuts
  useKeyboardShortcuts(shortcuts)

  // Recent files management
  const { recentFiles, addRecentFile, removeRecentFile, clearRecentFiles } = useRecentFiles()

  const handleFilesAdded = (files: File[]) => {
    const newFiles: ImportedFile[] = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      // In production, these would be extracted from the file
      duration: undefined,
      resolution: undefined,
      path: URL.createObjectURL(file),
    }))
    setImportedFiles((prev) => [...prev, ...newFiles])

    // Add to recent files
    newFiles.forEach((file) => {
      addRecentFile({
        id: file.id,
        name: file.name,
        path: file.path!,
        size: file.size,
        type: file.type,
      })
    })
  }

  const handleRemoveFile = (id: string) => {
    setImportedFiles((prev) => prev.filter((f) => f.id !== id))
    if (selectedFileId === id) {
      setSelectedFileId(undefined)
      setCurrentVideoPath(undefined)
    }
  }

  const handleSelectFile = (id: string) => {
    setSelectedFileId(id)
    const file = importedFiles.find((f) => f.id === id)
    if (file?.path) {
      setCurrentVideoPath(file.path)
    }
  }

  const handleOperationClick = (operation: Operation) => {
    // In production, this would jump to the operation output
    if (operation.output) {
      setCurrentVideoPath(operation.output)
    }
  }

  const handlePresetSelect = (preset: any) => {
    // In production, this would execute the preset workflow
    console.log('Selected preset:', preset)
    // Could integrate with chat to send a message like:
    // "Execute the ${preset.name} workflow"
  }

  const handleRecentFileSelect = (file: RecentFile) => {
    // Check if file is already imported
    const existing = importedFiles.find((f) => f.path === file.path)
    if (existing) {
      handleSelectFile(existing.id)
    } else {
      // Add to imported files
      const importedFile: ImportedFile = {
        id: file.id,
        name: file.name,
        size: file.size || 0,
        type: file.type || '',
        path: file.path,
      }
      setImportedFiles((prev) => [...prev, importedFile])
      setSelectedFileId(file.id)
      setCurrentVideoPath(file.path)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Top Navigation Bar */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-background">
        <div className="flex items-center space-x-6">
          <h1 className="text-xl font-bold text-primary">MCP Video Editor</h1>

          <nav className="flex space-x-1">
            <Tooltip content="Chat with AI agent to edit videos (⌘+1)">
              <button
                onClick={() => setActiveView('chat')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  activeView === 'chat'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-secondary text-muted-foreground'
                }`}
              >
                💬 Chat
              </button>
            </Tooltip>
            <Tooltip content="View operation history and timeline (⌘+2)">
              <button
                onClick={() => setActiveView('timeline')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  activeView === 'timeline'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-secondary text-muted-foreground'
                }`}
              >
                📋 Timeline
              </button>
            </Tooltip>
            <Tooltip content="Import and manage video files (⌘+3)">
              <button
                onClick={() => setActiveView('import')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  activeView === 'import'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-secondary text-muted-foreground'
                }`}
              >
                📁 Files
              </button>
            </Tooltip>
            <Tooltip content="Quick-start workflow templates (⌘+4)">
              <button
                onClick={() => setActiveView('presets')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  activeView === 'presets'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-secondary text-muted-foreground'
                }`}
              >
                ⚡ Presets
              </button>
            </Tooltip>
            <Tooltip content="View application logs for debugging (⌘+5)">
              <button
                onClick={() => setActiveView('logs')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  activeView === 'logs'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-secondary text-muted-foreground'
                }`}
              >
                📋 Logs
              </button>
            </Tooltip>
          </nav>
        </div>

        <div className="flex items-center space-x-2">
          <Tooltip content="View keyboard shortcuts (? or F1)">
            <button
              onClick={() => setIsHelpOpen(true)}
              className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors"
            >
              ⌨️
            </button>
          </Tooltip>
          <Tooltip content="About this application">
            <button
              onClick={() => setIsAboutOpen(true)}
              className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors"
            >
              ℹ️
            </button>
          </Tooltip>
          <Tooltip content="Application settings (⌘,)">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors"
            >
              ⚙️ Settings
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Views */}
        <div className="flex-1 overflow-hidden">
          {activeView === 'chat' && (
            <ChatDialog />
          )}

          {activeView === 'timeline' && (
            <div className="h-full overflow-y-auto p-6">
              <Timeline
                operations={operations}
                onOperationClick={handleOperationClick}
                onUndo={() => console.log('Undo')}
                onRedo={() => console.log('Redo')}
                canUndo={operations.length > 0}
                canRedo={false}
              />
            </div>
          )}

          {activeView === 'import' && (
            <div className="h-full overflow-y-auto p-6 space-y-6">
              <FileImportZone onFilesAdded={handleFilesAdded} />

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Imported Files ({importedFiles.length})
                </h3>
                <FileList
                  files={importedFiles}
                  onRemoveFile={handleRemoveFile}
                  onSelectFile={handleSelectFile}
                  selectedFileId={selectedFileId}
                />
              </div>

              <div className="border-t border-border pt-6">
                <RecentFilesList
                  files={recentFiles}
                  onSelectFile={handleRecentFileSelect}
                  onRemoveFile={removeRecentFile}
                  onClearAll={clearRecentFiles}
                />
              </div>
            </div>
          )}

          {activeView === 'presets' && (
            <div className="h-full overflow-y-auto p-6">
              <WorkflowPresets onSelectPreset={handlePresetSelect} />
            </div>
          )}

          {activeView === 'logs' && (
            <LogsViewer />
          )}
        </div>

        {/* Right Panel - Video Preview */}
        <div className="w-[480px] border-l border-border p-4 overflow-y-auto bg-secondary/20">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">
              Video Preview
            </h3>
          </div>
          <VideoPreview videoPath={currentVideoPath} />

          {currentVideoPath && (
            <div className="mt-4 p-3 bg-background border border-border rounded-lg">
              <h4 className="text-sm font-semibold mb-2">Current File</h4>
              <p className="text-xs text-muted-foreground break-all">
                {currentVideoPath}
              </p>
            </div>
          )}

          {!currentVideoPath && (
            <div className="mt-4 p-4 bg-background border border-dashed border-border rounded-lg text-center text-muted-foreground">
              <p className="text-sm">No video loaded</p>
              <p className="text-xs mt-1">Import or create a video to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* About Dialog */}
      <AboutDialog
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        shortcuts={shortcuts}
      />
    </div>
  )
}

export default App
