const fs = require('fs');
const http = require('http');
const express = require('express');
const log = require('@purinton/log');
const { path, pathUrl } = require('@purinton/path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');

/**
 * Start the MCP + HTTP server.
 * @param {Object} options
 * @param {Object} [options.log] - Logger instance (default: @purinton/log)
 * @param {string} [options.toolsDir] - Path to tools directory (default: ./tools relative to this file)
 * @param {number|string} [options.port] - Port for HTTP server (default: process.env.MCP_PORT || 1234)
 * @param {string} [options.authToken] - Bearer token for authentication (default: process.env.MCP_TOKEN)
 * @param {string} [options.name] - Name for the MCP server (default: 'MCP Server')
 * @param {string} [options.version] - Version for the MCP server (default: '1.0.0' or package.json version)
 * @returns {Promise<{ app, httpInstance, mcpServer, transport }>}
 */
async function mcpServer({
    logger = log,
    toolsDir = path(__dirname, 'tools'),
    port = process.env.MCP_PORT || 1234,
    authToken = process.env.MCP_TOKEN,
    name = 'MCP Server',
    version
} = {}) {
    // --- MCP Server Initialization ---
    let resolvedVersion = version || '1.0.0';
    try {
        const packageJsonPath = path(__dirname, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        resolvedVersion = version || packageJson.version || resolvedVersion;
    } catch (err) {
        logger.warn('[SERVER] Could not read package.json for version:', err && err.stack ? err.stack : err);
    }
    const mcpServer = new McpServer(
        {
            name: name,
            version: resolvedVersion
        },
        {
            capabilities: {
                resources: {}
            }
        }
    );
    // Attach options for test inspection
    mcpServer.options = { name, version: resolvedVersion };
    // Register tools
    try {
        const toolFiles = fs.readdirSync(toolsDir).filter(f => f.endsWith('.cjs'));
        let toolCount = 0;
        for (const file of toolFiles) {
            try {
                const mod = require(pathUrl(toolsDir, file));
                if (typeof mod.default === 'function') {
                    await mod.default(mcpServer);
                    logger.debug(`Registered MCP tool from ${file}`);
                    toolCount++;
                } else {
                    logger.warn(`No default export function in ${file}`);
                }
            } catch (toolErr) {
                logger.error(`Error registering MCP tool from ${file}:`, toolErr);
            }
        }
        logger.debug('Registered ' + toolCount + ' tools');
    } catch (toolErr) {
        logger.error('Error registering MCP tools:', toolErr);
    }
    // Connect MCP server
    const transport = new StreamableHTTPServerTransport({});
    try {
        await mcpServer.connect(transport);
        logger.debug('MCP Server ' + resolvedVersion + ' connected successfully');
    } catch (err) {
        logger.error('MCP Server connection error:', err && err.stack ? err.stack : err);
        throw err;
    }

    // --- HTTP Server Initialization ---
    const app = express();
    app.use(express.json());
    // Error handler for invalid JSON
    app.use((err, req, res, next) => {
        if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
            return res.status(406).json({ error: 'Invalid JSON' });
        }
        next(err);
    });

    // Logging middleware
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
                logger.debug(`[HTTP] ${req.method} ${req.url} from ${req.ip} body=${bodyText}`);
            } else if (req.method === 'POST') {
                logger.debug(`[HTTP] ${req.method} ${req.url} from ${req.ip} body=${bodyText}`);
            } else {
                logger.debug(`[HTTP] ${req.method} ${req.url} from ${req.ip} body=${bodyText}`);
            }
        }
        next();
    });

    // Response logging middleware
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
                    logger.debug(`[HTTP RES] ${req.method} ${req.url} -> ${res.statusCode} body=${bodyText}`);
                } else if (req.method === 'POST') {
                    logger.debug(`[HTTP RES] ${req.method} ${req.url} -> ${res.statusCode} body=${bodyText}`);
                } else {
                    logger.debug(`[HTTP RES] ${req.method} ${req.url} -> ${res.statusCode} body=${bodyText}`);
                }
            }
            res.end = oldEnd;
            return oldEnd.call(this, chunk, ...args);
        };

        next();
    });

    // Auth middleware for POST /
    app.use((req, res, next) => {
        if (req.method === 'POST' && req.url === '/') {
            const authHeader = req.headers['authorization'] || req.headers['Authorization'];
            if (!authToken) {
                return res.status(500).json({ error: 'MCP_TOKEN not set in environment' });
            }
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Missing or invalid Authorization header' });
            }
            const token = authHeader.slice('Bearer '.length).trim();
            if (token !== authToken) {
                return res.status(401).json({ error: 'Invalid bearer token' });
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
            if (logger) logger.error('Error handling / POST request:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal MCP server error', details: err && err.stack ? err.stack : String(err) });
            }
        }
    });

    const httpInstance = http.createServer(app);
    httpInstance.on('error', (err) => {
        logger.error('HTTP server error:', err && err.stack ? err.stack : err);
    });

    httpInstance.listen(port, () => {
        logger.debug(`MCP HTTP Server listening on port ${port}`);
    });

    return { app, httpInstance, mcpServer, transport };
}

/**
 * Recursively convert all BigInt values in an object to strings.
 * @param {any} value
 * @returns {any}
 */
function convertBigIntToString(value) {
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
function buildResponse(data) {
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

module.exports = {
    mcpServer,
    buildResponse,
    convertBigIntToString,
    z: require('zod'),
};
