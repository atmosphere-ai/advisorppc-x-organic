import type { McpServer } from "@modelcontextprotocol/server";
import type { XClient } from "../x/client.js";
import { registerInboxTools } from "./inbox.js";
import { registerReadTools } from "./read.js";
import { registerWriteTools } from "./write.js";

export type ClientFactory = () => XClient;

export function registerTools(server: McpServer, getClient: ClientFactory): void {
  registerReadTools(server, getClient);
  registerWriteTools(server, getClient);
  registerInboxTools(server, getClient);
}

/** Curated operator set — not a 1:1 dump of XMCP's 140–200 endpoints. */
export const TOOL_COUNT = 32;
