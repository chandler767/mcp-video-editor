import { useState, useEffect } from 'react'

export interface RecentFile {
  id: string
  name: string
  path: string
  timestamp: number
  size?: number
  type?: string
}

const RECENT_FILES_KEY = 'mcp-video-editor:recent-files'
const MAX_RECENT_FILES = 10

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])

  // Load recent files from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_FILES_KEY)
      if (stored) {
        const files = JSON.parse(stored) as RecentFile[]
        setRecentFiles(files)
      }
    } catch (error) {
      console.error('Failed to load recent files:', error)
    }
  }, [])

  // Save to localStorage whenever recentFiles changes
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles))
    } catch (error) {
      console.error('Failed to save recent files:', error)
    }
  }, [recentFiles])

  const addRecentFile = (file: Omit<RecentFile, 'timestamp'>) => {
    setRecentFiles((prev) => {
      // Remove if already exists (to update timestamp)
      const filtered = prev.filter((f) => f.path !== file.path)

      // Add to front with current timestamp
      const newFile: RecentFile = {
        ...file,
        timestamp: Date.now(),
      }

      // Keep only MAX_RECENT_FILES
      const updated = [newFile, ...filtered].slice(0, MAX_RECENT_FILES)

      return updated
    })
  }

  const removeRecentFile = (path: string) => {
    setRecentFiles((prev) => prev.filter((f) => f.path !== path))
  }

  const clearRecentFiles = () => {
    setRecentFiles([])
  }

  const getRecentFile = (path: string) => {
    return recentFiles.find((f) => f.path === path)
  }

  return {
    recentFiles,
    addRecentFile,
    removeRecentFile,
    clearRecentFiles,
    getRecentFile,
  }
}

// Helper to format file size
export function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown size'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// Helper to format timestamp
export function formatTimestamp(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day

  if (diff < minute) {
    return 'Just now'
  } else if (diff < hour) {
    const mins = Math.floor(diff / minute)
    return `${mins} minute${mins > 1 ? 's' : ''} ago`
  } else if (diff < day) {
    const hours = Math.floor(diff / hour)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else if (diff < week) {
    const days = Math.floor(diff / day)
    return `${days} day${days > 1 ? 's' : ''} ago`
  } else {
    return new Date(timestamp).toLocaleDateString()
  }
}
