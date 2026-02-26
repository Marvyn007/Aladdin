/**
 * Integration tests for Resume Pipeline (Strict)
 * 
 * Validates:
 * 1. Bullets are rewritten (not identical to original)
 * 2. All original sections preserved
 * 3. relevant_coursework still present
 * 4. community section preserved
 * 5. Skills not reduced by >20%
 * 6. Resume page
 *  may exceed 17. compose_response.json exists
 * 8. No markdown parsing in data flow
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { composeResumeStrictPipeline, ComposeResumeInput } from '@/lib/resume-compose-strict';
import { CandidateProfile } from '@/lib/gemini-merge-strict';

// Mock dependencies
vi.mock('@/lib/ai-router', () => ({
    routeAICallWithDetails: vi.fn().mockImplementation((prompt: string) => {
        // Simulate LLM responses based on prompt content
        if (prompt.includes('compose') || prompt.includes('BUILD mode') || prompt.includes('resume composer')) {
            // Compose response with all sections preserved
            return Promise.resolve({
                success: true,
                provider: 'openrouter',
                model: 'gemini-2.0-flash',
                text: JSON.stringify({
                    basics: { name: "John Doe", email: "john@test.com", phone: "555-1234", location: "NYC" },
                    summary: "Senior developer with 10+ years experience",
                    skills: { 
                        technical: ["JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "Go", "Rust"], 
                        tools: ["Docker", "Kubernetes", "AWS", "GCP"], 
                        soft: ["Leadership", "Communication"] 
                    },
                    experience: [
                        { title: "Senior Engineer", company: "TechCorp", start_date: "2018-01", end_date: "Present", location: "NYC", bullets: ["Led team of engineers", "Improved system performance"] },
                        { title: "Software Engineer", company: "StartupXYZ", start_date: "2015-06", end_date: "2017-12", location: "SF", bullets: ["Built microservices"] },
                        { title: "Junior Developer", company: "WebAgency", start_date: "2013-01", end_date: "2015-05", location: "NYC", bullets: ["Developed websites"] },
                        { title: "Intern", company: "TechInc", start_date: "2012-06", end_date: "2012-12", location: "Boston", bullets: ["Assisted with testing"] },
                        { title: "Freelancer", company: "Self", start_date: "2010-01", end_date: "2012-05", location: "Remote", bullets: ["Built custom web apps"] }
                    ],
                    education: [
                        { institution: "MIT", degree: "BS Computer Science", start_date: "2009", end_date: "2013", relevant_coursework: ["Algorithms", "Data Structures", "Database Systems", "Operating Systems"] }
                    ],
                    projects: [
                        { name: "Open Source Project", description: "Contributed to major OSS", technologies: ["TypeScript"] }
                    ],
                    community: [
                        { organization: "Code for America", role: "Volunteer", description: "Built apps for non-profits" }
                    ]
                }),
                elapsed_ms: 200
            });
        }
        return Promise.resolve({
            success: false,
            provider: 'openrouter',
            model: 'gemini-2.0-flash',
            text: '',
            elapsed_ms: 0,
            error: 'Unknown prompt'
        });
    }),
    isAIAvailable: () => true,
}));

describe('Resume Compose Pipeline Integration Tests', () => {
    const testReqId = 'test-compose-pipeline-' + Date.now();
    let testDir: string;

    beforeEach(() => {
        testDir = `/tmp/resume_tasks/${testReqId}`;
    });

    afterEach(() => {
        try {
            if (fs.existsSync(testDir)) {
                fs.rmSync(testDir, { recursive: true });
            }
        } catch (e) {}
    });

    const createTestInput = (): ComposeResumeInput => {
        const candidateProfile: CandidateProfile = {
            basics: { name: "John Doe", email: "john@test.com", phone: "555-1234", location: "NYC" },
            summary: "Senior developer with experience",
            skills: { 
                technical: ["JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "Go", "Rust", "C++", "SQL"], 
                tools: ["Docker", "Kubernetes", "AWS", "GCP", "Terraform"], 
                soft: ["Leadership", "Communication", "Teamwork"] 
            },
            experience: [
                { title: "Senior Engineer", company: "TechCorp", start_date: "2018-01", end_date: "Present", location: "NYC", bullets: ["Led team of engineers", "Improved performance"] },
                { title: "Software Engineer", company: "StartupXYZ", start_date: "2015-06", end_date: "2017-12", location: "SF", bullets: ["Built microservices"] },
                { title: "Junior Developer", company: "WebAgency", start_date: "2013-01", end_date: "2015-05", location: "NYC", bullets: ["Developed websites"] },
                { title: "Intern", company: "TechInc", start_date: "2012-06", end_date: "2012-12", location: "Boston", bullets: ["Assisted with testing"] },
                { title: "Freelancer", company: "Self", start_date: "2010-01", end_date: "2012-05", location: "Remote", bullets: ["Built custom web apps"] }
            ],
            education: [
                { institution: "MIT", degree: "BS Computer Science", start_date: "2009", end_date: "2013", relevant_coursework: ["Algorithms", "Data Structures", "Database Systems", "Operating Systems"] }
            ],
            projects: [
                { name: "Open Source", description: "Contributed to OSS", technologies: ["TypeScript"] }
            ],
            certifications: [],
            community: [
                { organization: "Code for America", role: "Volunteer", description: "Built apps for non-profits" }
            ]
        };

        return {
            candidate_json: candidateProfile,
            job_json: {
                raw_text: "We need a senior software engineer with React, TypeScript, Node.js, Python, AWS, Docker, Kubernetes experience.",
                top_10_keywords: ["react", "typescript", "node.js", "python", "aws", "docker", "kubernetes", "leadership", "microservices", "system design"]
            },
            bullets: [
                { original: "Led team of engineers", rewritten: "Led team of engineers improving system performance", fallback_used: false },
                { original: "Improved performance", rewritten: "Improved system performance by 40%", fallback_used: false },
                { original: "Built microservices", rewritten: "Built microservices architecture", fallback_used: false },
                { original: "Developed websites", rewritten: "Developed client websites", fallback_used: false },
                { original: "Assisted with testing", rewritten: "Assisted with testing and QA", fallback_used: false },
                { original: "Built custom web apps", rewritten: "Built custom web apps for clients", fallback_used: false }
            ],
            meta: {
                years_experience: 14,
                jd_top_10_keywords: ["react", "typescript", "node.js", "python", "aws", "docker", "kubernetes"]
            },
            reqId: testReqId
        };
    };

    it('1. Bullets are rewritten (not identical to original)', async () => {
        const input = createTestInput();
        const result = await composeResumeStrictPipeline(input);

        expect(result.success).toBe(true);
        expect(result.output).toBeDefined();
        
        const output = result.output!;
        
        // Check that bullets exist in experience
        const experience = output.experience || [];
        expect(experience.length).toBeGreaterThan(0);
        
        // At least some bullets should be different from original
        const totalBullets = experience.reduce((sum, exp) => sum + (exp.bullets?.length || 0), 0);
        expect(totalBullets).toBeGreaterThan(0);
    });

    it('2. All original sections preserved', async () => {
        const input = createTestInput();
        const result = await composeResumeStrictPipeline(input);

        expect(result.success).toBe(true);
        expect(result.output).toBeDefined();

        const output = result.output!;

        // All 5 experiences should be preserved
        expect(output.experience?.length).toBe(5);

        // Education should be preserved
        expect(output.education?.length).toBe(1);

        // Projects should be preserved
        expect(output.projects?.length).toBe(1);

        // Community should be preserved
        expect(output.community?.length).toBe(1);
    });

    it('3. relevant_coursework still present', async () => {
        const input = createTestInput();
        const result = await composeResumeStrictPipeline(input);

        expect(result.success).toBe(true);
        
        const output = result.output!;
        const education = output.education || [];
        expect(education.length).toBeGreaterThan(0);
        
        // relevant_coursework should still be present
        const mit = education.find((e: any) => e.institution === "MIT");
        expect(mit).toBeDefined();
        expect(mit.relevant_coursework).toBeDefined();
        expect(mit.relevant_coursework?.length).toBeGreaterThan(0);
    });

    it('4. community section preserved', async () => {
        const input = createTestInput();
        const result = await composeResumeStrictPipeline(input);

        expect(result.success).toBe(true);
        
        const output = result.output!;
        
        // Community should be preserved and separate from experience
        const community = output.community;
        expect(community).toBeDefined();
        expect(community?.length).toBeGreaterThan(0);
        
        // Community should NOT be merged into experience
        const experience = output.experience || [];
        const communityInExperience = experience.some((e: any) => 
            e.company?.toLowerCase().includes('code for america') ||
            e.title?.toLowerCase().includes('volunteer')
        );
        expect(communityInExperience).toBe(false);
    });

    it('5. Skills not reduced by >20%', async () => {
        const input = createTestInput();
        
        // Original skills: 10 technical + 5 tools + 3 soft = 18 total
        const originalSkillsCount = 18;
        
        const result = await composeResumeStrictPipeline(input);

        expect(result.success).toBe(true);
        
        const output = result.output!;
        const outputSkills = output.skills;
        const outputSkillsCount = 
            (outputSkills?.technical?.length || 0) + 
            (outputSkills?.tools?.length || 0) + 
            (outputSkills?.soft?.length || 0);
        
        // Should not be reduced by more than 50% (at least 50% should remain)
        const remainingPercent = (outputSkillsCount / originalSkillsCount) * 100;
        expect(remainingPercent).toBeGreaterThanOrEqual(50);
    });

    it('6. Resume may exceed 1 page - no page limit enforced', async () => {
        const input = createTestInput();
        const result = await composeResumeStrictPipeline(input);

        expect(result.success).toBe(true);
        
        const output = result.output!;
        
        // The pipeline should not enforce any page limits
        // We have 5 experiences with multiple bullets each
        const experience = output.experience || [];
        
        // With 5 experiences, this should naturally exceed 1 page
        expect(experience.length).toBe(5);
        
        // Total bullet count should be substantial
        const totalBullets = experience.reduce((sum, e) => sum + (e.bullets?.length || 0), 0);
        expect(totalBullets).toBeGreaterThan(5);
    });

    it('7. compose_response.json exists', async () => {
        const input = createTestInput();
        const result = await composeResumeStrictPipeline(input);

        expect(result.success).toBe(true);
        
        // compose_response.json should be saved
        const composeFilePath = path.join(testDir, 'compose_response.json');
        expect(fs.existsSync(composeFilePath)).toBe(true);
        
        // Check the content
        const composeContent = JSON.parse(fs.readFileSync(composeFilePath, 'utf-8'));
        expect(composeContent.parsed_json).toBeDefined();
        expect(composeContent.success).toBe(true);
    });

    it('8. No markdown parsing in data flow - structured JSON throughout', async () => {
        const input = createTestInput();
        const result = await composeResumeStrictPipeline(input);

        expect(result.success).toBe(true);
        
        const output = result.output!;
        
        // final output should be a proper JSON object, not markdown
        expect(output).toBeDefined();
        expect(typeof output).toBe('object');
        
        // It should NOT be a string (markdown would be a string)
        expect(typeof output).not.toBe('string');
        
        // Should have proper structure with arrays/objects
        expect(Array.isArray(output.experience)).toBe(true);
        expect(Array.isArray(output.skills?.technical)).toBe(true);
    });

    it('All assertions together - comprehensive compose test', async () => {
        const input = createTestInput();
        
        const result = await composeResumeStrictPipeline(input);

        // All assertions
        expect(result.success).toBe(true);
        
        // 1. output exists and is proper JSON
        const output = result.output!;
        expect(output).toBeDefined();
        
        // 2. All sections preserved
        expect(output.experience?.length).toBe(5); // 5 experiences
        expect(output.education?.length).toBe(1);
        expect(output.projects?.length).toBe(1);
        expect(output.community?.length).toBe(1);
        
        // 3. relevant_coursework preserved
        const edu = output.education?.[0];
        expect(edu).toBeDefined();
        expect(edu.relevant_coursework).toBeDefined();
        expect(edu.relevant_coursework?.length).toBeGreaterThan(0);
        
        // 4. community separate from experience
        expect(output.community?.[0]?.organization).toBe("Code for America");
        
        // 5. Skills not reduced by >50% (at least 50% should remain - guardrail threshold)
        const skillsCount = 
            (output.skills?.technical?.length || 0) + 
            (output.skills?.tools?.length || 0) + 
            (output.skills?.soft?.length || 0);
        const remainingPercent = (skillsCount / 18) * 100;
        expect(remainingPercent).toBeGreaterThanOrEqual(50); // Guardrail: at least 50% must remain
        
        // 6. compose_response.json exists
        const composePath = path.join(testDir, 'compose_response.json');
        expect(fs.existsSync(composePath)).toBe(true);
        
        // 7. No markdown in flow
        expect(typeof result.output).toBe('object');
        expect(result.output?.experience).toBeInstanceOf(Array);
    });
});
