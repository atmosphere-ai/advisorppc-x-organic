import { McpServer } from "@modelcontextprotocol/server";
import { XClient, tokenFromEnv } from "./x/client.js";
import { registerApps } from "./apps/register.js";
import { registerTools } from "./tools/register.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./version.js";

export type CreateServerOptions = {
  client?: XClient;
  accessToken?: string;
};

export function createServer(opts: CreateServerOptions = {}): McpServer {
  const server = new McpServer(
    { name: PACKAGE_NAME, version: PACKAGE_VERSION },
    {
      instructions: [
        "AdvisorPPC organic X connector (not ads). User-context OAuth2 on https://api.x.com/2.",
        "Never invent post/DM copy, handles, or media. Use only what the user supplied.",
        "Post, reply, quote, repost, DM send, delete, and hide require confirm=true after an explicit named ask.",
        "If media upload fails, STOP — never substitute another asset.",
        "Do not spam-reply. Do not send bulk unsolicited DMs.",
        "X API has no native schedule. Do not fake a queue.",
        "Pay-per-use as of 2026: ~$0.015 per plain post, ~$0.20 per link post — warn before posting links.",
        "Self-serve replies to others only work if they @mentioned you or quoted you.",
        "Call x_organic_get_me first when you need the authenticated user id.",
      ].join(" "),
    },
  );

  const getClient = () => {
    if (opts.client) return opts.client;
    return new XClient({ accessToken: opts.accessToken || tokenFromEnv() });
  };

  registerTools(server, getClient);
  registerApps(server);
  return server;
}
