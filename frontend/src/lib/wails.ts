/**
 * Wails Runtime Bindings
 *
 * This module provides TypeScript bindings for Wails desktop app runtime.
 * It handles communication between the React frontend and Go backend.
 */

// Wails runtime types
interface WailsRuntime {
  Call: (method: string, ...args: any[]) => Promise<any>;
  EventsOn: (event: string, callback: (...args: any[]) => void) => () => void;
  EventsEmit: (event: string, ...args: any[]) => void;
}

// Get Wails runtime from window
declare global {
  interface Window {
    wails?: WailsRuntime;
  }
}

/**
 * Check if running in Wails environment
 */
export function isWailsEnvironment(): boolean {
  return typeof window !== 'undefined' && window.wails !== undefined;
}

/**
 * Call a Go backend method
 */
export async function callBackend<T = any>(method: string, ...args: any[]): Promise<T> {
  if (!isWailsEnvironment()) {
    throw new Error('Not running in Wails environment');
  }

  return window.wails!.Call(method, ...args);
}

/**
 * Listen to backend events
 */
export function onBackendEvent(event: string, callback: (...args: any[]) => void): () => void {
  if (!isWailsEnvironment()) {
    console.warn('Not running in Wails environment, event listener not registered');
    return () => {};
  }

  return window.wails!.EventsOn(event, callback);
}

/**
 * Emit event to backend
 */
export function emitToBackend(event: string, ...args: any[]): void {
  if (!isWailsEnvironment()) {
    console.warn('Not running in Wails environment, event not emitted');
    return;
  }

  window.wails!.EventsEmit(event, ...args);
}

// Bridge service methods
export const BridgeService = {
  /**
   * Send message to AI agent
   */
  async sendMessage(message: string): Promise<ReadableStream<any>> {
    if (!isWailsEnvironment()) {
      // Return mock stream for development
      return createMockStream(message);
    }

    // Call Go backend
    const channel = await callBackend<string>('Bridge.SendMessage', message);

    // Convert Go channel to ReadableStream
    return new ReadableStream({
      start(controller) {
        const unsubscribe = onBackendEvent(`message-${channel}`, (data: any) => {
          controller.enqueue(data);

          if (data.done) {
            controller.close();
            unsubscribe();
          }
        });
      }
    });
  },

  /**
   * Get conversation history
   */
  async getConversationHistory(): Promise<ConversationHistory> {
    if (!isWailsEnvironment()) {
      return { messages: [] };
    }

    return callBackend<ConversationHistory>('Bridge.GetConversationHistory');
  },

  /**
   * Clear conversation
   */
  async clearConversation(): Promise<void> {
    if (!isWailsEnvironment()) {
      return;
    }

    return callBackend('Bridge.ClearConversation');
  },

  /**
   * Execute MCP tool directly
   */
  async executeTool(name: string, args: Record<string, any>): Promise<any> {
    if (!isWailsEnvironment()) {
      console.log('Mock tool execution:', name, args);
      return { success: true, mock: true };
    }

    return callBackend('Bridge.ExecuteTool', name, args);
  },

  /**
   * Get available MCP tools
   */
  async getTools(): Promise<Tool[]> {
    if (!isWailsEnvironment()) {
      return [];
    }

    return callBackend<Tool[]>('Bridge.GetTools');
  }
};

// Types
export interface ConversationHistory {
  messages: Message[];
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  id: string;
  name: string;
  success: boolean;
  content: string;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

// Mock stream for development
function createMockStream(message: string): ReadableStream<any> {
  return new ReadableStream({
    async start(controller) {
      // Simulate agent response
      controller.enqueue({
        type: 'content',
        content: 'This is a mock response. '
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      controller.enqueue({
        type: 'content',
        content: 'The Wails app is not running in production mode. '
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      controller.enqueue({
        type: 'content',
        content: `You said: "${message}"`
      });

      controller.enqueue({ done: true });
      controller.close();
    }
  });
}
