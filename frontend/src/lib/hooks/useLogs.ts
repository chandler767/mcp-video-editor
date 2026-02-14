import { useState, useEffect, useCallback } from 'react'

export type LogLevel = 'debug' | 'info' | 'warning' | 'error'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  message: string
  source?: string
  details?: any
}

const LOGS_KEY = 'mcp-video-editor:logs'
const MAX_LOGS = 1000 // Keep last 1000 logs

// Global log emitter
type LogListener = (entry: LogEntry) => void
const logListeners: LogListener[] = []

let logCounter = 0

// Global logging functions that can be called from anywhere
export const logger = {
  debug: (message: string, source?: string, details?: any) => {
    addLog('debug', message, source, details)
  },
  info: (message: string, source?: string, details?: any) => {
    addLog('info', message, source, details)
  },
  warning: (message: string, source?: string, details?: any) => {
    addLog('warning', message, source, details)
  },
  error: (message: string, source?: string, details?: any) => {
    addLog('error', message, source, details)
  },
}

function addLog(level: LogLevel, message: string, source?: string, details?: any) {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${logCounter++}`,
    timestamp: Date.now(),
    level,
    message,
    source,
    details,
  }

  // Emit to all listeners
  logListeners.forEach((listener) => listener(entry))

  // Also log to console for debugging
  const consoleMethod = level === 'warning' ? 'warn' : level === 'error' ? 'error' : 'log'
  console[consoleMethod](`[${level.toUpperCase()}]`, message, source ? `(${source})` : '', details || '')
}

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isPaused, setIsPaused] = useState(false)

  // Load logs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOGS_KEY)
      if (stored) {
        const parsedLogs = JSON.parse(stored) as LogEntry[]
        setLogs(parsedLogs)
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    }
  }, [])

  // Save logs to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs))
    } catch (error) {
      console.error('Failed to save logs:', error)
    }
  }, [logs])

  // Subscribe to log events
  useEffect(() => {
    const listener: LogListener = (entry) => {
      if (!isPaused) {
        setLogs((prev) => {
          const updated = [...prev, entry]
          // Keep only last MAX_LOGS
          if (updated.length > MAX_LOGS) {
            return updated.slice(-MAX_LOGS)
          }
          return updated
        })
      }
    }

    logListeners.push(listener)

    return () => {
      const index = logListeners.indexOf(listener)
      if (index > -1) {
        logListeners.splice(index, 1)
      }
    }
  }, [isPaused])

  const clearLogs = useCallback(() => {
    setLogs([])
    localStorage.removeItem(LOGS_KEY)
  }, [])

  const exportLogs = useCallback(() => {
    const data = JSON.stringify(logs, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mcp-video-editor-logs-${new Date().toISOString()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [logs])

  const filterLogs = useCallback(
    (filters: { levels?: LogLevel[]; source?: string; search?: string }) => {
      return logs.filter((log) => {
        // Filter by level
        if (filters.levels && filters.levels.length > 0) {
          if (!filters.levels.includes(log.level)) {
            return false
          }
        }

        // Filter by source
        if (filters.source && log.source !== filters.source) {
          return false
        }

        // Filter by search text
        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          return (
            log.message.toLowerCase().includes(searchLower) ||
            (log.source && log.source.toLowerCase().includes(searchLower))
          )
        }

        return true
      })
    },
    [logs]
  )

  const getLogSources = useCallback(() => {
    const sources = new Set<string>()
    logs.forEach((log) => {
      if (log.source) {
        sources.add(log.source)
      }
    })
    return Array.from(sources).sort()
  }, [logs])

  return {
    logs,
    clearLogs,
    exportLogs,
    filterLogs,
    getLogSources,
    isPaused,
    setIsPaused,
  }
}

// Helper to format timestamp
export function formatLogTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  const ms = date.getMilliseconds().toString().padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${ms}`
}

// Helper to get log level color
export function getLogLevelColor(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return 'text-gray-600 bg-gray-100'
    case 'info':
      return 'text-blue-600 bg-blue-100'
    case 'warning':
      return 'text-yellow-600 bg-yellow-100'
    case 'error':
      return 'text-red-600 bg-red-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

// Helper to get log level icon
export function getLogLevelIcon(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return '🔍'
    case 'info':
      return 'ℹ️'
    case 'warning':
      return '⚠️'
    case 'error':
      return '❌'
    default:
      return '📝'
  }
}
