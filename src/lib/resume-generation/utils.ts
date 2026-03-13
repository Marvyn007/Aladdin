/**
 * utils.ts
 * Shared utility functions for the resume generation pipeline.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { FileInput } from "./types";

// ---------------------------------------------------------------------------
// File → Buffer
// ---------------------------------------------------------------------------

/**
 * Converts any supported file input type into a Node.js Buffer.
 * Supports: Buffer, file path string, { buffer } wrapper, or Web File/Blob.
 */
export async function convertFileToBuffer(file: FileInput): Promise<Buffer> {
  if (file instanceof Buffer) {
    return file;
  }

  if (typeof file === "string") {
    const fs = await import("fs/promises");
    return fs.readFile(file);
  }

  // { buffer: Buffer; name?: string } wrapper
  if (
    typeof file === "object" &&
    "buffer" in file &&
    (file as any).buffer instanceof Buffer
  ) {
    return (file as any).buffer;
  }

  // Web File / Blob
  if (typeof (file as any).arrayBuffer === "function") {
    const ab = await (file as any).arrayBuffer();
    return Buffer.from(ab);
  }

  throw new Error("[utils] Unsupported file input type.");
}

// ---------------------------------------------------------------------------
// JSON Parsing
// ---------------------------------------------------------------------------

/**
 * Safely extracts and parses JSON from an LLM response string.
 * Handles cases where the model wraps the JSON in markdown code fences.
 */
export function safeJsonParse<T>(text: string): T | null {
  if (!text) return null;

  // Strip markdown code fences if present
  let clean = text.trim();
  const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    clean = fenceMatch[1].trim();
  }

  // Find first { ... } block
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// LLM API Call
// ---------------------------------------------------------------------------

const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_BASE_URL =
  process.env.LLM_PROVIDER_BASE_URL || "https://api.openai.com/v1";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallLLMOptions {
  temperature?: number;
  max_tokens?: number;
  /** Override the default model */
  model?: string;
  jsonMode?: boolean;
}

/**
 * Thin wrapper around the OpenAI-compatible chat completions endpoint.
 * Returns the raw string content from the first choice.
 */
export async function callLLM(
  messages: LLMMessage[],
  options: CallLLMOptions = {}
): Promise<string> {
  if (!LLM_API_KEY) {
    throw new Error("[callLLM] LLM_API_KEY is not set in environment.");
  }

  const body: any = {
    model: options.model || LLM_MODEL,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens ?? 8000,
  };

  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify(body),
    // @ts-ignore — Node 18+ supports this
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `[callLLM] API error ${response.status}: ${err.slice(0, 300)}`
    );
  }

  const data = await response.json();
  const content: string = data?.choices?.[0]?.message?.content || "";

  if (!content) {
    throw new Error("[callLLM] Empty content in LLM response.");
  }

  return content;
}

// ---------------------------------------------------------------------------
// Text Helpers
// ---------------------------------------------------------------------------

/**
 * Truncates a string to a max character length without cutting mid-word.
 */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.lastIndexOf(" ", maxChars);
  return text.slice(0, cut > 0 ? cut : maxChars) + "…";
}
