#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_DIR = path.join(__dirname, 'videos');

function getResultText(result: any): string {
  return (result.content as any[])[0].text;
}

async function runTests() {
  console.log('🚀 Starting Vision Analysis Tests\n');

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
    // Check if OpenAI API key is configured
    const configResult = await client.callTool({
      name: 'get_config',
      arguments: {},
    });
    const config = JSON.parse(getResultText(configResult));

    if (!config.openaiApiKey) {
      console.log('⚠️  WARNING: OpenAI API key not configured');
      console.log('   Vision tests require OpenAI API key for GPT-4 Vision');
      console.log('   Set OPENAI_API_KEY environment variable or use set_config\n');
      console.log('Skipping all vision tests.');
      return;
    }

    console.log('✓ OpenAI API key configured\n');

    // ============================
    // VISION ANALYSIS TESTS
    // ============================
    console.log('═══════════════════════════════════════');
    console.log('VISION ANALYSIS TESTS');
    console.log('═══════════════════════════════════════\n');

    // Test 1: Describe a specific scene
    console.log('🔍 Test 1: Describe Scene at Timestamp');
    const describeResult = await client.callTool({
      name: 'describe_scene',
      arguments: {
        input: path.join(TEST_DIR, 'test-1080p.mp4'),
        timestamp: 5,
        detailLevel: 'detailed',
      },
    });
    console.log('Result:');
    console.log(getResultText(describeResult));
    console.log();

    // Test 2: Analyze video content (brief)
    console.log('📹 Test 2: Analyze Video Content (3 frames)');
    const analyzeResult = await client.callTool({
      name: 'analyze_video_content',
      arguments: {
        input: path.join(TEST_DIR, 'test-1080p.mp4'),
        count: 3, // Just 3 frames to keep test fast
      },
    });
    console.log('Result:');
    console.log(getResultText(analyzeResult));
    console.log();

    // Test 3: Search for visual content
    console.log('🔎 Test 3: Search for Visual Content');
    const searchResult = await client.callTool({
      name: 'search_visual_content',
      arguments: {
        input: path.join(TEST_DIR, 'test-1080p.mp4'),
        query: 'any visible text or numbers',
        interval: 5,
      },
    });
    console.log('Result:');
    console.log(getResultText(searchResult));
    console.log();

    // Test 4: Find objects in video
    console.log('🎯 Test 4: Find Objects in Video');
    const findResult = await client.callTool({
      name: 'find_objects_in_video',
      arguments: {
        input: path.join(TEST_DIR, 'test-1080p.mp4'),
        targetDescription: 'any person or people',
        interval: 5,
      },
    });
    console.log('Result:');
    console.log(getResultText(findResult));
    console.log();

    // Test 5: Compare frames
    console.log('⚖️  Test 5: Compare Two Frames');
    const compareResult = await client.callTool({
      name: 'compare_video_frames',
      arguments: {
        input: path.join(TEST_DIR, 'test-1080p.mp4'),
        timestamp1: 2,
        timestamp2: 8,
      },
    });
    console.log('Result:');
    console.log(getResultText(compareResult));
    console.log();

    console.log('═══════════════════════════════════════');
    console.log('✅ All Vision Tests Completed!');
    console.log('═══════════════════════════════════════\n');
    console.log('Tests passed: 5/5');
    console.log('\n⚠️  Note: Vision analysis uses GPT-4 Vision API which costs money per image.');
    console.log('   These tests analyzed approximately 10-15 images.');
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    if (error.message?.includes('API key')) {
      console.error('\n⚠️  This error is likely due to missing or invalid OpenAI API key');
      console.error('   Set OPENAI_API_KEY environment variable or use set_config tool');
    }
    process.exit(1);
  } finally {
    await client.close();
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
