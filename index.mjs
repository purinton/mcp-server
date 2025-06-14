import fs from 'fs';
import { z } from 'zod';
import http from 'http';
import express from 'express';
import logger from '@purinton/log';
import { path, pathUrl } from '@purinton/path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

/**
 * Start the MCP + HTTP server.
 * @param {Object} options
 * @param {Object} [options.log] - Logger instance (default: @purinton/log)
 * @param {string} [options.toolsDir] - Path to tools directory (default: ./tools relative to this file)
 * @param {number|string} [options.port] - Port for HTTP server (default: process.env.MCP_PORT || 1234)
 * @param {string} [options.authToken] - Bearer token for authentication (default: process.env.MCP_TOKEN)
 * @param {function} [options.authCallback] - Optional async callback for custom auth. Receives (token) and returns true/false.
 * @param {string} [options.name] - Name for the MCP server (default: 'MCP Server')
 * @param {string} [options.version] - Version for the MCP server (default: '1.0.0' or package.json version)
 * @returns {Promise<{ app, httpInstance, mcpServer, transport }>}
 */
export async function mcpServer({
  log = logger,
  toolsDir = path(import.meta, 'tools'),
  port = process.env.MCP_PORT || 1234,
  authToken = process.env.MCP_TOKEN,
  authCallback = undefined,
  name,
  version
} = {}) {
  try {
    const packageJsonPath = path(import.meta, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    name = name || packageJson.name || '@purinton/mcp-server';
    version = version || packageJson.version || '1.0.0';
  } catch (err) {
    log.warn('[SERVER] Could not read package.json for version:', err && err.stack ? err.stack : err);
  }
  const mcpServer = new McpServer({ name, version }, { capabilities: { resources: {} } });
  mcpServer.options = { name, version };
  try {
    const toolFiles = fs.readdirSync(toolsDir).filter(f => f.endsWith('.mjs'));
    let toolCount = 0;
    for (const file of toolFiles) {
      try {
        const toolName = file.replace(/\.mjs$/, '');
        const mod = await import(pathUrl(toolsDir, file));
        if (typeof mod.default === 'function') {
          await mod.default({ mcpServer, toolName, log });
          log.debug(`Registered MCP tool from ${file}`);
          toolCount++;
        } else {
          log.warn(`No default export function in ${file}`);
        }
      } catch (toolErr) {
        log.error(`Error registering MCP tool from ${file}:`, toolErr);
      }
    }
    log.debug('Registered ' + toolCount + ' tools');
  } catch (toolErr) {
    log.error('Error registering MCP tools:', toolErr);
  }

  const transport = new StreamableHTTPServerTransport({});
  try {
    await mcpServer.connect(transport);
    log.debug('MCP Server ' + version + ' connected successfully');
  } catch (err) {
    log.error('MCP Server connection error:', err && err.stack ? err.stack : err);
    throw err;
  }

  const app = express();
  app.use(express.json());
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(406).json({ error: 'Invalid JSON' });
    }
    next(err);
  });

  app.use((req, res, next) => {
    if (req.method === 'GET' && req.url === '/') {
      return next();
    }
    let bodyText = '';
    try {
      bodyText = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : '';
    } catch (e) {
      bodyText = '[unserializable body]';
    }
    if (logger) {
      if (req.method === 'GET') {
        log.debug(`[HTTP] ${req.method} ${req.url} from ${req.ip} body=${bodyText}`);
      } else if (req.method === 'POST') {
        log.debug(`[HTTP] ${req.method} ${req.url} from ${req.ip} body=${bodyText}`);
      } else {
        log.debug(`[HTTP] ${req.method} ${req.url} from ${req.ip} body=${bodyText}`);
      }
    }
    next();
  });

  app.use((req, res, next) => {
    if (req.method === 'GET' && req.url === '/') {
      return next();
    }
    const oldSend = res.send;
    const oldEnd = res.end;
    const oldWrite = res.write;
    let chunks = [];

    res.send = function (body) {
      if (body) chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body));
      res.send = oldSend;
      return oldSend.call(this, body);
    };

    res.write = function (chunk, ...args) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return oldWrite.call(this, chunk, ...args);
    };

    res.end = function (chunk, ...args) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const bodyText = chunks.length ? Buffer.concat(chunks).toString('utf8') : '';
      if (logger) {
        if (req.method === 'GET') {
          log.debug(`[HTTP RES] ${req.method} ${req.url} -> ${res.statusCode} body=${bodyText}`);
        } else if (req.method === 'POST') {
          log.debug(`[HTTP RES] ${req.method} ${req.url} -> ${res.statusCode} body=${bodyText}`);
        } else {
          log.debug(`[HTTP RES] ${req.method} ${req.url} -> ${res.statusCode} body=${bodyText}`);
        }
      }
      res.end = oldEnd;
      return oldEnd.call(this, chunk, ...args);
    };

    next();
  });

  app.use(async (req, res, next) => {
    if (req.method === 'POST' && req.url === '/') {
      const authHeader = req.headers['authorization'] || req.headers['Authorization'];
      const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : undefined;
      if (authCallback) {
        try {
          const result = await authCallback(token);
          if (!result) {
            return res.status(401).json({ error: 'Invalid bearer token (authCallback)' });
          }
        } catch (err) {
          return res.status(500).json({ error: 'Auth callback error', details: err && err.stack ? err.stack : String(err) });
        }
      } else {
        if (!authToken) {
          return res.status(500).json({ error: 'MCP_TOKEN not set in environment' });
        }
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }
        if (token !== authToken) {
          return res.status(401).json({ error: 'Invalid bearer token' });
        }
      }
    }
    next();
  });

  app.get('/', (req, res) => {
    res.status(200).send('GET / endpoint - no action');
  });

  app.post('/', async (req, res) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (logger) log.error('Error handling / POST request:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal MCP server error', details: err && err.stack ? err.stack : String(err) });
      }
    }
  });

  const httpInstance = http.createServer(app);
  httpInstance.on('error', (err) => {
    log.error('HTTP server error:', err && err.stack ? err.stack : err);
  });

  httpInstance.listen(port, () => {
    log.debug(`MCP HTTP Server listening on port ${port}`);
  });

  return { app, httpInstance, mcpServer, transport };
}


/**
 * Recursively convert all BigInt values in an object to strings.
 * @param {any} value
 * @returns {any}
 */
export function convertBigIntToString(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  } else if (Array.isArray(value)) {
    return value.map(convertBigIntToString);
  } else if (value && typeof value === 'object') {
    const result = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = convertBigIntToString(value[key]);
      }
    }
    return result;
  }
  return value;
}

/**
 * Wrap a plain JS object into the standard tool response payload.
 * @param {any} data
 * @returns {{ content: [ { type: 'text', text: string } ] }}
 */
export function buildResponse(data) {
  const safeData = convertBigIntToString(data);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(safeData, null, 2),
      },
    ],
  };
}

export { z };