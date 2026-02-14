import { useState, useEffect, useRef } from 'react'
import {
  useLogs,
  LogLevel,
  LogEntry,
  formatLogTimestamp,
  getLogLevelColor,
  getLogLevelIcon,
} from '../../lib/hooks/useLogs'
import Tooltip from '../ui/Tooltip'

export default function LogsViewer() {
  const {
    logs,
    clearLogs,
    exportLogs,
    filterLogs,
    getLogSources,
    isPaused,
    setIsPaused,
  } = useLogs()

  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([])
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [searchText, setSearchText] = useState<string>('')
  const [autoScroll, setAutoScroll] = useState<boolean>(true)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  // Get filtered logs
  const filteredLogs = filterLogs({
    levels: selectedLevels.length > 0 ? selectedLevels : undefined,
    source: selectedSource || undefined,
    search: searchText || undefined,
  })

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  // Detect manual scroll to disable auto-scroll
  useEffect(() => {
    const container = logsContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 50
      setAutoScroll(isAtBottom)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleLevel = (level: LogLevel) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    )
  }

  const handleClearLogs = () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      clearLogs()
    }
  }

  const toggleLogDetails = (logId: string) => {
    setExpandedLogId((prev) => (prev === logId ? null : logId))
  }

  const sources = getLogSources()

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Logs Viewer</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredLogs.length} of {logs.length} logs
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Tooltip content={isPaused ? 'Resume logging' : 'Pause logging'}>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`px-3 py-2 text-sm border border-border rounded-md transition-colors ${
                  isPaused
                    ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                    : 'hover:bg-secondary'
                }`}
              >
                {isPaused ? '▶️ Resume' : '⏸️ Pause'}
              </button>
            </Tooltip>

            <Tooltip content="Export logs as JSON file">
              <button
                onClick={exportLogs}
                disabled={logs.length === 0}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                💾 Export
              </button>
            </Tooltip>

            <Tooltip content="Clear all logs">
              <button
                onClick={handleClearLogs}
                disabled={logs.length === 0}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                🗑️ Clear
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Level Filters */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-muted-foreground w-16">Levels:</span>
            <div className="flex space-x-2">
              {(['debug', 'info', 'warning', 'error'] as LogLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                    selectedLevels.includes(level)
                      ? getLogLevelColor(level) + ' border-current'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {getLogLevelIcon(level)} {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Source Filter */}
          {sources.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-muted-foreground w-16">Source:</span>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
              >
                <option value="">All sources</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-muted-foreground w-16">Search:</span>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search logs..."
              className="flex-1 px-3 py-1.5 text-sm border border-border rounded-md bg-background"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div
        ref={logsContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-xs"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm">
              {logs.length === 0
                ? 'No logs yet'
                : 'No logs match your filters'}
            </p>
            <p className="text-xs mt-1">
              {logs.length === 0
                ? 'Logs will appear here as the application runs'
                : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <LogEntryRow
              key={log.id}
              log={log}
              isExpanded={expandedLogId === log.id}
              onToggleExpand={() => toggleLogDetails(log.id)}
            />
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2 bg-secondary/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>
              {logs.filter((l) => l.level === 'error').length} errors
            </span>
            <span>
              {logs.filter((l) => l.level === 'warning').length} warnings
            </span>
            <span>
              {logs.filter((l) => l.level === 'info').length} info
            </span>
            <span>
              {logs.filter((l) => l.level === 'debug').length} debug
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              <span>Auto-scroll</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

interface LogEntryRowProps {
  log: LogEntry
  isExpanded: boolean
  onToggleExpand: () => void
}

function LogEntryRow({ log, isExpanded, onToggleExpand }: LogEntryRowProps) {
  const hasDetails = log.details !== undefined && log.details !== null

  return (
    <div
      className={`rounded px-2 py-1 hover:bg-secondary/50 transition-colors ${
        log.level === 'error' ? 'bg-red-50' : log.level === 'warning' ? 'bg-yellow-50' : ''
      }`}
    >
      <div className="flex items-start space-x-2">
        {/* Timestamp */}
        <span className="text-muted-foreground flex-shrink-0">
          {formatLogTimestamp(log.timestamp)}
        </span>

        {/* Level */}
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getLogLevelColor(
            log.level
          )}`}
        >
          {getLogLevelIcon(log.level)} {log.level.toUpperCase()}
        </span>

        {/* Source */}
        {log.source && (
          <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs flex-shrink-0">
            {log.source}
          </span>
        )}

        {/* Message */}
        <span className="flex-1 break-all">{log.message}</span>

        {/* Expand button */}
        {hasDetails && (
          <button
            onClick={onToggleExpand}
            className="text-primary hover:underline flex-shrink-0"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
      </div>

      {/* Details */}
      {isExpanded && hasDetails && (
        <div className="mt-2 ml-6 p-2 bg-secondary/50 rounded border border-border overflow-x-auto">
          <pre className="text-xs whitespace-pre-wrap">
            {typeof log.details === 'string'
              ? log.details
              : JSON.stringify(log.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
