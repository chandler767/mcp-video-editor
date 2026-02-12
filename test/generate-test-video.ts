#!/usr/bin/env node
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_DIR = path.join(__dirname, 'videos');

async function ensureTestDir() {
  try {
    await fs.mkdir(TEST_DIR, { recursive: true });
  } catch (error) {
    // Directory exists
  }
}

async function checkFFmpeg(): Promise<string> {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return 'ffmpeg';
  } catch (error) {
    throw new Error('FFmpeg not found. Please install FFmpeg to generate test videos.');
  }
}

async function generateTestVideo(
  name: string,
  duration: number,
  width: number,
  height: number,
  options: string[] = []
): Promise<string> {
  const outputPath = path.join(TEST_DIR, name);

  console.log(`Generating ${name}...`);

  // Generate a test video with color bars and timestamp
  const ffmpegPath = await checkFFmpeg();

  const args = [
    '-f', 'lavfi',
    '-i', `testsrc=duration=${duration}:size=${width}x${height}:rate=30`,
    '-f', 'lavfi',
    '-i', 'sine=frequency=1000:duration=' + duration,
    '-pix_fmt', 'yuv420p',
    ...options,
    '-y',
    outputPath
  ];

  await execFileAsync(ffmpegPath, args);
  console.log(`✓ Created ${name}`);

  return outputPath;
}

async function main() {
  console.log('Generating test videos...\n');

  await ensureTestDir();

  try {
    // Generate various test videos
    await generateTestVideo('test-1080p.mp4', 10, 1920, 1080, ['-c:v', 'libx264', '-preset', 'fast']);
    await generateTestVideo('test-720p.mp4', 5, 1280, 720, ['-c:v', 'libx264', '-preset', 'fast']);
    await generateTestVideo('test-short.mp4', 3, 640, 480, ['-c:v', 'libx264', '-preset', 'fast']);
    await generateTestVideo('test-part1.mp4', 4, 1280, 720, ['-c:v', 'libx264', '-preset', 'fast']);
    await generateTestVideo('test-part2.mp4', 4, 1280, 720, ['-c:v', 'libx264', '-preset', 'fast']);

    console.log('\n✅ All test videos generated successfully!');
    console.log(`📁 Location: ${TEST_DIR}`);
  } catch (error) {
    console.error('❌ Error generating test videos:', error);
    process.exit(1);
  }
}

main();
