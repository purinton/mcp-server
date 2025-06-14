const fs = require('fs');
const path = require('@purinton/path').path;

describe('All custom tool handler files', () => {
    const toolsDir = path(__dirname, '..', 'tools');
    const files = fs.readdirSync(toolsDir).filter(f => f.endsWith('.cjs'));

    for (const file of files) {
        const filePath = require.resolve(path(toolsDir, file));
        test(`${file} exports a function`, async () => {
            const mod = require(filePath);
            expect(typeof mod).toBe('function');
        });

        test(`${file} registers a tool with the server (new pattern)`, async () => {
            const toolMock = jest.fn();
            const onMock = jest.fn();
            const logMock = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
            const mockServer = { tool: toolMock, on: onMock };
            const mod = require(filePath);
            await mod({ mcpServer: mockServer, toolName: 'test-tool', log: logMock });
            expect(toolMock).toHaveBeenCalled();
        });
    }
});
