/**
 * parser.ts
 * Extracts raw text from PDFs and structures it into dynamic sections via an LLM.
 */

import pdfParse from "pdf-parse";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { callLLM } from "./utils";
import type { DynamicParsedResume, ParseResult } from "./types";

/**
 * Deterministically extracts raw text from a PDF buffer.
 */
export async function extractRawText(pdfBuffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text || "";
  } catch (error) {
    console.error("[parser] pdf-parse failed:", error);
    throw new Error("Failed to extract raw text from PDF.");
  }
}

const DYNAMIC_RESUME_STRUCTURE = `{
  "basics": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string",
    "website": "string",
    "headline": "string"
  },
  "summary": "string (A professional summary or objective statement if present)",
  "sections": [
    {
      "name": "string (The name of the section as it appears on the resume, e.g., 'Experience', 'Publications')",
      "entries": [
        {
          "title": "string (The main title, position name, degree, project name)",
          "subtitle": "string (The company, institution, organization)",
          "location": "string (City, state, remote, or country)",
          "startDate": "string (Start date or year, e.g., '2021')",
          "endDate": "string (End date or 'Present')",
          "bullets": ["string (Detailed bullet points broken into an array of strings)", "string"]
        }
      ]
    }
  ],
  "skills": ["string", "string (A flat list of all skills mentioned)"]
}`;

/**
 * Uses the LLM to structure raw text into the dynamic schema.
 */
export async function parseTextWithLLM(rawText: string): Promise<DynamicParsedResume> {
  const systemPrompt = `You are a strict JSON extraction AI.
Your ONLY job is to extract the provided resume text into the required JSON schema.

CRITICAL RULES:
1. Extract ALL sections you find. Do not discard custom sections like "Fun Facts", "Leadership", or "Open Source".
2. Create a generic "section" object for every distinct header you see in the document.
3. Preserve every single bullet point under each entry. DO NOT summarize or truncate them.
4. Output strict JSON only. MUST BE AN INSTANCE OF THE SCHEMA. DO NOT output the schema definitions yourself.

EXPECTED JSON STRUCTURE:
${DYNAMIC_RESUME_STRUCTURE}`;

  const userPrompt = `Extract this resume text into the schema:\n\n${rawText}`;

  const jsonResponse = await callLLM(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    {
      model: process.env.LLM_MODEL || "openai/gpt-4o-mini",
      jsonMode: true
    }
  );

  const parsed = JSON.parse(jsonResponse) as DynamicParsedResume;
  return parsed;
}

/**
 * Main entry point: Buffer -> ParseResult
 */
export async function parsePdfToDynamicResume(pdfBuffer: Buffer): Promise<ParseResult> {
  const rawText = await extractRawText(pdfBuffer);
  
  if (!rawText || rawText.trim().length < 50) {
    throw new Error("Extracted text is too short or empty.");
  }

  const structured = await parseTextWithLLM(rawText);

  return {
    rawText,
    structured,
  };
}

/**
 * Alternative entry point: Raw Text -> ParseResult
 * Used for processing scraped LinkedIn data without a PDF container.
 */
export async function parseTextToDynamicResume(rawText: string): Promise<ParseResult> {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error("Extracted text is too short or empty.");
  }

  const structured = await parseTextWithLLM(rawText);

  return {
    rawText,
    structured,
  };
}
