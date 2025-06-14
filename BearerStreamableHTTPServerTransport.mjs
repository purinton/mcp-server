import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

/**
 * Subclass of StreamableHTTPServerTransport that injects the HTTP Bearer token
 * into the extra context passed to MCP tool handlers.
 */
export class BearerStreamableHTTPServerTransport extends StreamableHTTPServerTransport {
  async handleRequest(req, res, body, extra = {}) {
    // Extract bearer token from HTTP headers if not already provided
    let bearerToken = extra.bearerToken;
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!bearerToken && authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.slice('Bearer '.length).trim();
    }
    if (bearerToken) {
      // set global fallback for legacy code
      global.__currentBearerToken__ = bearerToken;
      extra.bearerToken = bearerToken;
    }
    return super.handleRequest(req, res, body, extra);
  }
}
