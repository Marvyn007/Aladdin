/**
 * Expert Resume Rebuilder — Drip-Question Mode
 *
 * When parsing confidence is low OR user requests a rebuild, this module
 * drives a one-question-at-a-time interview to extract high-quality data
 * (metrics, tools, outcomes, dates) before generating an ATS-optimized resume.
 *
 * Flow:
 *   1. startDripSession(userId, parsedResume?) → first question
 *   2. submitDripAnswer(userId, answer) → next question OR "complete"
 *   3. User says "Stop the questions." → finalizeDripSession(userId) → resume
 */

import { v4 as uuid } from 'uuid';
import { setCachedParse, getCachedParse, invalidateForUser } from '@/lib/resume-cache';

// ============================================================================
// Types
// ============================================================================

export interface DripQuestion {
    id: string;
    category: 'experience' | 'education' | 'skills' | 'projects' | 'metrics' | 'tools' | 'outcomes' | 'general';
    text: string;
    followUp?: string; // context hint for the next question
}

export interface DripSessionState {
    userId: string;
    sessionId: string;
    status: 'active' | 'complete';
    currentQuestionIndex: number;
    questions: DripQuestion[];
    answers: Record<string, string>; // questionId → answer
    accumulatedData: {
        name?: string;
        email?: string;
        phone?: string;
        linkedin?: string;
        github?: string[];
        location?: string;
        summary?: string;
        experience: Array<{
            company: string;
            title: string;
            dates: string;
            bullets: string[];
            tools: string[];
        }>;
        education: Array<{
            school: string;
            degree: string;
            dates: string;
            gpa?: string;
            coursework?: string;
        }>;
        projects: Array<{
            title: string;
            technologies: string;
            description: string;
            link?: string;
        }>;
        skills: string[];
        certifications: string[];
    };
    parsedResumeBase?: any; // starting point from parsed resume, if available
    createdAt: string;
    updatedAt: string;
}

// In-memory session storage (keyed by userId)
const dripSessions = new Map<string, DripSessionState>();

// ============================================================================
// Question Bank — dynamic, profession-agnostic
// ============================================================================

function generateQuestionSequence(parsedResume?: any): DripQuestion[] {
    const questions: DripQuestion[] = [];
    const has = (field: string) => parsedResume && parsedResume[field];

    // Contact info (only ask if missing from parse)
    if (!has('name')) {
        questions.push({
            id: uuid(),
            category: 'general',
            text: "What is your full name as it should appear on your resume?",
        });
    }
    if (!has('email')) {
        questions.push({
            id: uuid(),
            category: 'general',
            text: "What email address should be on your resume?",
        });
    }
    if (!has('phone')) {
        questions.push({
            id: uuid(),
            category: 'general',
            text: "What phone number should employers use to reach you? (or type 'skip')",
        });
    }
    if (!has('linkedin')) {
        questions.push({
            id: uuid(),
            category: 'general',
            text: "What is your LinkedIn profile URL? (or type 'skip')",
        });
    }

    // Experience deep-dive
    questions.push({
        id: uuid(),
        category: 'experience',
        text: "What is your most recent or current job title and company?",
        followUp: "We'll ask about achievements at this role next.",
    });
    questions.push({
        id: uuid(),
        category: 'metrics',
        text: "For your most recent role, what's the most impressive measurable achievement? (e.g., 'Reduced page load time by 40%', 'Managed a team of 12', 'Grew revenue by $500K')",
    });
    questions.push({
        id: uuid(),
        category: 'tools',
        text: "What tools, technologies, or platforms did you use daily in this role?",
    });
    questions.push({
        id: uuid(),
        category: 'outcomes',
        text: "What was the biggest problem you solved in this role, and what was the outcome?",
    });

    // Additional experience
    questions.push({
        id: uuid(),
        category: 'experience',
        text: "Do you have a previous role before this one? If yes, what was the title, company, and date range? (or type 'skip')",
    });

    // Projects
    questions.push({
        id: uuid(),
        category: 'projects',
        text: "What's a project you're most proud of? Describe it in 1-2 sentences including technologies used.",
    });
    questions.push({
        id: uuid(),
        category: 'metrics',
        text: "For that project, what measurable impact did it have? (users served, speed improvement, cost saved, etc.)",
    });

    // Education
    if (!has('education') || (parsedResume?.education || []).length === 0) {
        questions.push({
            id: uuid(),
            category: 'education',
            text: "What is your highest level of education? Include school name, degree, and graduation year.",
        });
    }

    // Skills
    questions.push({
        id: uuid(),
        category: 'skills',
        text: "List your top 10-15 technical and professional skills, separated by commas.",
    });

    // Certifications
    questions.push({
        id: uuid(),
        category: 'general',
        text: "Do you have any certifications or awards? List them, or type 'skip'.",
    });

    return questions;
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Start a drip-question session. Returns the first question.
 */
export function startDripSession(
    userId: string,
    parsedResume?: any,
): { sessionId: string; question: DripQuestion; totalQuestions: number } {
    const sessionId = uuid();
    const questions = generateQuestionSequence(parsedResume);

    const session: DripSessionState = {
        userId,
        sessionId,
        status: 'active',
        currentQuestionIndex: 0,
        questions,
        answers: {},
        accumulatedData: {
            experience: [],
            education: [],
            projects: [],
            skills: [],
            certifications: [],
        },
        parsedResumeBase: parsedResume || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    // Pre-fill from parsed resume if available
    if (parsedResume) {
        session.accumulatedData.name = parsedResume.name || undefined;
        session.accumulatedData.email = parsedResume.email || undefined;
        session.accumulatedData.phone = parsedResume.phone || undefined;
        session.accumulatedData.linkedin = parsedResume.linkedin || undefined;
        session.accumulatedData.location = parsedResume.location || undefined;

        if (parsedResume.skills) {
            session.accumulatedData.skills = Array.isArray(parsedResume.skills)
                ? parsedResume.skills.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean)
                : [];
        }
    }

    dripSessions.set(userId, session);

    return {
        sessionId,
        question: questions[0],
        totalQuestions: questions.length,
    };
}

/**
 * Submit an answer to the current question. Returns the next question or completion signal.
 */
export function submitDripAnswer(
    userId: string,
    answer: string,
): { done: boolean; question?: DripQuestion; questionsRemaining: number } {
    const session = dripSessions.get(userId);
    if (!session || session.status === 'complete') {
        throw new Error('No active drip session found. Start a new session first.');
    }

    const currentQ = session.questions[session.currentQuestionIndex];
    const trimmedAnswer = answer.trim();

    // Store answer
    session.answers[currentQ.id] = trimmedAnswer;

    // Process answer into accumulated data based on category
    if (trimmedAnswer.toLowerCase() !== 'skip') {
        processAnswer(session, currentQ, trimmedAnswer);
    }

    // Advance to next question
    session.currentQuestionIndex++;
    session.updatedAt = new Date().toISOString();

    if (session.currentQuestionIndex >= session.questions.length) {
        session.status = 'complete';
        return { done: true, questionsRemaining: 0 };
    }

    const nextQ = session.questions[session.currentQuestionIndex];
    return {
        done: false,
        question: nextQ,
        questionsRemaining: session.questions.length - session.currentQuestionIndex,
    };
}

/**
 * Get the current session state.
 */
export function getDripSession(userId: string): DripSessionState | null {
    return dripSessions.get(userId) || null;
}

/**
 * Finalize the session and return accumulated data as a parsed resume structure
 * that can be fed into the resume generation pipeline.
 */
export function finalizeDripSession(userId: string): {
    parsedResume: any;
    confidence: number;
} {
    const session = dripSessions.get(userId);
    if (!session) {
        throw new Error('No drip session found for finalization.');
    }

    const data = session.accumulatedData;

    // Build a parsed-resume-like structure from accumulated answers
    const parsedResume: any = {
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        linkedin: data.linkedin || '',
        github: data.github || [],
        location: data.location || '',
        education: data.education.map(edu => ({
            school: edu.school,
            degree: edu.degree,
            start: edu.dates.split('-')[0]?.trim() || '',
            end: edu.dates.split('-')[1]?.trim() || '',
            relevant_coursework: edu.coursework || null,
            notes: edu.gpa ? `GPA: ${edu.gpa}` : null,
        })),
        roles: data.experience.map(exp => ({
            company: exp.company,
            title: exp.title,
            start: exp.dates.split('-')[0]?.trim() || '',
            end: exp.dates.split('-')[1]?.trim() || 'Present',
            description: exp.bullets.join('\n'),
        })),
        projects: data.projects.map(proj => ({
            title: proj.title,
            tech: proj.technologies.split(',').map(t => t.trim()),
            description: proj.description,
            link: proj.link || null,
        })),
        skills: data.skills.map(s => ({ name: s })),
    };

    // Calculate confidence based on how much data was collected
    const fieldsCount = Object.values(data).filter(v =>
        v && (typeof v === 'string' ? v.length > 0 : Array.isArray(v) ? v.length > 0 : true)
    ).length;
    const confidence = Math.min(1.0, fieldsCount / 10);

    // Clean up session
    dripSessions.delete(userId);

    return { parsedResume, confidence };
}

// ============================================================================
// Answer Processing
// ============================================================================

function processAnswer(session: DripSessionState, question: DripQuestion, answer: string) {
    const data = session.accumulatedData;

    switch (question.category) {
        case 'general':
            if (question.text.includes('full name')) {
                data.name = answer;
            } else if (question.text.includes('email')) {
                data.email = answer;
            } else if (question.text.includes('phone')) {
                data.phone = answer;
            } else if (question.text.includes('LinkedIn')) {
                data.linkedin = answer;
            } else if (question.text.includes('certifications') || question.text.includes('awards')) {
                data.certifications = answer.split(',').map(c => c.trim()).filter(Boolean);
            }
            break;

        case 'experience':
            if (question.text.includes('most recent') || question.text.includes('current')) {
                // Parse "Title at Company" or "Title, Company"
                const parts = answer.split(/\s+at\s+|\s*,\s*/i);
                data.experience.push({
                    company: parts[1]?.trim() || answer,
                    title: parts[0]?.trim() || answer,
                    dates: '',
                    bullets: [],
                    tools: [],
                });
            } else if (question.text.includes('previous role')) {
                const parts = answer.split(/\s+at\s+|\s*,\s*/i);
                data.experience.push({
                    company: parts[1]?.trim() || answer,
                    title: parts[0]?.trim() || answer,
                    dates: '',
                    bullets: [],
                    tools: [],
                });
            }
            break;

        case 'metrics':
            // Add as a bullet to the latest experience or project
            if (data.experience.length > 0) {
                data.experience[data.experience.length - 1].bullets.push(answer);
            }
            break;

        case 'tools':
            if (data.experience.length > 0) {
                data.experience[data.experience.length - 1].tools = answer.split(',').map(t => t.trim());
                // Also add to skills
                data.skills.push(...answer.split(',').map(t => t.trim()));
                data.skills = [...new Set(data.skills)];
            }
            break;

        case 'outcomes':
            if (data.experience.length > 0) {
                data.experience[data.experience.length - 1].bullets.push(answer);
            }
            break;

        case 'projects':
            // Parse project description
            data.projects.push({
                title: answer.split('.')[0]?.trim() || answer,
                technologies: '',
                description: answer,
            });
            break;

        case 'education':
            data.education.push({
                school: answer,
                degree: '',
                dates: '',
            });
            break;

        case 'skills':
            const skills = answer.split(',').map(s => s.trim()).filter(Boolean);
            data.skills = [...new Set([...data.skills, ...skills])];
            break;
    }
}
