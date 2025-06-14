import { z, buildResponse } from '@purinton/mcp-server';

export default async function (server, toolName = 'echo') {
  server.tool(
    toolName,
    "Echo Tool",
    { echoText: z.string() },
    async (_args, _extra) => {
      const pong = {
        message: "echo-reply",
        data: {
          text: _args.echoText
        }
      };
      return buildResponse(pong);
    }
  );
}
