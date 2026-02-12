#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_DIR = path.join(__dirname, 'videos');
const OUTPUT_DIR = path.join(__dirname, 'output');

function getResultText(result: any): string {
  return (result.content as any[])[0].text;
}

async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    // Directory exists
  }
}

async function runTests() {
  console.log('🚀 Starting MCP Video Editor Tests\n');

  await ensureOutputDir();

  // Start the MCP server
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, '../src/index.js')],
  });

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);

  console.log('✓ Connected to MCP server\n');

  try {
    // Test 1: List available tools
    console.log('📋 Test 1: List Tools');
    const toolsResult = await client.listTools();
    console.log(`Found ${toolsResult.tools.length} tools:`);
    toolsResult.tools.forEach(tool => console.log(`  - ${tool.name}`));
    console.log();

    // Test 2: Get video info
    console.log('📊 Test 2: Get Video Info');
    const infoResult = await client.callTool({
      name: 'get_video_info',
      arguments: {
        filePath: path.join(TEST_DIR, 'test-1080p.mp4'),
      },
    });
    console.log('Result:', getResultText(infoResult));
    console.log();

    // Test 3: Trim video
    console.log('✂️  Test 3: Trim Video');
    const trimResult = await client.callTool({
      name: 'trim_video',
      arguments: {
        input: path.join(TEST_DIR, 'test-1080p.mp4'),
        output: path.join(OUTPUT_DIR, 'trimmed.mp4'),
        startTime: 2,
        duration: 5,
      },
    });
    console.log('Result:', getResultText(trimResult));
    console.log();

    // Test 4: Resize video
    console.log('📐 Test 4: Resize Video');
    const resizeResult = await client.callTool({
      name: 'resize_video',
      arguments: {
        input: path.join(TEST_DIR, 'test-1080p.mp4'),
        output: path.join(OUTPUT_DIR, 'resized-480p.mp4'),
        width: 854,
        height: 480,
      },
    });
    console.log('Result:', getResultText(resizeResult));
    console.log();

    // Test 5: Extract audio
    console.log('🎵 Test 5: Extract Audio');
    const audioResult = await client.callTool({
      name: 'extract_audio',
      arguments: {
        input: path.join(TEST_DIR, 'test-1080p.mp4'),
        output: path.join(OUTPUT_DIR, 'audio.wav'),
      },
    });
    console.log('Result:', getResultText(audioResult));
    console.log();

    // Test 6: Concatenate videos
    console.log('🔗 Test 6: Concatenate Videos');
    const concatResult = await client.callTool({
      name: 'concatenate_videos',
      arguments: {
        inputs: [
          path.join(TEST_DIR, 'test-part1.mp4'),
          path.join(TEST_DIR, 'test-part2.mp4'),
        ],
        output: path.join(OUTPUT_DIR, 'concatenated.mp4'),
      },
    });
    console.log('Result:', getResultText(concatResult));
    console.log();

    // Test 7: Extract frames
    console.log('🖼️  Test 7: Extract Frames');
    const framesResult = await client.callTool({
      name: 'extract_frames',
      arguments: {
        input: path.join(TEST_DIR, 'test-1080p.mp4'),
        output: path.join(OUTPUT_DIR, 'frame-%d.png'),
        timestamps: [1, 3, 5, 7],
      },
    });
    console.log('Result:', getResultText(framesResult));
    console.log();

    // Test 8: Convert video
    console.log('🔄 Test 8: Convert Video');
    const convertResult = await client.callTool({
      name: 'convert_video',
      arguments: {
        input: path.join(TEST_DIR, 'test-1080p.mp4'),
        output: path.join(OUTPUT_DIR, 'converted-high-quality.mp4'),
        quality: '18',
        preset: 'fast',
      },
    });
    console.log('Result:', getResultText(convertResult));
    console.log();

    // Test 9: Adjust speed
    console.log('⚡ Test 9: Adjust Speed');
    const speedResult = await client.callTool({
      name: 'adjust_speed',
      arguments: {
        input: path.join(TEST_DIR, 'test-short.mp4'),
        output: path.join(OUTPUT_DIR, 'fast-2x.mp4'),
        speed: 2.0,
      },
    });
    console.log('Result:', getResultText(speedResult));
    console.log();

    // Test 10: Config management
    console.log('⚙️  Test 10: Get Config');
    const configResult = await client.callTool({
      name: 'get_config',
      arguments: {},
    });
    console.log('Result:', getResultText(configResult));
    console.log();

    console.log('✅ Test 11: Set Config');
    const setConfigResult = await client.callTool({
      name: 'set_config',
      arguments: {
        defaultQuality: '20',
        defaultPreset: 'fast',
      },
    });
    console.log('Result:', getResultText(setConfigResult));
    console.log();

    console.log('✅ All tests completed successfully!');
    console.log(`📁 Output files: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
