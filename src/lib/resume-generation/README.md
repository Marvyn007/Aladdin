# Resume Generation Pipeline (Two-Pass RAG)

AI-powered resume tailoring using Retrieval Augmented Generation with per-bullet provenance tracking.

## Architecture

```
Input: resumePdf + jobDescription + linkedinPdf?
         │
    ┌────▼────┐
    │ Parse   │  pdf-parse → raw text → LLM → structured JSON
    └────┬────┘
    ┌────▼────┐
    │ Chunk   │  Split by section/role → metadata-enriched chunks
    └────┬────┘
    ┌────▼────┐
    │ Embed   │  OpenAI text-embedding-3-small → batch embed
    └────┬────┘
    ┌────▼────┐
    │ Two-Pass│  Per role:
    │ Rewrite │   Pass 1: Per-bullet LLM rewrite (parallel)
    │         │   Pass 2: Role assembly LLM call
    └────┬────┘
    ┌────▼────┐
    │ Validate│  enforceNoDrops + noFabricationCheck + evidenceCoverage
    └────┬────┘
    ┌────▼────┐
    │ ATS     │  Keyword extraction → coverage scoring → missingSkills
    └────┬────┘
Output: TailoredResumeOutput (backward-compatible JSON)
```

## Files

| File | Purpose |
|------|---------|
| `pipeline.ts` | Main orchestrator — `generateTailoredResume()` |
| `types.ts` | All TypeScript interfaces |
| `prompts.ts` | Per-bullet + role assembly + summary prompts |
| `parser.ts` | PDF extraction + LLM structuring |
| `rag.ts` | Chunking, embedding, retrieval |
| `embeddings.ts` | OpenAI embedding API wrapper |
| `ats.ts` | ATS keyword extraction + scoring |
| `validators.ts` | No-drop, no-fabrication, evidence coverage |
| `utils.ts` | Shared helpers (`callLLM`, `safeJsonParse`) |

## Key Design Decisions

- **Per-bullet parallel LLM calls**: Each bullet gets its own rewrite call with dedicated evidence
- **Guaranteed evidence injection**: Original bullets are always sent as pseudo-chunks
- **Three validators**: Run post-LLM to catch drops, fabrication, and missing evidence
- **Backward-compatible output**: V2 provenance data is flattened for the existing frontend

## Environment Variables

- `LLM_API_KEY` — API key for the LLM provider
- `LLM_PROVIDER_BASE_URL` — Base URL for LLM API (default: OpenRouter)
- `LLM_MODEL` — Model name (default: `openai/gpt-4o-mini`)
- `OPENAI_API_KEY` — For embeddings (text-embedding-3-small)

## Running Tests

```bash
npx vitest run src/lib/resume-generation/tests/
```
