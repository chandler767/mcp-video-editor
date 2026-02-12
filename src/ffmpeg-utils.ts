import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const execFileAsync = promisify(execFile);

export interface FFmpegInfo {
  available: boolean;
  version?: string;
  path?: string;
}

export class FFmpegManager {
  private ffmpegPath: string | null = null;
  private initialized = false;

  async initialize(): Promise<FFmpegInfo> {
    if (this.initialized) {
      return this.getInfo();
    }

    // Try ffmpeg-full first (has all features including drawtext)
    const ffmpegPaths = [
      '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg',  // macOS Homebrew ffmpeg-full
      '/usr/local/opt/ffmpeg-full/bin/ffmpeg',     // macOS Homebrew (Intel)
      'ffmpeg',                                     // System PATH
    ];

    for (const path of ffmpegPaths) {
      try {
        const { stdout } = await execFileAsync(path, ['-version']);
        const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
        this.ffmpegPath = path;
        ffmpeg.setFfmpegPath(this.ffmpegPath);
        this.initialized = true;

        return {
          available: true,
          version: versionMatch ? versionMatch[1] : 'unknown',
          path: path === 'ffmpeg' ? 'ffmpeg (system)' : path
        };
      } catch (error) {
        // Try next path
        continue;
      }
    }

    // If none of the above work, try bundled version as last resort
    try {
      this.ffmpegPath = ffmpegInstaller.path;
      ffmpeg.setFfmpegPath(this.ffmpegPath);

      const { stdout } = await execFileAsync(this.ffmpegPath, ['-version']);
      const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
      this.initialized = true;

      return {
        available: true,
        version: versionMatch ? versionMatch[1] : 'unknown',
        path: this.ffmpegPath
      };
    } catch (bundledError) {
      this.initialized = false;
      return {
        available: false
      };
    }
  }

  getInfo(): FFmpegInfo {
    if (!this.initialized || !this.ffmpegPath) {
      return { available: false };
    }
    return {
      available: true,
      path: this.ffmpegPath
    };
  }

  getPath(): string {
    if (!this.ffmpegPath) {
      throw new Error('FFmpeg not initialized. Call initialize() first.');
    }
    return this.ffmpegPath;
  }

  createCommand(input?: string): ffmpeg.FfmpegCommand {
    if (!this.initialized || !this.ffmpegPath) {
      throw new Error('FFmpeg not initialized. Call initialize() first.');
    }

    const cmd = input ? ffmpeg(input) : ffmpeg();
    cmd.setFfmpegPath(this.ffmpegPath);
    return cmd;
  }
}
