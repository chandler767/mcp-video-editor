import { useEffect } from 'react'

export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: () => void
  description: string
  preventDefault?: boolean
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatches = !shortcut.ctrlKey || event.ctrlKey === shortcut.ctrlKey
        const metaMatches = !shortcut.metaKey || event.metaKey === shortcut.metaKey
        const shiftMatches = !shortcut.shiftKey || event.shiftKey === shortcut.shiftKey
        const altMatches = !shortcut.altKey || event.altKey === shortcut.altKey

        if (keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault()
          }
          shortcut.action()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [shortcuts, enabled])
}

// Helper to format shortcuts for display
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = []

  // Detect OS
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

  if (shortcut.ctrlKey) parts.push('Ctrl')
  if (shortcut.metaKey) parts.push(isMac ? '⌘' : 'Meta')
  if (shortcut.altKey) parts.push(isMac ? '⌥' : 'Alt')
  if (shortcut.shiftKey) parts.push(isMac ? '⇧' : 'Shift')

  parts.push(shortcut.key.toUpperCase())

  return parts.join(isMac ? '' : '+')
}

// Common shortcuts preset
export const COMMON_SHORTCUTS = {
  OPEN: { key: 'o', metaKey: true, description: 'Open file' },
  SAVE: { key: 's', metaKey: true, description: 'Save project' },
  UNDO: { key: 'z', metaKey: true, description: 'Undo' },
  REDO: { key: 'z', metaKey: true, shiftKey: true, description: 'Redo' },
  FIND: { key: 'f', metaKey: true, description: 'Find' },
  HELP: { key: '?', shiftKey: true, description: 'Show help' },
  ESCAPE: { key: 'Escape', description: 'Close dialog' },
  SETTINGS: { key: ',', metaKey: true, description: 'Open settings' },
}
