import type {
  Context,
  Message,
  TextContent,
  ImageContent,
  ToolCall,
} from "@earendil-works/pi-ai";
import { CursorLiteError } from "./error.js";

/** Union of content part types that can appear in a message. */
type ContentPart = TextContent | ImageContent | ToolCall | { type: "thinking"; thinking: string; [key: string]: any };

/**
 * Build a deterministic XML prompt envelope for the Cursor Agent.
 * Encodes system prompt and text messages. Rejects images and unknown parts.
 */
export function buildPiContextEnvelope(context: Context): string {
  const parts: string[] = [];

  // System prompt
  if (context.systemPrompt) {
    parts.push(`<system>\n${escapeXml(context.systemPrompt)}\n</system>`);
  }

  // Messages (user, assistant, toolResult)
  for (const msg of context.messages) {
    const encoded = encodeMessage(msg);
    if (encoded) parts.push(encoded);
  }

  return parts.join("\n\n");
}

function encodeMessage(msg: Message): string | null {
  switch (msg.role) {
    case "user": {
      const text = extractTextOnly(msg.content);
      if (!text) return null;
      return `<user>\n${escapeXml(text)}\n</user>`;
    }
    case "assistant": {
      const text = extractAssistantText(msg.content);
      if (!text) return null;
      return `<assistant>\n${escapeXml(text)}\n</assistant>`;
    }
    case "toolResult": {
      const text = extractTextOnly(msg.content);
      const header = msg.isError ? "tool_result_error" : "tool_result";
      return `<${header} callId="${escapeXml(msg.toolCallId)}">\n${escapeXml(text)}\n</${header}>`;
    }
    default:
      return null;
  }
}

function extractTextOnly(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  const texts: string[] = [];
  for (const part of content) {
    if (part.type === "text") {
      texts.push(part.text);
    } else if (part.type === "image") {
      throw new CursorLiteError("INPUT", "prepare", "Image content is not supported in V1");
    } else {
      throw new CursorLiteError("INPUT", "prepare", `Unsupported content part type: ${(part as any).type}`);
    }
  }
  return texts.join("\n");
}

function extractAssistantText(content: ContentPart[]): string {
  const texts: string[] = [];
  for (const part of content) {
    if (part.type === "text") {
      texts.push(part.text);
    } else if (part.type === "thinking") {
      texts.push(`[thinking: ${part.thinking.slice(0, 200)}${part.thinking.length > 200 ? "..." : ""}]`);
    } else if (part.type === "toolCall") {
      texts.push(`[tool call: ${part.name}]`);
    }
  }
  return texts.join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
