import type { Application } from 'express';
import type { Server as HTTPServer } from 'http';

export interface McpServerOptions {
  logger?: any;
  toolsDir?: string;
  port?: number | string;
  authToken?: string;
  /**
   * Optional async callback for custom auth. Receives (token) and returns true/false or Promise<boolean>.
   */
  authCallback?: (token?: string) => boolean | Promise<boolean>;
  name?: string;
  version?: string;
  context?: any;
}

export interface McpServerResult {
  app: Application;
  httpInstance: HTTPServer;
  mcpServer: any;
  transport: any;
}

/**
 * Start the MCP + HTTP server.
 *
 * Tools are loaded from the toolsDir as .mjs files and registered with the signature:
 *   export default async function ({ mcpServer, toolName, log }) { ... }
 */
export function mcpServer(options?: McpServerOptions): Promise<McpServerResult>;

/**
 * Recursively convert all BigInt values in an object to strings.
 */
export function convertBigIntToString(value: any): any;

/**
 * Wrap a plain JS object into the standard tool response payload.
 */
export function buildResponse(data: any): { content: { type: 'text'; text: string }[] };

export { z };
