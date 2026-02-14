import Tooltip from '../ui/Tooltip'

interface ImportedFile {
  id: string
  name: string
  size: number
  type: string
  duration?: number
  resolution?: string
  path?: string
}

interface FileListProps {
  files: ImportedFile[]
  onRemoveFile: (id: string) => void
  onSelectFile: (id: string) => void
  selectedFileId?: string
}

export default function FileList({
  files,
  onRemoveFile,
  onSelectFile,
  selectedFileId,
}: FileListProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'Unknown'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getFileIcon = (type: string): string => {
    if (type.startsWith('video/')) return '🎬'
    if (type.startsWith('audio/')) return '🎵'
    return '📄'
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No files imported yet</p>
        <p className="text-sm mt-2">Import files to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <Tooltip content="Click to select and preview this file" placement="left" key={file.id}>
          <div
            onClick={() => onSelectFile(file.id)}
            className={`border rounded-lg p-4 hover:bg-secondary/50 transition-colors cursor-pointer ${
              selectedFileId === file.id
                ? 'border-primary bg-primary/5'
                : 'border-border'
            }`}
          >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1 min-w-0">
              <div className="text-2xl flex-shrink-0">
                {getFileIcon(file.type)}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{file.name}</h4>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(file.size)}</span>
                  {file.duration && (
                    <span>⏱️ {formatDuration(file.duration)}</span>
                  )}
                  {file.resolution && <span>📐 {file.resolution}</span>}
                </div>

                {file.path && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {file.path}
                  </p>
                )}
              </div>
            </div>

            <Tooltip content="Remove file from project">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveFile(file.id)
                }}
                className="ml-2 flex-shrink-0 text-muted-foreground hover:text-red-500 transition-colors p-1"
              >
                ✕
              </button>
            </Tooltip>
          </div>
        </div>
        </Tooltip>
      ))}
    </div>
  )
}
