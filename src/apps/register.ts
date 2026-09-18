import type { McpServer } from "@modelcontextprotocol/server";
import { DASHBOARD_HTML } from "./dashboard.js";

export const DASHBOARD_URI = "ui://advisorppc/x-organic/dashboard";

const UI_RESOURCE_META = {
  ui: {
    prefersBorder: true,
    csp: {
      connectDomains: [] as string[],
      resourceDomains: [] as string[],
    },
  },
};

export function registerApps(server: McpServer): void {
  server.registerResource(
    "x-organic-dashboard",
    DASHBOARD_URI,
    {
      title: "X organic inbox / thread",
      description: "Inline table of posts, mentions, or DM conversations from the last tool result.",
      mimeType: "text/html;profile=mcp-app",
      _meta: UI_RESOURCE_META,
    },
    async () => ({
      contents: [
        {
          uri: DASHBOARD_URI,
          mimeType: "text/html;profile=mcp-app",
          text: DASHBOARD_HTML,
          _meta: UI_RESOURCE_META,
        },
      ],
    }),
  );
}
