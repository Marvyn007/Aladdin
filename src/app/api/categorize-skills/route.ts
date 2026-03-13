import { NextResponse } from 'next/server';
import { callLLM } from '@/lib/resume-generation/utils';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { currentSkills, newSkills } = body;

        if (!newSkills || !Array.isArray(newSkills) || newSkills.length === 0) {
            return NextResponse.json({ updatedSkills: currentSkills || {} });
        }

        const model = process.env.LLM_MODEL || "openai/gpt-4o-mini";

        const systemPrompt = `
You are an expert ATS Resume categorizer. You will be given a JSON object of existing categorized skills (e.g. {"Languages": ["Python"], "Tools": ["Git"]}) and a list of new skills to add.
Your task is to smartly append the new skills into the MOST appropriate existing category in the JSON object.
If a new skill clearly belongs in a completely new category (like "Databases" or "DevOps"), you may create that new category.
Return ONLY valid JSON matching the schema Record<string, string[]>. Do not include markdown code block syntax. Ensure no existing skills are deleted.
        `.trim();

        const userPrompt = `
Existing Skills:
${JSON.stringify(currentSkills || {}, null, 2)}

New Skills to add:
${JSON.stringify(newSkills, null, 2)}

Please return the newly merged JSON object.
        `.trim();

        const responseString = await callLLM(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            { model, jsonMode: true }
        );

        let mergedSkills: Record<string, string[]> = {};
        try {
             const cleanJson = responseString.replace(/```(?:json)?\s*([\s\S]*?)```/, '$1').trim();
             mergedSkills = JSON.parse(cleanJson);
        } catch (e) {
             console.error("[categorize-skills] Failed to parse LLM Response", e);
             // Fallback: dump all into "Additional Skills" or first category
             let targetCategory = "Additional Skills";
             if (currentSkills && Object.keys(currentSkills).length > 0) {
                  targetCategory = Object.keys(currentSkills)[0];
             }
             mergedSkills = { ...currentSkills };
             if (!mergedSkills[targetCategory]) mergedSkills[targetCategory] = [];
             mergedSkills[targetCategory].push(...newSkills);
        }

        return NextResponse.json({ updatedSkills: mergedSkills });

    } catch (e: any) {
        console.error("[categorize-skills] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
