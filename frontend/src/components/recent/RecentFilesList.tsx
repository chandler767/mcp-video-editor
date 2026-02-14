import { RecentFile, formatFileSize, formatTimestamp } from '../../lib/hooks/useRecentFiles'

interface RecentFilesListProps {
  files: RecentFile[]
  onSelectFile: (file: RecentFile) => void
  onRemoveFile: (path: string) => void
  onClearAll: () => void
}

export default function RecentFilesList({
  files,
  onSelectFile,
  onRemoveFile,
  onClearAll,
}: RecentFilesListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="text-4xl mb-3">📄</div>
        <p className="text-sm">No recent files</p>
        <p className="text-xs mt-1">Files you open will appear here</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent Files ({files.length})</h3>
        {files.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.path}
            className="group flex items-center justify-between p-3 bg-secondary/30 hover:bg-secondary/50 rounded-lg transition-colors cursor-pointer"
            onClick={() => onSelectFile(file)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <div className="text-2xl">
                  {file.type?.startsWith('video/') ? '🎬' : '📄'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{file.name}</h4>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                    <span>{formatTimestamp(file.timestamp)}</span>
                    {file.size && (
                      <>
                        <span>•</span>
                        <span>{formatFileSize(file.size)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-2 truncate font-mono">
                {file.path}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemoveFile(file.path)
              }}
              className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 p-2"
              title="Remove from recent files"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-secondary/20 rounded-lg">
        <p className="text-xs text-muted-foreground">
          💡 <strong>Tip:</strong> Recent files are saved locally and persist across sessions.
          Click on any file to quickly reopen it.
        </p>
      </div>
    </div>
  )
}
