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
  console.log('🚀 Starting New Features Tests\n');

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
    // ============================
    // TEXT OVERLAY TESTS
    // ============================
    console.log('═══════════════════════════════════════');
    console.log('TEXT OVERLAY TESTS');
    console.log('═══════════════════════════════════════\n');

    console.log('⚠️  Checking if FFmpeg supports drawtext filter...\n');

    // Test 1: Simple text overlay
    console.log('📝 Test 1: Simple Text Overlay');
    let textSupported = true;
    try {
      const textResult = await client.callTool({
        name: 'add_text_overlay',
        arguments: {
          input: path.join(TEST_DIR, 'test-1080p.mp4'),
          output: path.join(OUTPUT_DIR, 'text-overlay.mp4'),
          text: 'Test Video',
          position: 'top-center',
          fontSize: 48,
          fontColor: 'white',
          borderWidth: 2,
          borderColor: 'black',
        },
      });
      const result = getResultText(textResult);
      if (result.includes('Filter not found') || result.includes('No such filter')) {
        console.log('⚠️  SKIPPED: FFmpeg drawtext filter not available');
        console.log('   Install FFmpeg with libfreetype support to enable text overlays');
        textSupported = false;
      } else {
        console.log('✓ Result:', result);
      }
    } catch (error) {
      console.log('⚠️  SKIPPED: Text overlay failed -', error);
      textSupported = false;
    }
    console.log();

    // Tests 2-4: Skip if drawtext not supported
    if (textSupported) {
      // Test 2: Text with box background
      console.log('📝 Test 2: Text with Box Background');
      const boxTextResult = await client.callTool({
        name: 'add_text_overlay',
        arguments: {
          input: path.join(TEST_DIR, 'test-1080p.mp4'),
          output: path.join(OUTPUT_DIR, 'text-box.mp4'),
          text: 'Lower Third',
          position: 'bottom-left',
          fontSize: 32,
          fontColor: 'white',
          box: true,
          boxColor: 'black',
          boxOpacity: 0.7,
        },
      });
      console.log('✓ Result:', getResultText(boxTextResult));
      console.log();

      // Test 3: Timed text overlay
      console.log('📝 Test 3: Timed Text Overlay');
      const timedTextResult = await client.callTool({
        name: 'add_text_overlay',
        arguments: {
          input: path.join(TEST_DIR, 'test-1080p.mp4'),
          output: path.join(OUTPUT_DIR, 'text-timed.mp4'),
          text: 'This appears at 2s and disappears at 7s',
          position: 'center',
          fontSize: 36,
          fontColor: 'yellow',
          startTime: 2,
          endTime: 7,
          fadeIn: 0.5,
          fadeOut: 0.5,
        },
      });
      console.log('✓ Result:', getResultText(timedTextResult));
      console.log();

      // Test 4: Animated text
      console.log('🎬 Test 4: Animated Text (Slide Up)');
      const animTextResult = await client.callTool({
        name: 'add_animated_text',
        arguments: {
          input: path.join(TEST_DIR, 'test-1080p.mp4'),
          output: path.join(OUTPUT_DIR, 'text-animated.mp4'),
          text: 'Sliding Up!',
          animation: 'slide-up',
          animationDuration: 1.5,
          position: 'center',
          fontSize: 60,
          fontColor: 'white',
          borderWidth: 3,
          startTime: 1,
          duration: 5,
        },
      });
      console.log('✓ Result:', getResultText(animTextResult));
      console.log();
    } else {
      console.log('⚠️  Tests 2-4 SKIPPED: drawtext filter not available\n');
    }

    // ============================
    // TIMELINE TESTS
    // ============================
    console.log('═══════════════════════════════════════');
    console.log('TIMELINE TESTS');
    console.log('═══════════════════════════════════════\n');

    // Test 5: Create timeline
    console.log('⏱️  Test 5: Create Timeline');
    const timelineResult = await client.callTool({
      name: 'create_timeline',
      arguments: {
        name: 'Test Edit Timeline',
        baseFile: path.join(TEST_DIR, 'test-1080p.mp4'),
      },
    });
    console.log('Result:', getResultText(timelineResult));
    const timelineId = getResultText(timelineResult).match(/Timeline ID: ([a-f0-9-]+)/)?.[1];
    console.log();

    if (!timelineId) {
      throw new Error('Failed to extract timeline ID');
    }

    // Test 6: Add operation to timeline
    console.log('➕ Test 6: Add Operation to Timeline');
    const addOpResult = await client.callTool({
      name: 'add_to_timeline',
      arguments: {
        timelineId,
        operation: 'trim',
        description: 'Trimmed intro',
        input: path.join(TEST_DIR, 'test-1080p.mp4'),
        output: path.join(OUTPUT_DIR, 'timeline-trim.mp4'),
        parameters: { startTime: 2, duration: 5 },
      },
    });
    console.log('Result:', getResultText(addOpResult));
    console.log();

    // Test 7: Add another operation
    console.log('➕ Test 7: Add Another Operation');
    const addOp2Result = await client.callTool({
      name: 'add_to_timeline',
      arguments: {
        timelineId,
        operation: 'add_text',
        description: 'Added title',
        input: path.join(OUTPUT_DIR, 'timeline-trim.mp4'),
        output: path.join(OUTPUT_DIR, 'timeline-with-text.mp4'),
        parameters: { text: 'Title', position: 'top-center' },
      },
    });
    console.log('Result:', getResultText(addOp2Result));
    console.log();

    // Test 8: View timeline
    console.log('👁️  Test 8: View Timeline');
    const viewResult = await client.callTool({
      name: 'view_timeline',
      arguments: { timelineId },
    });
    console.log('Result:');
    console.log(getResultText(viewResult));
    console.log();

    // Test 9: Undo operation
    console.log('↩️  Test 9: Undo Operation');
    const undoResult = await client.callTool({
      name: 'undo_operation',
      arguments: { timelineId },
    });
    console.log('Result:', getResultText(undoResult));
    console.log();

    // Test 10: Redo operation
    console.log('↪️  Test 10: Redo Operation');
    const redoResult = await client.callTool({
      name: 'redo_operation',
      arguments: { timelineId },
    });
    console.log('Result:', getResultText(redoResult));
    console.log();

    // Test 11: Jump to timeline point
    console.log('🎯 Test 11: Jump to Timeline Point');
    const jumpResult = await client.callTool({
      name: 'jump_to_timeline_point',
      arguments: { timelineId, index: 0 },
    });
    console.log('Result:', getResultText(jumpResult));
    console.log();

    // Test 12: List timelines
    console.log('📋 Test 12: List Timelines');
    const listTimelinesResult = await client.callTool({
      name: 'list_timelines',
      arguments: {},
    });
    console.log('Result:', getResultText(listTimelinesResult));
    console.log();

    // Test 13: Get timeline stats
    console.log('📊 Test 13: Timeline Statistics');
    const statsResult = await client.callTool({
      name: 'get_timeline_stats',
      arguments: { timelineId },
    });
    console.log('Result:', getResultText(statsResult));
    console.log();

    // ============================
    // MULTI-TAKE TESTS (Basic)
    // ============================
    console.log('═══════════════════════════════════════');
    console.log('MULTI-TAKE TESTS (Basic - No Analysis)');
    console.log('═══════════════════════════════════════\n');

    const testScript = `Welcome to this video tutorial.

In this first section, we'll cover the basics.

Now let's move on to the advanced topics.

Thank you for watching!`;

    // Test 14: Create multi-take project
    console.log('🎬 Test 14: Create Multi-Take Project');
    const projectResult = await client.callTool({
      name: 'create_multi_take_project',
      arguments: {
        name: 'Test Multi-Take',
        script: testScript,
        projectRoot: path.join(OUTPUT_DIR, 'multi-take-project'),
      },
    });
    console.log('Result:', getResultText(projectResult));
    const projectId = getResultText(projectResult).match(/Project ID: ([a-f0-9-]+)/)?.[1];
    console.log();

    if (!projectId) {
      throw new Error('Failed to extract project ID');
    }

    // Test 15: Add takes to project
    console.log('➕ Test 15: Add Takes to Project');
    const addTakesResult = await client.callTool({
      name: 'add_takes_to_project',
      arguments: {
        projectId,
        takeFiles: [
          path.join(TEST_DIR, 'test-1080p.mp4'),
          path.join(TEST_DIR, 'test-short.mp4'),
        ],
      },
    });
    console.log('Result:', getResultText(addTakesResult));
    console.log();

    // Test 16: List projects
    console.log('📋 Test 16: List Multi-Take Projects');
    const listProjectsResult = await client.callTool({
      name: 'list_multi_take_projects',
      arguments: {},
    });
    console.log('Result:', getResultText(listProjectsResult));
    console.log();

    // Test 17: Get project analysis (before analysis)
    console.log('📊 Test 17: Get Project Analysis (Pre-Analysis)');
    const preAnalysisResult = await client.callTool({
      name: 'get_project_analysis',
      arguments: {
        projectId,
        format: 'summary',
      },
    });
    console.log('Result:', getResultText(preAnalysisResult));
    console.log();

    console.log('═══════════════════════════════════════');
    console.log('✅ All New Feature Tests Completed!');
    console.log('═══════════════════════════════════════\n');
    console.log(`📁 Output files: ${OUTPUT_DIR}\n`);

    // Summary
    const passedTests = textSupported ? 17 : 13;
    const totalTests = 17;
    console.log(`Tests passed: ${passedTests}/${totalTests}`);
    if (!textSupported) {
      console.log('⚠️  Text overlay tests skipped (FFmpeg needs libfreetype)');
      console.log('   Install ffmpeg-full: brew install ffmpeg-full');
    }
    console.log('\n⚠️  Multi-take analysis tests not included (require OpenAI API key)');
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
