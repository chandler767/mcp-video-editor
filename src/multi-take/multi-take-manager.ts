import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import {
  MultiTakeProject,
  ProjectDirectories,
  ProjectSettings,
  ProjectStatus,
  ScriptDefinition,
  TakeAnalysis,
  MultiTakeError,
  ErrorCode,
  DEFAULT_PROJECT_SETTINGS,
  OrganizedFiles,
  CleanupReport,
  ExportSettings,
  ExportResult
} from './multi-take-types.js';
import { ScriptParser } from '../utils/script-parser.js';
import { ProjectPersistence } from './multi-take-persistence.js';
import { WorkspaceManager } from './multi-take-workspace.js';

/**
 * High-level manager for multi-take projects
 */
export class MultiTakeProjectManager {
  private persistence: ProjectPersistence;
  private workspaceManager: WorkspaceManager;
  private scriptParser: ScriptParser;

  constructor(baseDir: string) {
    this.persistence = new ProjectPersistence(baseDir);
    this.workspaceManager = new WorkspaceManager();
    this.scriptParser = new ScriptParser();
  }

  /**
   * Create a new multi-take project
   */
  async createProject(
    name: string,
    script: string,
    projectRoot?: string,
    settings?: Partial<ProjectSettings>
  ): Promise<MultiTakeProject> {
    // Validate script
    const validation = this.scriptParser.validateScript(script);
    if (!validation.valid) {
      throw new MultiTakeError(
        ErrorCode.INVALID_PROJECT_STATE,
        `Invalid script: ${validation.error}`,
        { script }
      );
    }

    // Parse script into sections
    const scriptDefinition = this.scriptParser.parseScript(script);

    // Generate project ID
    const projectId = randomUUID();

    // Determine project root
    const root = projectRoot || path.join(process.cwd(), name.replace(/[^a-z0-9-_]/gi, '_'));

    // Initialize workspace
    const directories = await this.workspaceManager.initializeWorkspace(root, name);

    // Create project
    const project: MultiTakeProject = {
      projectId,
      name,
      created: new Date(),
      modified: new Date(),
      script: scriptDefinition,
      takes: [],
      directories,
      settings: {
        ...DEFAULT_PROJECT_SETTINGS,
        ...settings
      },
      status: {
        phase: 'setup',
        progress: 0,
        errors: []
      }
    };

    // Save project
    await this.persistence.saveProject(project);

    return project;
  }

  /**
   * Load an existing project
   */
  async loadProject(projectId: string): Promise<MultiTakeProject> {
    return await this.persistence.loadProject(projectId);
  }

  /**
   * Save project changes
   */
  async saveProject(project: MultiTakeProject): Promise<void> {
    project.modified = new Date();
    await this.persistence.saveProject(project);
  }

  /**
   * List all projects
   */
  async listProjects() {
    return await this.persistence.listProjects();
  }

  /**
   * Delete a project (metadata only, not files)
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.persistence.deleteProject(projectId);
  }

  /**
   * Add video takes to project
   */
  async addTakes(
    project: MultiTakeProject,
    sourceFiles: string[],
    move: boolean = false
  ): Promise<OrganizedFiles> {
    // Validate all files exist
    for (const file of sourceFiles) {
      const validation = await this.workspaceManager.validateFile(file);
      if (!validation.valid) {
        throw new MultiTakeError(
          ErrorCode.FILE_NOT_FOUND,
          `File validation failed: ${validation.error}`,
          { file }
        );
      }
    }

    // Organize takes into source directory
    const organized = await this.workspaceManager.organizeTakes(
      sourceFiles,
      project.directories.source,
      move
    );

    // Update project
    project.modified = new Date();
    await this.saveProject(project);

    return organized;
  }

  /**
   * Get all take files in source directory
   */
  async getTakeFiles(project: MultiTakeProject): Promise<string[]> {
    try {
      const files = await fs.readdir(project.directories.source);

      // Filter video files
      const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
      const videoFiles = files.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return videoExtensions.includes(ext);
      });

      return videoFiles.map(f => path.join(project.directories.source, f));
    } catch (error: any) {
      throw new MultiTakeError(
        ErrorCode.FILE_NOT_ACCESSIBLE,
        `Failed to read source directory: ${error.message}`,
        { sourceDir: project.directories.source, error }
      );
    }
  }

  /**
   * Update project status
   */
  async updateStatus(
    project: MultiTakeProject,
    phase: ProjectStatus['phase'],
    progress: number,
    currentTask?: string,
    error?: string
  ): Promise<void> {
    project.status = {
      phase,
      progress: Math.max(0, Math.min(100, progress)),
      currentTask,
      errors: error ? [...project.status.errors, error] : project.status.errors
    };

    await this.saveProject(project);
  }

  /**
   * Get project statistics
   */
  async getProjectStats(project: MultiTakeProject) {
    const workspaceStats = await this.workspaceManager.getWorkspaceStats(project.directories);

    const analyzedTakes = project.takes.filter(t => t.status === 'analyzed').length;
    const totalTakes = project.takes.length;
    const avgScore = totalTakes > 0
      ? project.takes.reduce((sum, t) => sum + t.overallScore, 0) / totalTakes
      : 0;

    const allIssues = project.takes.flatMap(t => t.issues);
    const errorCount = allIssues.filter(i => i.severity === 'error').length;
    const warningCount = allIssues.filter(i => i.severity === 'warning').length;

    return {
      projectId: project.projectId,
      name: project.name,
      created: project.created,
      modified: project.modified,
      status: project.status,
      takes: {
        total: totalTakes,
        analyzed: analyzedTakes,
        pending: totalTakes - analyzedTakes
      },
      quality: {
        averageScore: Math.round(avgScore),
        errors: errorCount,
        warnings: warningCount
      },
      coverage: {
        totalSections: project.script.sections.length,
        coveredSections: this.getCoveredSections(project).length
      },
      workspace: workspaceStats
    };
  }

  /**
   * Get sections covered by at least one take
   */
  private getCoveredSections(project: MultiTakeProject): string[] {
    const covered = new Set<string>();

    for (const take of project.takes) {
      for (const sectionId of take.coverage.coveredSections) {
        covered.add(sectionId);
      }
    }

    return Array.from(covered);
  }

  /**
   * Clean temporary files
   */
  async cleanTempFiles(project: MultiTakeProject, force: boolean = false): Promise<CleanupReport> {
    if (force) {
      return await this.workspaceManager.forceCleanTemp(project.directories.temp);
    } else {
      return await this.workspaceManager.cleanTempFiles(
        project.directories.temp,
        project.settings.fileOrganization
      );
    }
  }

  /**
   * Export project metadata
   */
  async exportProjectData(projectId: string, exportPath: string): Promise<void> {
    await this.persistence.exportProject(projectId, exportPath);
  }

  /**
   * Import project metadata
   */
  async importProjectData(importPath: string): Promise<MultiTakeProject> {
    return await this.persistence.importProject(importPath);
  }

  /**
   * Get missing sections (not covered by any take)
   */
  getMissingSections(project: MultiTakeProject): string[] {
    const allSectionIds = new Set(project.script.sections.map(s => s.id));
    const coveredSectionIds = new Set<string>();

    for (const take of project.takes) {
      for (const sectionId of take.coverage.coveredSections) {
        coveredSectionIds.add(sectionId);
      }
    }

    const missingSectionIds: string[] = [];
    for (const sectionId of allSectionIds) {
      if (!coveredSectionIds.has(sectionId)) {
        missingSectionIds.push(sectionId);
      }
    }

    return missingSectionIds;
  }

  /**
   * Get script sections with their coverage status
   */
  getScriptSectionsWithCoverage(project: MultiTakeProject) {
    const coveredSections = this.getCoveredSections(project);

    return project.script.sections.map(section => ({
      id: section.id,
      text: section.text,
      covered: coveredSections.includes(section.id),
      takeCount: project.takes.filter(t =>
        t.coverage.coveredSections.includes(section.id)
      ).length
    }));
  }

  /**
   * Validate project is ready for analysis
   */
  validateReadyForAnalysis(project: MultiTakeProject): { valid: boolean; error?: string } {
    if (project.takes.length === 0) {
      return { valid: false, error: 'No takes have been added to the project' };
    }

    if (project.script.sections.length === 0) {
      return { valid: false, error: 'Script has no sections' };
    }

    return { valid: true };
  }

  /**
   * Validate project is ready for assembly
   */
  validateReadyForAssembly(project: MultiTakeProject): { valid: boolean; error?: string } {
    const analyzedTakes = project.takes.filter(t => t.status === 'analyzed');

    if (analyzedTakes.length === 0) {
      return { valid: false, error: 'No takes have been analyzed' };
    }

    const missingSections = this.getMissingSections(project);
    if (missingSections.length === project.script.sections.length) {
      return { valid: false, error: 'No script sections are covered by any take' };
    }

    if (!project.bestTakes || project.bestTakes.length === 0) {
      return { valid: false, error: 'Best takes have not been selected' };
    }

    return { valid: true };
  }
}
