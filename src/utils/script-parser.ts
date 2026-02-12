import { ScriptDefinition, ScriptSection } from '../multi-take/multi-take-types.js';
import { randomUUID } from 'crypto';

/**
 * Parse a script into sections based on paragraph breaks
 */
export class ScriptParser {

  /**
   * Parse a full script into sections
   * Sections are divided by double newlines (paragraph breaks)
   */
  parseScript(script: string): ScriptDefinition {
    if (!script || script.trim().length === 0) {
      throw new Error('Script cannot be empty');
    }

    // Normalize line endings
    const normalized = script.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split by paragraph breaks (double newlines)
    const paragraphs = normalized
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (paragraphs.length === 0) {
      throw new Error('Script must contain at least one paragraph');
    }

    // Create sections
    const sections: ScriptSection[] = [];
    let currentLine = 0;

    for (const paragraph of paragraphs) {
      const lineCount = paragraph.split('\n').length;

      sections.push({
        id: randomUUID(),
        text: paragraph,
        startLine: currentLine,
        endLine: currentLine + lineCount - 1,
        tags: this.extractTags(paragraph)
      });

      currentLine += lineCount + 1; // +1 for the paragraph break
    }

    return {
      fullScript: script,
      sections
    };
  }

  /**
   * Extract optional tags from section text
   * Looks for [tag] patterns at the start of paragraphs
   */
  private extractTags(text: string): string[] {
    const tags: string[] = [];
    const tagPattern = /^\[([^\]]+)\]\s*/g;
    let match;

    while ((match = tagPattern.exec(text)) !== null) {
      tags.push(match[1].toLowerCase());
    }

    return tags;
  }

  /**
   * Get a section by ID
   */
  getSection(script: ScriptDefinition, sectionId: string): ScriptSection | undefined {
    return script.sections.find(s => s.id === sectionId);
  }

  /**
   * Get sections by tag
   */
  getSectionsByTag(script: ScriptDefinition, tag: string): ScriptSection[] {
    const lowerTag = tag.toLowerCase();
    return script.sections.filter(s => s.tags?.includes(lowerTag));
  }

  /**
   * Get a formatted display of the script sections
   */
  formatScript(script: ScriptDefinition): string {
    let output = '';

    for (let i = 0; i < script.sections.length; i++) {
      const section = script.sections[i];
      output += `\n=== Section ${i + 1} ===\n`;

      if (section.tags && section.tags.length > 0) {
        output += `Tags: ${section.tags.join(', ')}\n`;
      }

      output += `${section.text}\n`;
    }

    return output.trim();
  }

  /**
   * Validate a script
   */
  validateScript(script: string): { valid: boolean; error?: string } {
    if (!script || script.trim().length === 0) {
      return { valid: false, error: 'Script cannot be empty' };
    }

    if (script.trim().length < 10) {
      return { valid: false, error: 'Script must be at least 10 characters' };
    }

    // Check for at least one paragraph
    const normalized = script.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const paragraphs = normalized.split(/\n\n+/).filter(p => p.trim().length > 0);

    if (paragraphs.length === 0) {
      return { valid: false, error: 'Script must contain at least one paragraph' };
    }

    return { valid: true };
  }

  /**
   * Estimate expected duration for a section based on word count
   * Assumes average speaking pace of 130 words per minute
   */
  estimateDuration(text: string, wordsPerMinute: number = 130): number {
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    return (words / wordsPerMinute) * 60; // return seconds
  }

  /**
   * Add duration estimates to script sections
   */
  addDurationEstimates(script: ScriptDefinition, wordsPerMinute: number = 130): ScriptDefinition {
    const sectionsWithDuration = script.sections.map(section => ({
      ...section,
      expectedDuration: this.estimateDuration(section.text, wordsPerMinute)
    }));

    return {
      ...script,
      sections: sectionsWithDuration
    };
  }
}
