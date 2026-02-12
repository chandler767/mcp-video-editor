import fs from 'fs/promises';
import path from 'path';
import { MultiTakeProject, ProjectSummary, ErrorCode, MultiTakeError, CoverageAnalysis, TimeSegment } from './multi-take-types.js';

export class ProjectPersistence {
  private projectsDir: string;

  constructor(baseDir: string) {
    this.projectsDir = path.join(baseDir, '.mcp-multi-take-projects');
  }

  /**
   * Initialize the projects directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.projectsDir, { recursive: true });
    } catch (error: any) {
      throw new MultiTakeError(
        ErrorCode.FILE_NOT_ACCESSIBLE,
        `Failed to create projects directory: ${error.message}`,
        { projectsDir: this.projectsDir, error }
      );
    }
  }

  /**
   * Save a project to disk
   */
  async saveProject(project: MultiTakeProject): Promise<void> {
    await this.initialize();

    const projectFile = path.join(this.projectsDir, `${project.projectId}.json`);

    try {
      // Serialize the project with proper Date handling
      const serialized = this.serializeProject(project);
      await fs.writeFile(projectFile, JSON.stringify(serialized, null, 2), 'utf-8');
    } catch (error: any) {
      throw new MultiTakeError(
        ErrorCode.FILE_NOT_ACCESSIBLE,
        `Failed to save project ${project.name}: ${error.message}`,
        { projectId: project.projectId, error }
      );
    }
  }

  /**
   * Load a project from disk
   */
  async loadProject(projectId: string): Promise<MultiTakeProject> {
    const projectFile = path.join(this.projectsDir, `${projectId}.json`);

    try {
      const data = await fs.readFile(projectFile, 'utf-8');
      const parsed = JSON.parse(data);
      return this.deserializeProject(parsed);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new MultiTakeError(
          ErrorCode.PROJECT_NOT_FOUND,
          `Project not found: ${projectId}`,
          { projectId }
        );
      }
      throw new MultiTakeError(
        ErrorCode.FILE_NOT_ACCESSIBLE,
        `Failed to load project: ${error.message}`,
        { projectId, error }
      );
    }
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<ProjectSummary[]> {
    await this.initialize();

    try {
      const files = await fs.readdir(this.projectsDir);
      const projectFiles = files.filter(f => f.endsWith('.json'));

      const summaries: ProjectSummary[] = [];

      for (const file of projectFiles) {
        try {
          const projectId = path.basename(file, '.json');
          const project = await this.loadProject(projectId);

          summaries.push({
            projectId: project.projectId,
            name: project.name,
            created: project.created,
            modified: project.modified,
            takeCount: project.takes.length,
            status: project.status
          });
        } catch (error: any) {
          // Skip projects that can't be loaded
          console.warn(`Failed to load project ${file}:`, error.message);
        }
      }

      // Sort by modified date (most recent first)
      summaries.sort((a, b) => b.modified.getTime() - a.modified.getTime());

      return summaries;
    } catch (error: any) {
      throw new MultiTakeError(
        ErrorCode.FILE_NOT_ACCESSIBLE,
        `Failed to list projects: ${error.message}`,
        { error }
      );
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    const projectFile = path.join(this.projectsDir, `${projectId}.json`);

    try {
      await fs.unlink(projectFile);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new MultiTakeError(
          ErrorCode.PROJECT_NOT_FOUND,
          `Project not found: ${projectId}`,
          { projectId }
        );
      }
      throw new MultiTakeError(
        ErrorCode.FILE_NOT_ACCESSIBLE,
        `Failed to delete project: ${error.message}`,
        { projectId, error }
      );
    }
  }

  /**
   * Check if a project exists
   */
  async projectExists(projectId: string): Promise<boolean> {
    const projectFile = path.join(this.projectsDir, `${projectId}.json`);

    try {
      await fs.access(projectFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Export a project to a specific location
   */
  async exportProject(projectId: string, exportPath: string): Promise<void> {
    const project = await this.loadProject(projectId);
    const serialized = this.serializeProject(project);

    try {
      await fs.writeFile(exportPath, JSON.stringify(serialized, null, 2), 'utf-8');
    } catch (error: any) {
      throw new MultiTakeError(
        ErrorCode.EXPORT_FAILED,
        `Failed to export project: ${error.message}`,
        { projectId, exportPath, error }
      );
    }
  }

  /**
   * Import a project from a file
   */
  async importProject(importPath: string): Promise<MultiTakeProject> {
    try {
      const data = await fs.readFile(importPath, 'utf-8');
      const parsed = JSON.parse(data);
      const project = this.deserializeProject(parsed);

      // Save to projects directory
      await this.saveProject(project);

      return project;
    } catch (error: any) {
      throw new MultiTakeError(
        ErrorCode.FILE_NOT_ACCESSIBLE,
        `Failed to import project: ${error.message}`,
        { importPath, error }
      );
    }
  }

  /**
   * Serialize a project for storage (handle special types)
   */
  private serializeProject(project: MultiTakeProject): any {
    return {
      ...project,
      created: project.created.toISOString(),
      modified: project.modified.toISOString(),
      takes: project.takes.map(take => ({
        ...take,
        analyzedAt: take.analyzedAt?.toISOString(),
        // Convert Map to object for coverage.timeRanges
        coverage: {
          ...take.coverage,
          timeRanges: take.coverage.timeRanges
            ? Object.fromEntries(take.coverage.timeRanges)
            : {}
        },
        // Convert Map to object for fillerWords.types
        audioQuality: {
          ...take.audioQuality,
          speechQuality: {
            ...take.audioQuality.speechQuality,
            fillerWords: {
              ...take.audioQuality.speechQuality.fillerWords,
              types: Object.fromEntries(take.audioQuality.speechQuality.fillerWords.types)
            }
          }
        }
      }))
    };
  }

  /**
   * Deserialize a project from storage (handle special types)
   */
  private deserializeProject(data: any): MultiTakeProject {
    return {
      ...data,
      created: new Date(data.created),
      modified: new Date(data.modified),
      takes: data.takes.map((take: any) => ({
        ...take,
        analyzedAt: take.analyzedAt ? new Date(take.analyzedAt) : undefined,
        // Convert object back to Map for coverage.timeRanges
        coverage: {
          ...take.coverage,
          timeRanges: new Map(Object.entries(take.coverage.timeRanges || {}))
        } as CoverageAnalysis,
        // Convert object back to Map for fillerWords.types
        audioQuality: {
          ...take.audioQuality,
          speechQuality: {
            ...take.audioQuality.speechQuality,
            fillerWords: {
              ...take.audioQuality.speechQuality.fillerWords,
              types: new Map(Object.entries(take.audioQuality.speechQuality.fillerWords.types || {}))
            }
          }
        }
      }))
    };
  }
}
