import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isWailsEnvironment,
  callBackend,
  onBackendEvent,
  BridgeService,
} from './wails'

describe('wails', () => {
  beforeEach(() => {
    // Clear window.wails before each test
    delete (window as any).wails
  })

  describe('isWailsEnvironment', () => {
    it('returns false when window.wails is undefined', () => {
      expect(isWailsEnvironment()).toBe(false)
    })

    it('returns true when window.wails is defined', () => {
      (window as any).wails = {}
      expect(isWailsEnvironment()).toBe(true)
    })
  })

  describe('callBackend', () => {
    it('throws error when not in Wails environment', async () => {
      await expect(callBackend('test')).rejects.toThrow(
        'Not running in Wails environment'
      )
    })

    it('calls window.wails.Call when in Wails environment', async () => {
      const mockCall = vi.fn().mockResolvedValue('result')
      ;(window as any).wails = { Call: mockCall }

      const result = await callBackend('TestMethod', 'arg1', 'arg2')

      expect(mockCall).toHaveBeenCalledWith('TestMethod', 'arg1', 'arg2')
      expect(result).toBe('result')
    })
  })

  describe('onBackendEvent', () => {
    it('returns no-op function when not in Wails environment', () => {
      const callback = vi.fn()
      const unsubscribe = onBackendEvent('test-event', callback)

      expect(callback).not.toHaveBeenCalled()
      expect(typeof unsubscribe).toBe('function')
    })

    it('calls window.wails.EventsOn when in Wails environment', () => {
      const mockEventsOn = vi.fn().mockReturnValue(() => {})
      ;(window as any).wails = { EventsOn: mockEventsOn }

      const callback = vi.fn()
      onBackendEvent('test-event', callback)

      expect(mockEventsOn).toHaveBeenCalledWith('test-event', callback)
    })
  })

  describe('BridgeService', () => {
    describe('sendMessage', () => {
      it('returns mock stream when not in Wails environment', async () => {
        const stream = await BridgeService.sendMessage('Hello')

        expect(stream).toBeInstanceOf(ReadableStream)

        const reader = stream.getReader()
        const { value, done } = await reader.read()

        expect(done).toBe(false)
        expect(value).toHaveProperty('type', 'content')
      })

      it('calls backend and returns stream when in Wails environment', async () => {
        const mockCall = vi.fn().mockResolvedValue('channel-id')
        const mockEventsOn = vi.fn().mockImplementation((_event, callback) => {
          // Simulate immediate response
          setTimeout(() => {
            callback({ type: 'content', content: 'Hello!', done: false })
            callback({ done: true })
          }, 0)
          return () => {}
        })

        ;(window as any).wails = {
          Call: mockCall,
          EventsOn: mockEventsOn,
        }

        const stream = await BridgeService.sendMessage('Hello')

        expect(mockCall).toHaveBeenCalledWith('Bridge.SendMessage', 'Hello')
        expect(stream).toBeInstanceOf(ReadableStream)
      })
    })

    describe('getConversationHistory', () => {
      it('returns empty history when not in Wails environment', async () => {
        const history = await BridgeService.getConversationHistory()

        expect(history).toEqual({ messages: [] })
      })

      it('calls backend when in Wails environment', async () => {
        const mockHistory = {
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi!' },
          ],
        }

        const mockCall = vi.fn().mockResolvedValue(mockHistory)
        ;(window as any).wails = { Call: mockCall }

        const history = await BridgeService.getConversationHistory()

        expect(mockCall).toHaveBeenCalledWith('Bridge.GetConversationHistory')
        expect(history).toEqual(mockHistory)
      })
    })

    describe('clearConversation', () => {
      it('does nothing when not in Wails environment', async () => {
        await expect(BridgeService.clearConversation()).resolves.toBeUndefined()
      })

      it('calls backend when in Wails environment', async () => {
        const mockCall = vi.fn().mockResolvedValue(undefined)
        ;(window as any).wails = { Call: mockCall }

        await BridgeService.clearConversation()

        expect(mockCall).toHaveBeenCalledWith('Bridge.ClearConversation')
      })
    })

    describe('executeTool', () => {
      it('returns mock result when not in Wails environment', async () => {
        const result = await BridgeService.executeTool('test-tool', {
          arg1: 'value1',
        })

        expect(result).toEqual({ success: true, mock: true })
      })

      it('calls backend when in Wails environment', async () => {
        const mockResult = {
          success: true,
          content: 'Tool executed',
        }

        const mockCall = vi.fn().mockResolvedValue(mockResult)
        ;(window as any).wails = { Call: mockCall }

        const result = await BridgeService.executeTool('test-tool', {
          arg1: 'value1',
        })

        expect(mockCall).toHaveBeenCalledWith('Bridge.ExecuteTool', 'test-tool', {
          arg1: 'value1',
        })
        expect(result).toEqual(mockResult)
      })
    })

    describe('getTools', () => {
      it('returns empty array when not in Wails environment', async () => {
        const tools = await BridgeService.getTools()

        expect(tools).toEqual([])
      })

      it('calls backend when in Wails environment', async () => {
        const mockTools = [
          { name: 'tool1', description: 'Tool 1', inputSchema: {} },
          { name: 'tool2', description: 'Tool 2', inputSchema: {} },
        ]

        const mockCall = vi.fn().mockResolvedValue(mockTools)
        ;(window as any).wails = { Call: mockCall }

        const tools = await BridgeService.getTools()

        expect(mockCall).toHaveBeenCalledWith('Bridge.GetTools')
        expect(tools).toEqual(mockTools)
      })
    })
  })
})
