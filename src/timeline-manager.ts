import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export interface TimelineOperation {
  id: string;
  timestamp: Date;
  operation: string;
  description: string;
  input: string | string[];
  output: string;
  parameters: Record<string, any>;
  duration?: number; // milliseconds
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

export interface Timeline {
  id: string;
  name: string;
  created: Date;
  modified: Date;
  currentIndex: number; // Current position in timeline (-1 = before first operation)
  operations: TimelineOperation[];
  baseFile?: string; // Original file before any operations
}

export interface TimelineSnapshot {
  index: number;
  operation: TimelineOperation;
  outputPath: string;
}

export class TimelineManager {
  private timelinesDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.timelinesDir = path.join(baseDir, '.mcp-video-timelines');
  }

  /**
   * Initialize timelines directory
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.timelinesDir, { recursive: true });
  }

  /**
   * Create a new timeline
   */
  async createTimeline(name: string, baseFile?: string): Promise<Timeline> {
    await this.initialize();

    const timeline: Timeline = {
      id: randomUUID(),
      name,
      created: new Date(),
      modified: new Date(),
      currentIndex: -1,
      operations: [],
      baseFile
    };

    await this.saveTimeline(timeline);
    return timeline;
  }

  /**
   * Load timeline from disk
   */
  async loadTimeline(timelineId: string): Promise<Timeline> {
    const timelinePath = path.join(this.timelinesDir, `${timelineId}.json`);

    try {
      const data = await fs.readFile(timelinePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Deserialize dates
      return {
        ...parsed,
        created: new Date(parsed.created),
        modified: new Date(parsed.modified),
        operations: parsed.operations.map((op: any) => ({
          ...op,
          timestamp: new Date(op.timestamp)
        }))
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Timeline not found: ${timelineId}`);
      }
      throw new Error(`Failed to load timeline: ${error.message}`);
    }
  }

  /**
   * Save timeline to disk
   */
  async saveTimeline(timeline: Timeline): Promise<void> {
    await this.initialize();

    const timelinePath = path.join(this.timelinesDir, `${timeline.id}.json`);
    timeline.modified = new Date();

    await fs.writeFile(timelinePath, JSON.stringify(timeline, null, 2), 'utf-8');
  }

  /**
   * Add operation to timeline
   */
  async addOperation(
    timelineId: string,
    operation: string,
    description: string,
    input: string | string[],
    output: string,
    parameters: Record<string, any>,
    duration?: number
  ): Promise<Timeline> {
    const timeline = await this.loadTimeline(timelineId);

    // If we're not at the end of the timeline, remove operations after current position
    if (timeline.currentIndex < timeline.operations.length - 1) {
      timeline.operations = timeline.operations.slice(0, timeline.currentIndex + 1);
    }

    const op: TimelineOperation = {
      id: randomUUID(),
      timestamp: new Date(),
      operation,
      description,
      input,
      output,
      parameters,
      duration,
      status: 'completed'
    };

    timeline.operations.push(op);
    timeline.currentIndex = timeline.operations.length - 1;

    await this.saveTimeline(timeline);
    return timeline;
  }

  /**
   * Undo - move back one operation
   */
  async undo(timelineId: string): Promise<{ timeline: Timeline; previousOutput: string | null }> {
    const timeline = await this.loadTimeline(timelineId);

    if (timeline.currentIndex < 0) {
      return { timeline, previousOutput: timeline.baseFile || null };
    }

    timeline.currentIndex--;
    await this.saveTimeline(timeline);

    const previousOutput = timeline.currentIndex >= 0
      ? timeline.operations[timeline.currentIndex].output
      : timeline.baseFile || null;

    return { timeline, previousOutput };
  }

  /**
   * Redo - move forward one operation
   */
  async redo(timelineId: string): Promise<{ timeline: Timeline; nextOutput: string | null }> {
    const timeline = await this.loadTimeline(timelineId);

    if (timeline.currentIndex >= timeline.operations.length - 1) {
      return { timeline, nextOutput: null };
    }

    timeline.currentIndex++;
    await this.saveTimeline(timeline);

    const nextOutput = timeline.operations[timeline.currentIndex].output;

    return { timeline, nextOutput };
  }

  /**
   * Jump to specific point in timeline
   */
  async jumpTo(timelineId: string, index: number): Promise<{ timeline: Timeline; output: string | null }> {
    const timeline = await this.loadTimeline(timelineId);

    if (index < -1 || index >= timeline.operations.length) {
      throw new Error(`Invalid timeline index: ${index}`);
    }

    timeline.currentIndex = index;
    await this.saveTimeline(timeline);

    const output = index >= 0
      ? timeline.operations[index].output
      : timeline.baseFile || null;

    return { timeline, output };
  }

  /**
   * Get current state
   */
  async getCurrentState(timelineId: string): Promise<{
    timeline: Timeline;
    currentOutput: string | null;
    canUndo: boolean;
    canRedo: boolean;
  }> {
    const timeline = await this.loadTimeline(timelineId);

    const currentOutput = timeline.currentIndex >= 0
      ? timeline.operations[timeline.currentIndex].output
      : timeline.baseFile || null;

    return {
      timeline,
      currentOutput,
      canUndo: timeline.currentIndex >= 0,
      canRedo: timeline.currentIndex < timeline.operations.length - 1
    };
  }

  /**
   * List all timelines
   */
  async listTimelines(): Promise<Array<{
    id: string;
    name: string;
    created: Date;
    modified: Date;
    operationCount: number;
    currentIndex: number;
  }>> {
    await this.initialize();

    try {
      const files = await fs.readdir(this.timelinesDir);
      const timelineFiles = files.filter(f => f.endsWith('.json'));

      const summaries = [];

      for (const file of timelineFiles) {
        try {
          const timelineId = path.basename(file, '.json');
          const timeline = await this.loadTimeline(timelineId);

          summaries.push({
            id: timeline.id,
            name: timeline.name,
            created: timeline.created,
            modified: timeline.modified,
            operationCount: timeline.operations.length,
            currentIndex: timeline.currentIndex
          });
        } catch (error) {
          // Skip invalid timelines
        }
      }

      // Sort by modified date (most recent first)
      summaries.sort((a, b) => b.modified.getTime() - a.modified.getTime());

      return summaries;
    } catch (error: any) {
      throw new Error(`Failed to list timelines: ${error.message}`);
    }
  }

  /**
   * Delete timeline
   */
  async deleteTimeline(timelineId: string): Promise<void> {
    const timelinePath = path.join(this.timelinesDir, `${timelineId}.json`);

    try {
      await fs.unlink(timelinePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Timeline not found: ${timelineId}`);
      }
      throw new Error(`Failed to delete timeline: ${error.message}`);
    }
  }

  /**
   * Get timeline history as formatted string
   */
  async getTimelineHistory(timelineId: string): Promise<string> {
    const timeline = await this.loadTimeline(timelineId);

    const lines: string[] = [];
    lines.push(`Timeline: ${timeline.name} (${timeline.id})`);
    lines.push(`Created: ${timeline.created.toLocaleString()}`);
    lines.push(`Modified: ${timeline.modified.toLocaleString()}`);
    lines.push('');

    if (timeline.baseFile) {
      lines.push(`Base file: ${timeline.baseFile}`);
      lines.push('');
    }

    lines.push('OPERATIONS:');
    lines.push('='.repeat(80));

    if (timeline.operations.length === 0) {
      lines.push('No operations yet');
    } else {
      timeline.operations.forEach((op, index) => {
        const isCurrent = index === timeline.currentIndex;
        const marker = isCurrent ? '▶' : ' ';
        const status = op.status === 'failed' ? '✗' : '✓';

        lines.push(`${marker} ${index + 1}. [${status}] ${op.operation} - ${op.description}`);
        lines.push(`     Time: ${op.timestamp.toLocaleString()}`);
        lines.push(`     Input: ${Array.isArray(op.input) ? op.input.join(', ') : op.input}`);
        lines.push(`     Output: ${op.output}`);

        if (op.duration) {
          lines.push(`     Duration: ${(op.duration / 1000).toFixed(2)}s`);
        }

        if (op.error) {
          lines.push(`     Error: ${op.error}`);
        }

        lines.push('');
      });
    }

    lines.push('');
    lines.push(`Current position: ${timeline.currentIndex + 1}/${timeline.operations.length}`);
    lines.push(`Can undo: ${timeline.currentIndex >= 0 ? 'Yes' : 'No'}`);
    lines.push(`Can redo: ${timeline.currentIndex < timeline.operations.length - 1 ? 'Yes' : 'No'}`);

    return lines.join('\n');
  }

  /**
   * Clear timeline (remove all operations)
   */
  async clearTimeline(timelineId: string, keepBase: boolean = true): Promise<Timeline> {
    const timeline = await this.loadTimeline(timelineId);

    timeline.operations = [];
    timeline.currentIndex = -1;

    if (!keepBase) {
      timeline.baseFile = undefined;
    }

    await this.saveTimeline(timeline);
    return timeline;
  }

  /**
   * Get operation by index
   */
  async getOperation(timelineId: string, index: number): Promise<TimelineOperation> {
    const timeline = await this.loadTimeline(timelineId);

    if (index < 0 || index >= timeline.operations.length) {
      throw new Error(`Invalid operation index: ${index}`);
    }

    return timeline.operations[index];
  }

  /**
   * Export timeline to file
   */
  async exportTimeline(timelineId: string, exportPath: string): Promise<void> {
    const timeline = await this.loadTimeline(timelineId);

    await fs.writeFile(exportPath, JSON.stringify(timeline, null, 2), 'utf-8');
  }

  /**
   * Import timeline from file
   */
  async importTimeline(importPath: string): Promise<Timeline> {
    const data = await fs.readFile(importPath, 'utf-8');
    const parsed = JSON.parse(data);

    // Generate new ID for imported timeline
    const timeline: Timeline = {
      ...parsed,
      id: randomUUID(),
      created: new Date(parsed.created),
      modified: new Date(),
      operations: parsed.operations.map((op: any) => ({
        ...op,
        timestamp: new Date(op.timestamp)
      }))
    };

    await this.saveTimeline(timeline);
    return timeline;
  }

  /**
   * Get statistics
   */
  async getStatistics(timelineId: string): Promise<{
    totalOperations: number;
    completedOperations: number;
    failedOperations: number;
    totalDuration: number;
    averageDuration: number;
    operationsByType: Record<string, number>;
  }> {
    const timeline = await this.loadTimeline(timelineId);

    const stats = {
      totalOperations: timeline.operations.length,
      completedOperations: timeline.operations.filter(op => op.status === 'completed').length,
      failedOperations: timeline.operations.filter(op => op.status === 'failed').length,
      totalDuration: timeline.operations.reduce((sum, op) => sum + (op.duration || 0), 0),
      averageDuration: 0,
      operationsByType: {} as Record<string, number>
    };

    // Calculate average duration
    const opsWithDuration = timeline.operations.filter(op => op.duration);
    if (opsWithDuration.length > 0) {
      stats.averageDuration = stats.totalDuration / opsWithDuration.length;
    }

    // Count by operation type
    timeline.operations.forEach(op => {
      stats.operationsByType[op.operation] = (stats.operationsByType[op.operation] || 0) + 1;
    });

    return stats;
  }
}
