# [![Purinton Dev](https://purinton.us/logos/brand.png)](https://discord.gg/QSBxQnX7PF)

## @purinton/mcp-server [![npm version](https://img.shields.io/npm/v/@purinton/mcp-server.svg)](https://www.npmjs.com/package/@purinton/mcp-server)[![license](https://img.shields.io/github/license/purinton/mcp-server.svg)](LICENSE)[![build status](https://github.com/purinton/mcp-server/actions/workflows/nodejs.yml/badge.svg)](https://github.com/purinton/mcp-server/actions)

> A Node.js server for the Model Context Protocol (MCP) with dynamic tool loading, HTTP API, and authentication. Easily extendable with custom tools for AI and automation workflows. Supports both CommonJS and ESM.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [ESM Example](#esm-example)
  - [CommonJS Example](#commonjs-example)
  - [Custom Tool Example (ESM)](#custom-tool-example-esm)
  - [Custom Tool Example (CommonJS)](#custom-tool-example-commonjs)
- [API](#api)
- [TypeScript](#typescript)
- [License](#license)

## Features

- Model Context Protocol (MCP) server implementation for Node.js
- Dynamic tool loading from a directory (`tools/`)
  - **Loads `.mjs` files in ESM mode, `.cjs` files in CommonJS mode**
- HTTP API with authentication (Bearer token or custom async callback)
- Express-based, easy to extend
- Utility helpers for tool responses and BigInt-safe serialization
- TypeScript type definitions included
- Supports both CommonJS and ESM usage

## Installation

```bash
npm install @purinton/mcp-server
```

## Usage

### ESM Example

```js
// Example for ESM (module JS) usage
import { mcpServer } from '@purinton/mcp-server';

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
```

### CommonJS Example

```js
// Example for CommonJS usage
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
```

> **Note:**
>
> - In ESM mode, tools must be `.mjs` files and use the ESM export signature.
> - In CommonJS mode, tools must be `.cjs` files and use the CommonJS export signature.

### Custom Tool Example (ESM)

To add your own tool for ESM, create a file in the `tools/` directory (e.g., `tools/echo.mjs`):

```js
import { z, buildResponse } from '@purinton/mcp-server';

export default async function ({ mcpServer, toolName, log }) {
  mcpServer.tool(
    toolName,
    "Echo Tool",
    { echoText: z.string() },
    async (_args, _extra) => {
      log.debug(`${toolName} Request`, { _args });
      const response = {
        message: "echo-reply",
        data: {
          text: _args.echoText
        }
      };
      log.debug(`${toolName} Response`, { response });
      return buildResponse(response);
    }
  );
}
```

### Custom Tool Example (CommonJS)

To add your own tool for CommonJS, create a file in the `tools/` directory (e.g., `tools/echo.cjs`):

```js
const { z, buildResponse } = require('@purinton/mcp-server');

module.exports = async function ({ mcpServer, toolName, log }) {
  mcpServer.tool(
    toolName,
    "Echo Tool",
    { echoText: z.string() },
    async (_args, _extra) => {
      log.debug(`${toolName} Request`, { _args });
      const response = {
        message: "echo-reply",
        data: {
          text: _args.echoText
        }
      };
      log.debug(`${toolName} Response`, { response });
      return buildResponse(response);
    }
  );
};
```

## API

### `async mcpServer(options): Promise<{ app, httpInstance, mcpServer, transport }>```

Starts the MCP + HTTP server. Options:

- `log` (optional): Logger instance (default: @purinton/log)
- `toolsDir` (optional): Path to tools directory (default: `./tools` relative to the entry file)
- `port` (optional): Port for HTTP server (default: 1234 or `process.env.MCP_PORT`)
- `authToken` (optional): Bearer token for authentication (default: `process.env.MCP_TOKEN`)
- `authCallback` (optional): Custom async callback for authentication. Receives `(token)` and returns `true`/`false` or a Promise.
- `name` (optional): Name for the MCP server
- `version` (optional): Version for the MCP server
- `context` (optional): Context object to attach to the MCP server and pass to tools (e.g. database, redis, etc.)

Returns an object with:

- `app`: Express application instance
- `httpInstance`: HTTP server instance
- `mcpServer`: MCP server instance
- `transport`: HTTP transport instance

### `convertBigIntToString(value)`

Recursively converts all BigInt values in an object to strings.

### `buildResponse(data)`

Wraps a plain JS object into the standard tool response payload.

### `z`

Re-exports [zod](https://github.com/colinhacks/zod) for schema validation.

## TypeScript

Type definitions are included:

```ts
export interface McpServerOptions {
  log?: any;
  toolsDir?: string;
  port?: number | string;
  authToken?: string;
  authCallback?: (token?: string) => boolean | Promise<boolean>;
  name?: string;
  version?: string;
  context?: any;
}

export interface McpServerResult {
  app: import('express').Application;
  httpInstance: import('http').Server;
  mcpServer: any;
  transport: any;
}

export function mcpServer(options?: McpServerOptions): Promise<McpServerResult>;
export function convertBigIntToString(value: any): any;
export function buildResponse(data: any): { content: { type: 'text'; text: string }[] };
export { z };
```

## Support

For help, questions, or to chat with the author and community, visit:

[![Discord](https://purinton.us/logos/discord_96.png)](https://discord.gg/QSBxQnX7PF)[![Purinton Dev](https://purinton.us/logos/purinton_96.png)](https://discord.gg/QSBxQnX7PF)

**[Purinton Dev on Discord](https://discord.gg/QSBxQnX7PF)**

## License

[MIT © 2025 Russell Purinton](LICENSE)

## Links

- [GitHub](https://github.com/purinton/mcp-server)
- [npm](https://www.npmjs.com/package/@purinton/mcp-server)
- [Discord](https://discord.gg/QSBxQnX7PF)
