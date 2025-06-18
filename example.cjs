// Example usage for CommonJS (example.cjs)
const { mcpServer } = require('@purinton/mcp-server');

(async () => {
  const { app, httpInstance } = await mcpServer({
    // port: 1234, // You can change the port as needed
    // authToken: 'your-secret-token', // You can still use this for static token auth
    // toolsDir: './tools', // Path to your tools directory
    // name: 'Example MCP Server', // Set your server name
    // version: '1.0.0', // Set your server version
    // // Example: custom async auth callback
    // authCallback: async (token) => {
    //  // Replace with your own logic, e.g. check token in DB or against a list
    //  return token === 'your-secret-token';
    // },
    // context: { example: 'context' } // Optional context to pass to tools _extra (db, redis, etc.)
  });
  console.log('MCP Server started!');
})();
