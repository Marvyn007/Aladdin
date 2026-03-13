import axios, { AxiosError, isAxiosError } from "axios";

// ---------------------------------------------------------------------------
// Inline constants (previously imported from the deleted resumePipeline/constants)
// ---------------------------------------------------------------------------

const REACTIVE_RESUME_API = process.env.REACTIVE_RESUME_API || "";
const REACTIVE_VERBOSE_LOG = process.env.REACTIVE_VERBOSE_LOG === "true";

/** Simple telemetry counters for observability — reset on server restart. */
const TELEMETRY = {
  importSuccess: 0,
  importFail: 0,
};

/** Retry a function up to maxRetries times, with exponential back-off. */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

export const reactiveClient = axios.create({
	baseURL: REACTIVE_RESUME_API,
	timeout: 120000,
	headers: {
		"x-api-key": process.env.REACTIVE_RESUME_API_KEY,
	},
	maxBodyLength: Infinity,
	maxContentLength: Infinity,
});

if (REACTIVE_VERBOSE_LOG) {
	reactiveClient.interceptors.request.use((config) => {
		console.log(`[reactiveClient] ${config.method?.toUpperCase()} ${config.url}`);
		return config;
	});

	reactiveClient.interceptors.response.use(
		(response) => {
			console.log(`[reactiveClient] Response ${response.status} from ${response.config.url}`);
			return response;
		},
		(error: AxiosError) => {
			console.error(`[reactiveClient] Error ${error.response?.status} from ${error.config?.url}`, {
				status: error.response?.status,
				statusText: error.response?.statusText,
				data: error.response?.data,
			});
			return Promise.reject(error);
		},
	);
}

export { reactiveClient as client };

export interface Resume {
	id: string;
	name: string;
	slug: string;
	public: boolean;
	data: any;
	metadata: any;
	createdAt: string;
	updatedAt: string;
	user: {
		id: string;
		name: string;
		email: string;
	};
}

export interface ReactiveResumeResponse<T> {
	data: T;
}

export interface ResumeData {
	basics?: {
		name?: string;
		email?: string;
		phone?: string;
		url?: string;
		summary?: string;
		label?: string;
		image?: string;
		location?: {
			address?: string;
			city?: string;
			region?: string;
			postalCode?: string;
			countryCode?: string;
		};
	};
	meta?: {
		language?: string;
		orientation?: string;
		theme?: string;
		version?: string;
	};
	sections?: Record<string, any>;
}

function sanitize(obj: Record<string, any>): Record<string, any> {
	for (const k in obj) {
		if (obj[k] === "") obj[k] = null;
	}
	return obj;
}

export function buildMinimalResumeData(
	parsedResumeText?: string,
	contactInfo?: { name?: string; email?: string; phone?: string },
): ResumeData {
	const name = contactInfo?.name || parsedResumeText?.split("\n")[0]?.trim() || "";
	const email = contactInfo?.email || "";
	const phone = contactInfo?.phone || "";

	return {
		basics: {
			name,
			email,
			phone,
			url: "",
			summary: "",
			label: "",
			image: "",
			location: {
				address: "",
				city: "",
				region: "",
				postalCode: "",
				countryCode: "",
			},
		},
		meta: {
			language: "en",
			orientation: "portrait",
			theme: "minimalist",
			version: "5.0.0",
		},
		sections: {
			work: {
				id: "work",
				name: "Work Experience",
				type: "work",
				visible: true,
				items: [],
			},
			education: {
				id: "education",
				name: "Education",
				type: "education",
				visible: true,
				items: [],
			},
			skills: {
				id: "skills",
				name: "Skills",
				type: "skills",
				visible: true,
				items: [],
			},
			projects: {
				id: "projects",
				name: "Projects",
				type: "projects",
				visible: true,
				items: [],
			},
			certificates: {
				id: "certificates",
				name: "Certificates",
				type: "certificates",
				visible: true,
				items: [],
			},
			languages: {
				id: "languages",
				name: "Languages",
				type: "languages",
				visible: true,
				items: [],
			},
			interests: {
				id: "interests",
				name: "Interests",
				type: "interests",
				visible: true,
				items: [],
			},
			references: {
				id: "references",
				name: "References",
				type: "references",
				visible: true,
				items: [],
			},
			summary: {
				id: "summary",
				name: "Summary",
				type: "text",
				visible: true,
				content: parsedResumeText || "",
			},
		},
	};
}

export async function importResume(resumeData: ResumeData): Promise<Resume> {
	if (REACTIVE_VERBOSE_LOG) {
		console.log(`[importResume] Sending data to /resumes/import`);
	}

	try {
		const res = await withRetry(async () => {
			return await reactiveClient.post("/resumes/import", {
				data: resumeData,
			});
		}, 1);

		console.log(`[importResume] Raw response:`, JSON.stringify(res.data).slice(0, 500));

		if (res.data?.unhandled) {
			throw new Error(res.data.message || "Import failed");
		}

		const resume = res.data?.data || res.data;
		console.log(`[importResume] Processed resume:`, JSON.stringify(resume).slice(0, 500));

		TELEMETRY.importSuccess++;
		if (REACTIVE_VERBOSE_LOG) {
			console.log(`[importResume] Success, resume ID: ${resume.id}`);
		}
		return resume;
	} catch (error) {
		TELEMETRY.importFail++;
		if (isAxiosError(error)) {
			console.error(`[importResume] Failed:`, {
				status: error.response?.status,
				statusText: error.response?.statusText,
				data: error.response?.data,
			});

			// Log validation issues if present
			if (error.response?.data?.data?.issues) {
				console.error("[importResume] Validation issues:", error.response.data.data.issues);
			}
		}
		throw error;
	}
}

export async function createResume(title: string, resumeData?: ResumeData): Promise<Resume> {
	if (REACTIVE_VERBOSE_LOG) {
		console.log(`[createResume] Creating resume: ${title}`);
	}

	// If we have resume data, use /resumes/import which handles validation better
	if (resumeData) {
		try {
			return await importResume(resumeData);
		} catch (importError) {
			console.log("[createResume] importResume failed, trying direct create");
		}
	}

	// Otherwise create minimal resume
	const minimalData = buildMinimalResumeData();

	try {
		const res = await withRetry(async () => {
			return await reactiveClient.post("/resumes", {
				title,
				slug: title.toLowerCase().replace(/\s+/g, "-"),
				data: minimalData,
			});
		}, 1);

		if (res.data?.unhandled) {
			throw new Error(res.data.message || "Create failed");
		}

		TELEMETRY.importSuccess++;
		return res.data?.data || res.data;
	} catch (error) {
		TELEMETRY.importFail++;
		if (isAxiosError(error)) {
			console.error(`[createResume] Failed:`, {
				status: error.response?.status,
				statusText: error.response?.statusText,
				data: error.response?.data,
			});

			// Log validation issues if present
			if (error.response?.data?.data?.issues) {
				console.error("[createResume] Validation issues:", error.response.data.data.issues);
			}
		}
		throw error;
	}
}

export async function patchResume(resumeId: string, data: any): Promise<void> {
	const patches: Array<{ op: string; path: string; value: any }> = [];

	if (data.basics) {
		patches.push({
			op: "replace",
			path: "/basics",
			value: sanitize(data.basics),
		});
	}

	if (data.work?.length) {
		patches.push({
			op: "replace",
			path: "/sections/work/items",
			value: data.work,
		});
	}

	if (data.education?.length) {
		patches.push({
			op: "replace",
			path: "/sections/education/items",
			value: data.education,
		});
	}

	if (data.skills?.length) {
		patches.push({
			op: "replace",
			path: "/sections/skills/items",
			value: data.skills,
		});
	}

	if (patches.length === 0) {
		console.warn("[reactiveResumeClient] No patchable sections found in resume data.");
		return;
	}

	if (process.env.NODE_ENV === "development" || REACTIVE_VERBOSE_LOG) {
		console.log(`[patchResume] Patching resume ${resumeId} with ${patches.length} section(s)`);
	}

	await withRetry(async () => {
		await reactiveClient.patch(`/resumes/${resumeId}`, patches);
	}, 3);
}

export async function updateResume(resumeId: string, data: Partial<Resume>): Promise<Resume> {
	return await withRetry(async () => {
		const res = await reactiveClient.patch(`/resumes/${resumeId}`, data);
		return res.data;
	}, 3);
}

export async function getResume(resumeId: string): Promise<Resume> {
	return await withRetry(async () => {
		const res = await reactiveClient.get(`/resumes/${resumeId}`);
		return res.data;
	}, 3);
}

export async function getResumes(): Promise<Resume[]> {
	return await withRetry(async () => {
		const res = await reactiveClient.get("/resumes");
		return res.data;
	}, 3);
}

export async function exportResumePDF(resumeId: string): Promise<ArrayBuffer> {
	return await withRetry(async () => {
		const res = await reactiveClient.get(`/resumes/${resumeId}/pdf`, {
			responseType: "arraybuffer",
			headers: {
				Accept: "application/pdf",
			},
		});
		return res.data;
	}, 3);
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
	try {
		const res = await reactiveClient.get("/ai/test-connection");
		return { success: true, message: JSON.stringify(res.data) };
	} catch (error) {
		if (error instanceof AxiosError) {
			return {
				success: false,
				message: `Status ${error.response?.status}: ${JSON.stringify(error.response?.data)}`,
			};
		}
		return { success: false, message: String(error) };
	}
}

export interface ChatParseRequest {
	messages: Array<{
		role: "system" | "user";
		content: string;
	}>;
	provider?: string;
	model?: string;
	apiKey?: string;
	baseURL?: string;
	temperature?: number;
	max_tokens?: number;
}

export async function parseViaChat(
	fileBase64: string,
	prompt: string,
	options?: {
		provider?: string;
		model?: string;
		apiKey?: string;
		baseURL?: string;
	},
): Promise<any> {
	const payload: ChatParseRequest = {
		messages: [
			{
				role: "system",
				content: `You are a resume parsing assistant. Output ONLY valid JSON that matches the Reactive Resume ResumeData schema. 
Do not include any explanation, markdown formatting, or text outside the JSON.
The JSON should have these required top-level keys: basics, meta, sections.
basics should have: name, email, phone, summary.
meta should have: language, orientation, theme, version.
sections should contain work, education, skills arrays.`,
			},
			{
				role: "user",
				content: `${prompt}\n\nHere is the resume as base64 PDF:\n${fileBase64}`,
			},
		],
		provider: options?.provider || process.env.LLM_PROVIDER || "openai",
		model: options?.model || process.env.LLM_MODEL || "gpt-4o-mini",
		apiKey: options?.apiKey || process.env.LLM_API_KEY,
		baseURL: options?.baseURL || process.env.LLM_PROVIDER_BASE_URL,
		temperature: 0.1,
		max_tokens: 4096,
	};

	if (REACTIVE_VERBOSE_LOG) {
		console.log("[parseViaChat] Sending chat request to /ai/chat", {
			model: payload.model,
			provider: payload.provider,
		});
	}

	const res = await withRetry(async () => {
		return await reactiveClient.post("/ai/chat", payload, {
			timeout: 120000,
		});
	}, 3);

	return res.data;
}
