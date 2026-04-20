# Design: “Make it 1 page” (dual tailored resumes + hidden compaction)

**Date:** 2026-04-20  
**Status:** Approved for implementation planning  
**Scope:** Tailored resume generation produces two variants (full + one-page A4). Resume editor exposes a toggle to preview either variant; edits apply only to the variant currently visible (choice **A**). A hidden server-side step runs after normal tailoring (no new visible progress stage). The **Content** panel is always bound to whichever variant is active so switching feels seamless.

---

## 1. Goals

- After **tailor resume generation** completes, the system has **two** structured resumes: the existing **full** output and a **one-page** variant intended to fit **exactly one A4 page** when exported to PDF via the **serverless** PDF path.
- The resume editor shows a **“Make it 1 page”** control (Design tab or adjacent to preview—implementation detail). **On:** preview (and PDF download) use the one-page variant. **Off:** preview (and PDF) use the full variant.
- **Edits** affect **only** the variant currently selected (full and one-page may **diverge** over time).
- One-page reduction follows a **fixed strategy order**, respecting user priorities: **bullet consolidation first** (same information, fewer bullets), then **font size reduction within a floor** (e.g. minimum 10–11pt for body), then **JD-aware removal of minor / redundant / low-job-relevance content** as **last resort** only (never drop major JD-aligned achievements).
- **Content panel sync:** The left **Content** panel (`ContentPanel` and any resume-driven widgets in that column, e.g. ATS / keywords UI that edits resume text) **must** read and write the **same** variant as the preview. When the user toggles full ↔ one-page, the Content section **immediately** reflects the other variant’s sections, bullets, summary, skills, and visibility—no stale full-resume fields while one-page is on preview, and vice versa. Implementation should use **discrete state per variant** (e.g. paired `resume` / `editorResume` per branch) or an explicit `activeVariant` key so switching is a single source of truth swap, not a slow re-fetch.

## 2. Non-goals

- Changing base templates to experimental multi-column layouts (optional future work; out of scope unless explicitly added).
- Guaranteeing one-page fit for arbitrary user manual edits without a **re-fit** action (see §8).
- Showing the compaction sub-step in the existing **7-stage** progress UI.

## 3. Current system context (constraints)

- **Preview** uses A4-oriented dimensions in the editor (`794×1123` at 96 DPI in `FullPageResumeEditor`).
- **Serverless PDF** (`generateServerlessPdfBufferFromHtml`) currently uses **`format: 'Letter'`** and an 816×1056 viewport. **This spec requires aligning PDF export with A4** so “one page” is defined consistently for preview and download.
- Tailored output is `TailoredResumeData` (sections, bullets, skills, summary, `design`, etc.). HTML is produced by `renderResumeHtml`; PDF is generated from that HTML.
- Today `ContentPanel` receives `resume={editorResume}` in `FullPageResumeEditor`; the toggle design **extends** this so `editorResume` (and debounced `resume` for preview) always mean “**active variant**” or the panel receives props derived from `activeVariant`.

## 4. Architecture overview

```text
[Existing pipeline: full tailored JSON]
           │
           ▼
[Hidden compaction module]  ← no SSE "stage" / no UI label
  (ordered strategies + optional measure loop)
           │
           ▼
[onePage: TailoredResumeData]
           │
           ├─► Included in `done` payload alongside full resume
           └─► Persisted with full resume for reload (see §5)
```

- **SSE:** The visible stage sequence remains unchanged. The server completes normal stages as today, then runs compaction **without** emitting a new user-facing stage (implementation may emit internal-only logs to server console, not SSE `stage` events).
- **`done` event:** Extend payload with `final_resume_json_one_page` (exact name to match implementation plan) alongside existing `final_resume_json` (full). Client maps both through `toEditorFormat` and persists both.

## 5. Persistence and data shape

**Problem:** `tailored_resumes.resume_data` today stores a single JSON blob consumed as `TailoredResumeData`.

**Approach:** Introduce a **versioned bundle** stored in `resume_data` (and returned by GET) so one row still holds everything:

```ts
// Conceptual — names finalized in implementation plan
type TailoredResumePersistedV2 = {
  _v: 2;
  full: TailoredResumeData;
  onePage: TailoredResumeData;
};
```

- **Migration / backward compatibility:** If `resume_data` lacks `_v: 2`, treat the entire object as **`full`** only; **one-page** is absent until user re-generates or uses a future “Regenerate one-page” action. Toggle disabled or shows empty state with CTA as per UX decision in implementation.
- **POST `/api/tailored-resume`:** Accept v2 bundle; validate both branches are well-formed where present.
- **Optional UI state:** `activeVariant: 'full' | 'onePage'` may live **client-only** (resets on reload) or be stored in bundle—default **client-only** unless product wants “remember toggle” (document as follow-up).

## 6. Hidden compaction module (behavior)

### 6.1 Strategy order (must be deterministic)

1. **Layout density (CSS-level, one-page variant only):** Tighter line-height and section spacing within predefined safe bounds (no font change yet).
2. **Margins:** Reduce toward safe minimums already consistent with `ResumeDesign.margins` caps (do not go below readability thresholds defined in implementation).
3. **Font size:** Decrease **only** on the one-page variant’s `design.fontSize` down to a **floor** (10–11pt per product tuning), never below floor.
4. **Bullet consolidation (LLM or hybrid):** Merge bullets within the same role/section while preserving factual content present in the **full** resume (no new metrics or employers). Target fewer bullets with equivalent claims.
5. **Summary / skills compression:** Shorten summary; cap skill lists / merge synonyms—still grounded in user + JD.
6. **Last resort — micro removals:** Remove or shorten items explicitly scored as **low JD relevance** and **low uniqueness** (duplicate idea already covered elsewhere), **never** removing bullets that are primary matches for stated JD requirements. Prefer **shortening** over **deleting** when possible.

### 6.2 “Exactly one page” definition

- **Target:** Rendered HTML height for the **A4** printable area (with the same margins and font loading as PDF) ≤ **one** A4 page.
- **Recommended implementation class:** **Hybrid (§7)** — heuristic passes first, then optional **measurement** using the **same** rendering stack as PDF (Puppeteer) or a documented single source of truth. Exact loop (greedy vs binary search) is left to the implementation plan.

### 6.3 Failure / best-effort

- If after all allowed steps the document still exceeds one page: return the **tightest legal** one-page candidate **without** infinite loops; optionally attach a non-blocking flag for UI (“Could not fully fit—try editing or removing a section”)—product optional.

## 7. Implementation class (recommended)

**Hybrid compaction:**

- Deterministic ordering (§6.1) for cheap wins.
- **Optional** headless **measure** step when still over budget (same A4 + margins + fonts as PDF).
- **LLM** primarily for **bullet merge / summary compression** and **last-resort relevance scoring**, with **structured output** validated against schema and **grounded** to source strings.

**Rationale:** Balances latency cost, “exact page” fidelity, and narrative quality.

## 8. Editor UX (toggle + edits + Content panel)

- **Toggle:** “Make it 1 page” switches which `TailoredResumeData` is bound to **preview**, **Download PDF**, and **Content panel** (download **what you see**).
- **Edits (choice A):** Content and design panels write to the **active** variant’s `editorResume` / debounced `resume` only. The inactive variant’s state is preserved until selected.
- **Content panel seamless switch:** On toggle, swap (or re-select) the active variant’s draft state so `ContentPanel`’s `resume` / `onChange` target the same object graph the preview renders. Avoid remounting the entire editor tree if possible to reduce flicker; if remount is required, preserve scroll position where feasible. **Keywords / ATS** data remain **job-level** (shared); only **resume** props passed into widgets that mutate resume text must track the active variant.
- **Re-sync:** No automatic merge from full → one-page on edit. Optional later: button **“Rebuild one-page from full”** (re-run compaction)—out of scope unless added in plan.

## 9. PDF and preview alignment

- Change serverless PDF generation to **A4** (and viewport / margin math) so preview and PDF share one page definition.
- **Margins:** Continue to respect per-resume `design.margins` for both variants (each variant may carry its own `design` after divergence).

## 10. Safety and quality gates

- Reuse or subset existing **anti-leak** / validation checks on the one-page JSON where applicable.
- **JD keywords:** Compaction must not remove the last mention of a **critical** JD requirement without an explicit rule allowing replacement elsewhere (implementation detail in plan).
- **Audit trail (optional):** Server log summary of actions taken (spacing / font / N bullets merged / K lines removed)—not user-facing initially.

## 11. Testing (high level)

- **Fixture resumes:** Short (already one page), long (multi-page), edge (many small bullets).
- **PDF:** Assert page count = 1 for one-page variant on sample fixtures (where measure succeeds).
- **Toggle:** Preview swaps data; **Content panel fields match the active variant** (spot-check section titles / bullet counts); save persists v2 bundle; reload restores both.
- **Edit isolation:** Edit full with toggle off; enable one-page; confirm one-page unchanged until edited; toggle back and confirm full edits persisted.
- **Seamless UX (manual):** Toggle rapidly; no mixed content (full bullets visible while preview shows one-page layout).

## 12. Open items for implementation plan (not blockers for this spec)

- Exact SSE field names and TypeScript types (`TailoredResumePersistedV2`).
- Whether `BaseResumeEditor` (non-job base resume) participates—**this spec targets tailored/job flow** unless extended.
- Minimum font floor (10 vs 11) and margin floors—product constants.

---

## Spec self-review

- **Placeholders:** None intentional; §12 lists intentional plan-level deferrals.
- **Consistency:** Dual artifact + hidden step + toggle + edit model A + Content panel binding are aligned; A4 alignment called out explicitly.
- **Scope:** Single cohesive feature; “rebuild one page” is explicitly optional follow-up.
- **Ambiguity:** “Exactly one page” tied to A4 + PDF stack; download = what you see; Content = active variant.
