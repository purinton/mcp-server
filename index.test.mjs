import { mcpServer, buildResponse, convertBigIntToString, z } from '@purinton/mcp-server';
import request from 'supertest';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Basic export test
test('mcpServer is a function', () => {
  expect(typeof mcpServer).toBe('function');
});

describe('mcpServer HTTP API', () => {
  let logger;
  let app;
  let httpInstance;
  let server;

  beforeEach(async () => {
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    // Use a random port (0) and a test token
    const result = await mcpServer({ logger, port: 0, authToken: 'test-token' });
    app = result.app;
    httpInstance = result.httpInstance;
    server = result;
  });

  afterEach(async () => {
    if (httpInstance && httpInstance.close) {
      await new Promise((resolve) => httpInstance.close(resolve));
    }
  });

  test('should return 200 for GET /', async () => {
    await request(app).get('/').expect(200, 'GET / endpoint - no action');
  });

  test('should require auth for POST /', async () => {
    await request(app).post('/').send({ foo: 'bar' }).expect(401);
    await request(app)
      .post('/')
      .set('Authorization', 'Bearer wrong-token')
      .send({ foo: 'bar' })
      .expect(401);
    await request(app)
      .post('/')
      .set('Authorization', 'Bearer test-token')
      .send({ foo: 'bar' })
      .expect(406); // Updated to expect 406 Not Acceptable
  });

  test('should log HTTP requests and responses', async () => {
    await request(app).get('/').expect(200);
    expect(logger.debug).toHaveBeenCalled();
  });

  test('should export all expected properties', () => {
    expect(server).toHaveProperty('app');
    expect(server).toHaveProperty('httpInstance');
    expect(server).toHaveProperty('mcpServer');
    expect(server).toHaveProperty('transport');
  });

  test('should return 500 if MCP_TOKEN is missing', async () => {
    const result = await mcpServer({ logger, port: 0, authToken: undefined });
    const app2 = result.app;
    await request(app2)
      .post('/')
      .send({ foo: 'bar' })
      .expect(500);
    if (result.httpInstance && result.httpInstance.close) {
      result.httpInstance.close();
    }
  });

  test('should handle invalid JSON in POST', async () => {
    await request(app)
      .post('/')
      .set('Authorization', 'Bearer test-token')
      .set('Content-Type', 'application/json')
      .send('not a json')
      .expect(406); // Should be 406 or 400/500 depending on express config
  });

  test('should start with custom name and version', async () => {
    const result = await mcpServer({ logger, port: 0, authToken: 'test-token', name: 'CustomName', version: '9.9.9' });
    expect(result.mcpServer.options.name).toBe('CustomName');
    expect(result.mcpServer.options.version).toBe('9.9.9');
    if (result.httpInstance && result.httpInstance.close) {
      result.httpInstance.close();
    }
  });
});

describe('Utility exports', () => {
  test('convertBigIntToString converts bigints', () => {
    const input = { a: 1n, b: [2n, 3, { c: 4n }] };
    const output = convertBigIntToString(input);
    expect(output).toEqual({ a: '1', b: ['2', 3, { c: '4' }] });
  });

  test('buildResponse wraps data', () => {
    const data = { foo: 'bar', num: 1n };
    const resp = buildResponse(data);
    expect(resp).toHaveProperty('content');
    expect(resp.content[0].type).toBe('text');
    expect(resp.content[0].text).toContain('"foo": "bar"');
    expect(resp.content[0].text).toContain('"num": "1"');
  });

  test('z export is available and works', () => {
    const schema = z.object({ foo: z.string() });
    expect(schema.safeParse({ foo: 'bar' }).success).toBe(true);
    expect(schema.safeParse({ foo: 123 }).success).toBe(false);
  });
});
