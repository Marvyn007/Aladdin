import { routeAICall } from './ai-router';
import { config } from 'dotenv';
config({ path: '.env.local' });

export interface IntegrityAuditInput {
    final_markdown_resume: string;
    jd_top_10_keywords: string[];
}

export interface IntegrityAuditOutput {
    integrity_passed: boolean;
    issues: string[];
    severity: "none" | "minor_issue" | "major_issue";
}

export async function runFinalIntegrityAudit(
    input: IntegrityAuditInput
): Promise<IntegrityAuditOutput> {
    const issues: string[] = [];
    let severity: "none" | "minor_issue" | "major_issue" = "none";
    const md = input.final_markdown_resume;

    // G-1 Duplicate Section Test
    const sections = ["Summary", "Skills", "Experience", "Education"];
    for (const sec of sections) {
        // Look for literal instances like "## Summary"
        const regex = new RegExp(`^##s+${sec}`, 'gmi');
        const matches = [...md.matchAll(regex)];
        if (matches.length > 1) {
            issues.push(`TEST G-1 FAILED: Duplicate section header "## ${sec}" found ${matches.length} times.`);
            severity = "major_issue";
        }
    }

    // G-2 Bullet Duplication Global
    // Assume bullets start with "- "
    const allBulStr = md.match(/^- (.*)$/gm) || [];
    const allBuls = allBulStr.map(b => b.trim());
    const uniqueBuls = new Set(allBuls);
    if (uniqueBuls.size < allBuls.length) {
        // Find which one
        const counts: Record<string, number> = {};
        allBuls.forEach(b => counts[b] = (counts[b] || 0) + 1);
        const dupes = Object.keys(counts).filter(k => counts[k] > 1);
        issues.push(`TEST G-2 FAILED: Duplicate bullets detected globally: ${JSON.stringify(dupes.slice(0, 2))}`);
        severity = "major_issue";
    }

    // G-3 Keyword Stuffing Threshold
    const mdLower = md.toLowerCase();
    for (const kw of input.jd_top_10_keywords) {
        // regex for whole word occurences
        const kwEsc = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${kwEsc}\\b`, 'gi');
        const matches = md.match(regex);
        if (matches && matches.length > 6) {
            issues.push(`TEST G-3 FAILED: Keyword stuffing. "${kw}" appears ${matches.length} times (Max 6).`);
            severity = "major_issue";
        }
    }

    // G-4 Sentence Readability
    // Split sentences heuristically by periods ending lines or inside text, minus floating acronyms ideally, but simple split on '.' is requested
    const sentences = md.split(/[.!?]\s+/);
    for (let i = 0; i < sentences.length; i++) {
        const s = sentences[i].trim();
        if (!s) continue;
        const words = s.split(/\s+/).filter(w => w.length > 0);
        if (words.length > 35) {
            issues.push(`TEST G-4 FAILED: Sentence readability violated. Length = ${words.length} words. Excerpt: "${s.slice(0, 30)}..."`);
            if (severity === "none") severity = "minor_issue";
        }
    }

    // G-5 Formatting Integrity
    if (md.includes('### -') || md.includes('## -')) {
        issues.push(`TEST G-5 FAILED: Broken markdown characters detected (e.g. "### -").`);
        severity = "major_issue";
    }
    // Check for triple hashes inside bullets
    const badBulHashes = md.match(/^- .*###.*$/gm);
    if (badBulHashes && badBulHashes.length > 0) {
        issues.push(`TEST G-5 FAILED: Triple hashes inappropriately positioned inside bullets.`);
        severity = "major_issue";
    }

    // G-6 Tone Audit (Light LLM Check)
    const prompt = `SYSTEM
You are a professional resume quality auditor.
Evaluate the resume text for tone, clarity, and professionalism.
Do not suggest rewrites.
Return JSON only.
USER
Resume Text:
${input.final_markdown_resume}

Return JSON:
{
  "tone_assessment": "clean | minor_issue | major_issue",
  "notes": ""
}`;

    try {
        // Temperature 0.1 enforced by AI router default overrides anyway internally usually, relying on standard router
        const raw = await routeAICall(prompt);
        let cleanStr = raw.trim();
        const match = cleanStr.match(/`{3}(?:json)?\s*([\s\S]*?)\s*`{3}/);
        if (match) cleanStr = match[1].trim();
        const parsed = JSON.parse(cleanStr);

        if (parsed.tone_assessment === "major_issue") {
            issues.push(`TEST G-6 FAILED: LLM Tone Audit triggered major issue: ${parsed.notes}`);
            severity = "major_issue";
        } else if (parsed.tone_assessment === "minor_issue") {
            issues.push(`TEST G-6 WARNING: LLM Tone Audit flagged minor issue: ${parsed.notes}`);
            if (severity === "none") severity = "minor_issue";
        }

    } catch (e: any) {
        issues.push(`TEST G-6 ERROR: Tone Audit LLM call failed: ${e.message}`);
        // don't fail integrity purely explicitly if the AI is totally down, let the deterministic rule pass
    }

    return {
        integrity_passed: severity !== "major_issue",
        issues,
        severity
    };
}
