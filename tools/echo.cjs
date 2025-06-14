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
