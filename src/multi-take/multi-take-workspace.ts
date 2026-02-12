import fs from 'fs/promises';
import path from 'path';
import {
  ProjectDirectories,
  FileOrganizationSettings,
  OrganizedFiles,
  CleanupReport,
  ExportSettings,
  ExportResult,
  MultiTakeError,
  ErrorCode
} from './multi-take-types.js';
import { VideoInfo } from '../video-operations.js';

export class WorkspaceManager {

  /**
   * Initialize project workspace structure
   */
  async initializeWorkspace(
    projectRoot: string,
    projectName: string
  ): Promise<ProjectDirectories> {

    const dirs: ProjectDirectories = {
      root: projectRoot,
      source: path.join(projectRoot, 'source'),
      temp: path.join(projectRoot, '.temp'),
      output: path.join(projectRoot, 'output'),
      exports: path.join(projectRoot, 'exports'),
      analysis: path.join(projectRoot, 'analysis')
    };

    try {
      // Create all directories
      for (const dir of Object.values(dirs)) {
        await fs.mkdir(dir, { recursive: true });
      }

      // Create .gitignore for temp directory
      await this.setupGitignore(dirs.temp);

      // Create README in source directory
      await this.createSourceReadme(dirs.source, projectName);

      return dirs;
    } catch (error: any) {
      throw new MultiTakeError(
        ErrorCode.FILE_NOT_ACCESSIBLE,
        `Failed to initialize workspace: ${error.message}`,
        { projectRoot, error }
      );
    }
  }

  /**
   * Create .gitignore in temp directory
   */
  private async setupGitignore(tempDir: string): Promise<void> {
    const gitignoreContent = `# Ignore all temporary files
*
# But keep the directory
!.gitignore
`;
    await fs.writeFile(path.join(tempDir, '.gitignore'), gitignoreContent, 'utf-8');
  }

  /**
   * Create README in source directory
   */
  private async createSourceReadme(sourceDir: string, projectName: string): Promise<void> {
    const readmeContent = `# ${projectName} - Source Takes

This directory contains the original video take files for the project.

**Important**: These files are never modified. All processing is done on copies.

To add takes to this project, copy your video files to this directory or use the \`add_takes_to_project\` MCP tool.
`;
    await fs.writeFile(path.join(sourceDir, 'README.md'), readmeContent, 'utf-8');
  }

  /**
   * Clean temporary files based on age
   */
  async cleanTempFiles(
    tempDir: string,
    settings: FileOrganizationSettings
  ): Promise<CleanupReport> {

    if (!settings.autoCleanTemp) {
      return { cleaned: false, reason: 'Auto-clean disabled' };
    }

    try {
      const files = await fs.readdir(tempDir, { withFileTypes: true });
      const now = Date.now();
      const maxAge = settings.tempFileMaxAge * 60 * 60 * 1000; // hours to ms

      let deletedCount = 0;
      let freedSpace = 0;

      for (const file of files) {
        // Skip .gitignore
        if (file.name === '.gitignore') continue;

        const filePath = path.join(tempDir, file.name);

        try {
          const stats = await fs.stat(filePath);
          const age = now - stats.mtimeMs;

          if (age > maxAge) {
            freedSpace += stats.size;
            await fs.rm(filePath, { recursive: true, force: true });
            deletedCount++;
          }
        } catch (error: any) {
          // Skip files we can't access
          console.warn(`Failed to clean ${filePath}:`, error.message);
        }
      }

      return {
        cleaned: true,
        deletedCount,
        freedSpace
      };
    } catch (error: any) {
      throw new MultiTakeError(
        ErrorCode.FILE_NOT_ACCESSIBLE,
        `Failed to clean temp files: ${error.message}`,
        { tempDir, error }
      );
    }
  }

  /**
   * Force clean all temporary files
   */
  async forceCleanTemp(tempDir: string): Promise<CleanupReport> {
    try {
      const files = await fs.readdir(tempDir, { withFileTypes: true });
      let deletedCount = 0;
      let freedSpace = 0;

      for (const file of files) {
        // Skip .gitignore
        if (file.name === '.gitignore') continue;

        const filePath = path.join(tempDir, file.name);

        try {
          const stats = await fs.stat(filePath);
          freedSpace += stats.size;
          await fs.rm(filePath, { recursive: true, force: true });
          deletedCount++;
        } catch (error: any) {
          console.warn(`Failed to delete ${filePath}:`, error.message);
        }
      }

      return {
        cleaned: true,
        deletedCount,
        freedSpace
      };
    } catch (error: any) {
      throw new MultiTakeError(
        ErrorCode.FILE_NOT_ACCESSIBLE,
        `Failed to force clean temp files: ${error.message}`,
        { tempDir, error }
      );
    }
  }

  /**
   * Organize take files into source directory
   */
  async organizeTakes(
    sourceFiles: string[],
    sourceDir: string,
    move: boolean = false
  ): Promise<OrganizedFiles> {

    const organized: OrganizedFiles = {
      copied: [],
      failed: [],
      totalSize: 0
    };

    for (const sourcePath of sourceFiles) {
      try {
        // Validate file exists
        await fs.access(sourcePath);

        const fileName = path.basename(sourcePath);
        let destPath = path.join(sourceDir, fileName);

        // Check if file already exists
        if (await this.fileExists(destPath)) {
          // Generate unique name
          destPath = await this.generateUniquePath(sourceDir, fileName);
        }

        // Copy or move the file
        if (move) {
          await fs.rename(sourcePath, destPath);
        } else {
          await fs.copyFile(sourcePath, destPath);
        }

        const stats = await fs.stat(destPath);
        organized.copied.push({
          original: sourcePath,
          destination: destPath,
          size: stats.size
        });
        organized.totalSize += stats.size;

      } catch (error: any) {
        organized.failed.push({
          path: sourcePath,
          error: error.message
        });
      }
    }

    return organized;
  }

  /**
   * Generate output file path with versioning
   */
  generateOutputPath(
    outputDir: string,
    baseName: string,
    extension: string = 'mp4'
  ): string {
    // Remove extension from baseName if present
    const nameWithoutExt = baseName.replace(/\.[^/.]+$/, '');
    return path.join(outputDir, `${nameWithoutExt}_output.${extension}`);
  }

  /**
   * Generate versioned output path
   */
  async generateVersionedOutputPath(
    outputDir: string,
    baseName: string,
    extension: string = 'mp4'
  ): Promise<string> {
    const nameWithoutExt = baseName.replace(/\.[^/.]+$/, '');
    let version = 1;
    let outputPath: string;

    do {
      outputPath = path.join(outputDir, `${nameWithoutExt}_v${version}.${extension}`);
      version++;
    } while (await this.fileExists(outputPath));

    return outputPath;
  }

  /**
   * Generate export file path with timestamp
   */
  generateExportPath(
    exportsDir: string,
    projectName: string,
    format: string = 'mp4'
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeProjectName = projectName.replace(/[^a-z0-9-_]/gi, '_');
    return path.join(exportsDir, `${safeProjectName}_${timestamp}.${format}`);
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate unique file path if file already exists
   */
  private async generateUniquePath(dir: string, fileName: string): Promise<string> {
    const ext = path.extname(fileName);
    const nameWithoutExt = path.basename(fileName, ext);

    let counter = 1;
    let uniquePath: string;

    do {
      uniquePath = path.join(dir, `${nameWithoutExt}_${counter}${ext}`);
      counter++;
    } while (await this.fileExists(uniquePath));

    return uniquePath;
  }

  /**
   * Validate file is accessible
   */
  async validateFile(filePath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      await fs.access(filePath, fs.constants.R_OK);
      return { valid: true };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { valid: false, error: 'File does not exist' };
      } else if (error.code === 'EACCES') {
        return { valid: false, error: 'Permission denied' };
      }
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get directory size
   */
  async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });

      for (const file of files) {
        const filePath = path.join(dirPath, file.name);

        if (file.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath);
        } else {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors (directory might not exist yet)
    }

    return totalSize;
  }

  /**
   * Get workspace statistics
   */
  async getWorkspaceStats(dirs: ProjectDirectories): Promise<{
    sourceSize: number;
    tempSize: number;
    outputSize: number;
    exportsSize: number;
    totalSize: number;
  }> {
    const [sourceSize, tempSize, outputSize, exportsSize] = await Promise.all([
      this.getDirectorySize(dirs.source),
      this.getDirectorySize(dirs.temp),
      this.getDirectorySize(dirs.output),
      this.getDirectorySize(dirs.exports)
    ]);

    return {
      sourceSize,
      tempSize,
      outputSize,
      exportsSize,
      totalSize: sourceSize + tempSize + outputSize + exportsSize
    };
  }
}
