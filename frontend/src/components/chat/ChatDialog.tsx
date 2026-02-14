import { useState, useRef, useEffect } from 'react'
import { BridgeService, isWailsEnvironment } from '../../lib/wails'
import { logger } from '../../lib/hooks/useLogs'

interface Message {
  role: string
  content: string
  toolCalls?: Array<{
    id: string
    name: string
    args: Record<string, any>
  }>
  toolResults?: Array<{
    toolCallId: string
    success: boolean
    content?: string
    error?: string
  }>
}

export default function ChatDialog() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
    }

    logger.info(`User message: ${userMessage.content}`, 'ChatDialog')

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Call Wails backend
      logger.debug('Sending message to agent...', 'ChatDialog')
      const stream = await BridgeService.sendMessage(userMessage.content)
      const reader = stream.getReader()

      let assistantMessage: Message = {
        role: 'assistant',
        content: '',
      }

      // Add initial empty message
      setMessages(prev => [...prev, assistantMessage])

      // Read stream (response format: {content, toolCalls, toolResults, done, error})
      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        // Handle response from backend
        if (value.content) {
          assistantMessage.content += value.content
        }

        if (value.toolCalls && value.toolCalls.length > 0) {
          if (!assistantMessage.toolCalls) {
            assistantMessage.toolCalls = []
          }
          assistantMessage.toolCalls.push(...value.toolCalls)

          // Log tool calls
          value.toolCalls.forEach((toolCall: any) => {
            logger.info(`Tool call: ${toolCall.name}`, 'Agent', toolCall.args)
          })
        }

        if (value.toolResults && value.toolResults.length > 0) {
          if (!assistantMessage.toolResults) {
            assistantMessage.toolResults = []
          }
          assistantMessage.toolResults.push(...value.toolResults)

          // Log tool results
          value.toolResults.forEach((result: any) => {
            if (result.success) {
              logger.info(`Tool result: Success`, 'Agent', result.content)
            } else {
              logger.error(`Tool result: Error`, 'Agent', result.error)
            }
          })
        }

        if (value.error) {
          assistantMessage.content += `\n\nError: ${value.error}`
          logger.error(`Agent error: ${value.error}`, 'ChatDialog')
        }

        // Update UI
        setMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = { ...assistantMessage }
          return newMessages
        })

        // Check if done
        if (value.done) {
          break
        }
      }

      logger.debug('Agent stream completed', 'ChatDialog')
      setIsLoading(false)
    } catch (error) {
      console.error('Error sending message:', error)
      logger.error(
        `Error sending message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ChatDialog',
        error
      )
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      }
      setMessages(prev => [...prev, errorMessage])
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">MCP Video Editor</h1>
            <p className="text-sm text-muted-foreground">
              AI-Powered Video Editing Assistant
              {!isWailsEnvironment() && (
                <span className="ml-2 text-yellow-600 font-semibold">(Development Mode)</span>
              )}
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => {
                logger.info('Clearing conversation', 'ChatDialog')
                setMessages([])
                BridgeService.clearConversation()
              }}
              className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:opacity-90 transition-opacity"
            >
              Clear Chat
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg mb-2">Welcome to MCP Video Editor!</p>
            <p className="text-sm">
              Ask me to edit your videos. I can trim, resize, apply effects, and much more.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <div className="text-xs font-semibold mb-1 opacity-70">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="whitespace-pre-wrap">{message.content}</div>

              {/* Tool Calls */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.toolCalls.map((toolCall, i) => (
                    <div key={i} className="bg-black/10 rounded px-3 py-2 text-sm">
                      <div className="font-semibold">🛠️ {toolCall.name}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {JSON.stringify(toolCall.args, null, 2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tool Results */}
              {message.toolResults && message.toolResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.toolResults.map((result, i) => (
                    <div
                      key={i}
                      className={`rounded px-3 py-2 text-sm ${
                        result.success ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}
                    >
                      <div className="font-semibold">
                        {result.success ? '✓ Success' : '✗ Error'}
                      </div>
                      <div className="text-xs opacity-70 mt-1">
                        {result.success ? result.content : result.error}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-secondary text-secondary-foreground rounded-lg px-4 py-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-6 py-4">
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask me to edit your videos..."
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
