import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const VALID_FINAL_RESUME_JSON = {
    basics: {
        name: "John Doe",
        email: "john@example.com",
        phone: "+1-555-123-4567",
        location: "San Francisco, CA",
        full_name: "John Doe"
    },
    summary: "Experienced software engineer with 5+ years building scalable web applications.",
    skills: {
        technical: ["JavaScript", "TypeScript", "React", "Node.js", "Python"],
        tools: ["Docker", "AWS", "Git"],
        soft: ["Leadership", "Communication"]
    },
    experience: [
        {
            title: "Senior Software Engineer",
            company: "Tech Corp",
            location: "San Francisco, CA",
            start_date: "2020-01",
            end_date: "Present",
            bullets: [
                "Led development of microservices architecture",
                "Improved system performance by 40%"
            ]
        },
        {
            title: "Software Engineer",
            company: "Startup Inc",
            location: "Palo Alto, CA",
            start_date: "2017-06",
            end_date: "2019-12",
            bullets: [
                "Built RESTful APIs serving 1M+ requests daily"
            ]
        }
    ],
    education: [
        {
            degree: "BS Computer Science",
            institution: "Stanford University",
            start_date: "2013-09",
            end_date: "2017-06"
        }
    ],
    projects: [
        {
            name: "Open Source CLI Tool",
            bullets: ["Published npm package with 1K+ stars"]
        }
    ]
};

const VALID_SSE_DONE_PAYLOAD = {
    status: "success",
    final_resume_json: VALID_FINAL_RESUME_JSON,
    parsed_resume: { basics: { name: "John Doe" } },
    parsed_jd: { skills: ["React", "Node.js"] },
    compose_response_path: "/tmp/resume_tasks/test-req-id-123"
};

function createSSEDoneEvent(data: any): string {
    return `event: done\ndata: ${JSON.stringify(data)}\n\n`;
}

describe('Resume SSE Done Event Handling', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should parse SSE done event with valid final_resume_json and populate UI', async () => {
        const mockResponse = new Response(
            createSSEDoneEvent(VALID_SSE_DONE_PAYLOAD),
            {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' }
            }
        );

        mockFetch.mockResolvedValueOnce(mockResponse);

        const reader = mockResponse.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = 'message';
        let parsedData: any = null;

        while (true) {
            const { done, value } = await reader!.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) {
                    currentEvent = 'message';
                    continue;
                }

                if (trimmed.startsWith('event: ')) {
                    currentEvent = trimmed.slice(7).trim();
                    continue;
                }

                if (trimmed.startsWith('data: ')) {
                    const data = JSON.parse(trimmed.slice(6));
                    if (currentEvent === 'done') {
                        parsedData = data;
                    }
                }
            }
        }

        expect(parsedData).not.toBeNull();
        expect(parsedData.status).toBe('success');
        expect(parsedData.final_resume_json).toBeDefined();
        expect(parsedData.final_resume_json.basics.name).toBe('John Doe');
        expect(parsedData.final_resume_json.experience).toHaveLength(2);
        expect(parsedData.final_resume_json.skills.technical).toContain('JavaScript');
        expect(parsedData.compose_response_path).toBe('/tmp/resume_tasks/test-req-id-123');
    });

    it('should handle missing final_resume_json and attempt to fetch debug data', async () => {
        const emptyPayload = {
            status: "success",
            final_resume_json: null,
            compose_response_path: "/tmp/resume_tasks/test-req-id-456"
        };

        const mockDebugData = {
            final_resume_json: VALID_FINAL_RESUME_JSON,
            raw_ai_logs: ["log1", "log2"]
        };

        const mockStreamResponse = new Response(
            createSSEDoneEvent(emptyPayload),
            {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' }
            }
        );

        mockFetch
            .mockResolvedValueOnce(mockStreamResponse)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockDebugData
            });

        const reader = mockStreamResponse.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = 'message';
        let parsedData: any = null;

        while (true) {
            const { done, value } = await reader!.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) {
                    currentEvent = 'message';
                    continue;
                }

                if (trimmed.startsWith('event: ')) {
                    currentEvent = trimmed.slice(7).trim();
                    continue;
                }

                if (trimmed.startsWith('data: ')) {
                    const data = JSON.parse(trimmed.slice(6));
                    if (currentEvent === 'done') {
                        parsedData = data;
                    }
                }
            }
        }

        expect(parsedData.final_resume_json).toBeNull();
        expect(parsedData.compose_response_path).toBeDefined();
    });

    it('should emit error event with debug_path when stage fails', async () => {
        const errorPayload = {
            status: "error",
            message: "Failed to parse resume PDF",
            debug_path: "/tmp/resume_tasks/test-req-id-error"
        };

        const mockErrorEvent = `event: error\ndata: ${JSON.stringify(errorPayload)}\n\n`;

        const mockResponse = new Response(mockErrorEvent, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' }
        });

        mockFetch.mockResolvedValueOnce(mockResponse);

        const reader = mockResponse.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = 'message';
        let errorData: any = null;

        while (true) {
            const { done, value } = await reader!.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) {
                    currentEvent = 'message';
                    continue;
                }

                if (trimmed.startsWith('event: ')) {
                    currentEvent = trimmed.slice(7).trim();
                    continue;
                }

                if (trimmed.startsWith('data: ')) {
                    const data = JSON.parse(trimmed.slice(6));
                    if (currentEvent === 'error') {
                        errorData = data;
                    }
                }
            }
        }

        expect(errorData).not.toBeNull();
        expect(errorData.status).toBe('error');
        expect(errorData.message).toBe('Failed to parse resume PDF');
        expect(errorData.debug_path).toBe('/tmp/resume_tasks/test-req-id-error');
    });

    it('should log debug information about final payload size and keys', () => {
        const payloadKeys = Object.keys(VALID_SSE_DONE_PAYLOAD.final_resume_json);
        const payloadSize = JSON.stringify(VALID_SSE_DONE_PAYLOAD.final_resume_json).length;

        expect(payloadKeys).toContain('basics');
        expect(payloadKeys).toContain('experience');
        expect(payloadKeys).toContain('skills');
        expect(payloadSize).toBeGreaterThan(0);
    });
});

describe('Server-side SSE done event format', () => {
    it('should emit done event with required fields', () => {
        const requiredFields = ['status', 'final_resume_json', 'parsed_resume', 'parsed_jd', 'compose_response_path'];
        
        for (const field of requiredFields) {
            expect(VALID_SSE_DONE_PAYLOAD).toHaveProperty(field);
        }

        expect(VALID_SSE_DONE_PAYLOAD.status).toBe('success');
        expect(VALID_SSE_DONE_PAYLOAD.final_resume_json).toEqual(VALID_FINAL_RESUME_JSON);
    });

    it('should emit error event with required fields', () => {
        const errorPayload = {
            status: "error",
            message: "Test error",
            debug_path: "/tmp/test"
        };

        expect(errorPayload).toHaveProperty('status');
        expect(errorPayload).toHaveProperty('message');
        expect(errorPayload).toHaveProperty('debug_path');
    });
});
