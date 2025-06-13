import type { Application } from 'express';
import type { Server as HTTPServer } from 'http';
import type { ZodTypeAny } from 'zod';

export interface McpServerOptions {
  logger?: any;
  toolsDir?: string;
  port?: number | string;
  authToken?: string;
  name?: string;
  version?: string;
}

export interface McpServerResult {
  app: Application;
  httpInstance: HTTPServer;
  mcpServer: any;
  transport: any;
}

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
