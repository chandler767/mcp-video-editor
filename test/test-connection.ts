#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testConnection() {
  console.log('🔌 Testing MCP Server Connection\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, '../src/index.js')],
  });

  const client = new Client(
    {
      name: 'connection-test',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);
    console.log('✅ Successfully connected to MCP server\n');

    // List available tools
    const tools = await client.listTools();
    console.log(`📋 Found ${tools.tools.length} tools:`);
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}`);
    });

    console.log('\n✅ MCP server is working correctly!');
    console.log('\n📝 Configuration added to:');
    console.log('   - Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json');
    console.log('   - Claude Code: ~/.claude.json');
    console.log('\n💡 Restart Claude Desktop or Claude Code to see the video-editor tools!');

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

testConnection();
