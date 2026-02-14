import { useState, useCallback } from 'react'
import Tooltip from '../ui/Tooltip'

interface FileImportZoneProps {
  onFilesAdded: (files: File[]) => void
}

export default function FileImportZone({ onFilesAdded }: FileImportZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files).filter((file) => {
        // Accept video and audio files
        return (
          file.type.startsWith('video/') ||
          file.type.startsWith('audio/') ||
          file.name.match(/\.(mp4|mov|avi|mkv|webm|mp3|wav|flac|m4a)$/i)
        )
      })

      if (files.length > 0) {
        onFilesAdded(files)
      }
    },
    [onFilesAdded]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        onFilesAdded(files)
      }
      // Reset input so same file can be selected again
      e.target.value = ''
    },
    [onFilesAdded]
  )

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
        isDragOver
          ? 'border-primary bg-primary/5 scale-[1.02]'
          : 'border-border hover:border-primary/50 hover:bg-secondary/50'
      }`}
    >
      <div className="space-y-4">
        <div className="text-6xl">📁</div>
        <div>
          <h3 className="text-lg font-semibold mb-2">
            {isDragOver ? 'Drop files here' : 'Import Video or Audio Files'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop files here, or click to browse
          </p>
        </div>

        <div>
          <Tooltip content="Select video or audio files from your computer">
            <label className="inline-block cursor-pointer">
              <input
                type="file"
                multiple
                accept="video/*,audio/*,.mp4,.mov,.avi,.mkv,.webm,.mp3,.wav,.flac,.m4a"
                onChange={handleFileSelect}
                className="hidden"
              />
              <span className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity inline-block">
                Browse Files
              </span>
            </label>
          </Tooltip>
        </div>

        <p className="text-xs text-muted-foreground">
          Supported formats: MP4, MOV, AVI, MKV, WebM, MP3, WAV, FLAC
        </p>
      </div>
    </div>
  )
}
