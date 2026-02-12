import fs from 'fs/promises';
import path from 'path';

export interface VideoConfig {
  defaultOutputFormat?: string;
  defaultQuality?: string; // crf value or quality preset
  defaultCodec?: string;
  defaultAudioCodec?: string;
  defaultAudioBitrate?: string;
  defaultVideoBitrate?: string;
  defaultPreset?: string; // ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
  workingDirectory?: string;
  openaiApiKey?: string; // For transcript features
}

const DEFAULT_CONFIG: VideoConfig = {
  defaultOutputFormat: 'mp4',
  defaultQuality: '23', // CRF value (lower = better quality, 18-28 is reasonable range)
  defaultCodec: 'libx264',
  defaultAudioCodec: 'aac',
  defaultAudioBitrate: '192k',
  defaultVideoBitrate: undefined, // Auto by default
  defaultPreset: 'medium',
  workingDirectory: process.cwd()
};

export class ConfigManager {
  private config: VideoConfig;
  private configPath: string;

  constructor(workingDir?: string) {
    this.configPath = path.join(workingDir || process.cwd(), '.mcp-video-config.json');
    this.config = { ...DEFAULT_CONFIG };
  }

  async load(): Promise<VideoConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (error) {
      // Config doesn't exist, use defaults
      this.config = { ...DEFAULT_CONFIG };
    }
    return this.config;
  }

  async save(config: Partial<VideoConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  get(): VideoConfig {
    return { ...this.config };
  }

  async reset(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    try {
      await fs.unlink(this.configPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }
  }
}
