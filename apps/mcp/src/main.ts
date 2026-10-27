import { readFileSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './index.js';
async function main() {
 const configPath = process.env.SCHEMA_BARON_MCP_CONFIG;
 if (!configPath) throw new Error('Missing private MCP configuration.');
 const config = JSON.parse(readFileSync(configPath, 'utf8'));
 const server = createMcpServer(config);
 await server.connect(new StdioServerTransport());
}
main().catch(() => { process.stderr.write('Schema Baron MCP failed; check private owner connection configuration.\n'); process.exitCode = 1; });
