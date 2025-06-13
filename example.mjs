// Example usage for ESM (example.mjs)
import { mcpServer } from '@purinton/mcp-server';

(async () => {
  const { app, httpInstance } = await mcpServer({
    port: 1234, // You can change the port as needed
    authToken: 'your-secret-token', // Set your token here
    toolsDir: './tools.example', // Path to your tools directory
    name: 'Example MCP Server', // Set your server name
    version: '1.0.0' // Set your server version
  });
  console.log('MCP Server started on port 1234');
})();
