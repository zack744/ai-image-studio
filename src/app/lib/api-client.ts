const WORKER_URL =
	(typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_WORKER_URL) || "http://localhost:8787";

function getToken(): string | null {
	if (typeof localStorage === "undefined") return null;
	return localStorage.getItem("auth_token");
}

function setToken(token: string) {
	localStorage.setItem("auth_token", token);
}

function clearToken() {
	localStorage.removeItem("auth_token");
}

const FETCH_TIMEOUT_MS = 15000;

function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const token = getToken();
	const headers: Record<string, string> = {
		...(options.headers as Record<string, string>),
	};

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	if (options.body && typeof options.body !== "string" && !(options.body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
		options.body = JSON.stringify(options.body);
	}

	const { signal, clear } = createTimeoutSignal(FETCH_TIMEOUT_MS);

	let resp: Response;
	try {
		resp = await fetch(`${WORKER_URL}${path}`, {
			...options,
			headers,
			signal: options.signal ? options.signal : signal,
		});
	} catch (err: any) {
		clear();
		if (err.name === "AbortError") {
			throw new ApiError("timeout", "Request timed out — server may be unreachable");
		}
		throw new ApiError("network_error", err.message || "Network error");
	}
	clear();

	const data = await resp.json().catch(() => null);

	if (resp.status === 401) {
		clearToken();
		throw new ApiError("unauthorized", data?.error || "Session expired");
	}

	if (!resp.ok) {
		throw new ApiError(data?.error || "request_error", data?.message || `Request failed with status ${resp.status}`);
	}

	return data as T;
}

export class ApiError extends Error {
	code: string;
	constructor(code: string, message: string) {
		super(message);
		this.code = code;
	}
}

// Auth API
async function register(email: string, password: string, name: string) {
	const data = await request<{ token: string; user: any }>("/api/auth/register", {
		method: "POST",
		body: { email, password, name } as any,
	});
	setToken(data.token);
	return data;
}

async function login(email: string, password: string) {
	const data = await request<{ token: string; user: any }>("/api/auth/login", {
		method: "POST",
		body: { email, password } as any,
	});
	setToken(data.token);
	return data;
}

async function getMe() {
	return request<any>("/api/auth/me");
}

// Chat API
async function getChats() {
	return request<any[]>("/api/chats");
}

async function getChatById(id: string) {
	return request<any>(`/api/chats/${id}`);
}

async function createChat(params: {
	title: string;
	provider: string;
	model: string;
	content?: string;
	images?: string[];
	attachments?: Array<{ data: string; type: "image" }>;
	imageCount?: number;
	aspectRatio?: string;
}) {
	return request<{ id: string; messages?: any[] }>("/api/chats", {
		method: "POST",
		body: params as any,
	});
}

async function updateChat(id: string, params: { title?: string; provider?: string; model?: string }) {
	return request<{ success: boolean }>(`/api/chats/${id}`, {
		method: "PUT",
		body: params as any,
	});
}

async function deleteChat(id: string) {
	return request<{ success: boolean }>(`/api/chats/${id}`, {
		method: "DELETE",
	});
}

async function createMessage(params: {
	chatId: string;
	content: string;
	provider: string;
	model: string;
	type?: string;
	images?: string[];
	attachments?: Array<{ data: string; type: "image" }>;
	imageCount?: number;
	aspectRatio?: string;
}) {
	return request<{ messages: any[] }>(`/api/chats/${params.chatId}/messages`, {
		method: "POST",
		body: params as any,
	});
}

async function deleteMessage(chatId: string, messageId: string) {
	return request<{ success: boolean }>(`/api/chats/${chatId}/messages/${messageId}`, {
		method: "DELETE",
	});
}

// Generate API
async function submitGenerate(generationId: string, apiKey?: string) {
	return request<{ success: boolean }>("/api/generate", {
		method: "POST",
		body: { generationId, ...(apiKey ? { apiKey } : {}) } as any,
	});
}

async function getGenerationStatus(id: string) {
	return request<any>(`/api/generate/${id}`);
}

async function regenerateMessage(messageId: string) {
	return request<{ messageId: string; generationId: string }>("/api/generate/regenerate", {
		method: "POST",
		body: { messageId } as any,
	});
}

// Image API
async function uploadImage(file: File) {
	const formData = new FormData();
	formData.append("file", file);
	const token = getToken();
	const headers: Record<string, string> = {};
	if (token) headers.Authorization = `Bearer ${token}`;

	const { signal, clear } = createTimeoutSignal(60000); // 60s for large uploads

	let resp: Response;
	try {
		resp = await fetch(`${WORKER_URL}/api/images/upload`, {
			method: "POST",
			headers,
			body: formData,
			signal,
		});
	} catch (err: any) {
		clear();
		if (err.name === "AbortError") {
			throw new ApiError("timeout", "Upload timed out");
		}
		throw new ApiError("network_error", err.message || "Network error");
	}
	clear();

	if (resp.status === 401) {
		clearToken();
		throw new ApiError("unauthorized", "Session expired");
	}

	const data = await resp.json();
	if (!resp.ok) {
		throw new ApiError(data?.error || "upload_error", data?.message || "Upload failed");
	}
	return data as { id: string; url: string };
}

async function getImageUrl(id: string) {
	return request<{ id: string; url: string; storage: string }>(`/api/images/${id}`);
}

// AI Provider API
async function getAiProviders() {
	return [];
}

export const apiClient = {
	auth: { register, login, getMe, getToken, clearToken },
	chats: { getChats, getChatById, createChat, updateChat, deleteChat, createMessage, deleteMessage },
	generate: { submit: submitGenerate, getStatus: getGenerationStatus, regenerate: regenerateMessage },
	images: { upload: uploadImage, getUrl: getImageUrl },
	ai: { getProviders: getAiProviders },
	getToken,
	setToken,
	clearToken,
	get workerUrl() {
		return WORKER_URL;
	},
};
