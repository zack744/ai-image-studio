import { apiClient } from "@/app/lib/api-client";
import { AI_PROVIDERS } from "@/app/ai/provider";
import useSWR, { type SWRResponse } from "swr";
import useSWRMutation, { type SWRMutationConfiguration, type SWRMutationResponse } from "swr/mutation";
import { useUIStore } from "@/app/stores";

function swrFetcher<T>(fetcher: () => Promise<T>) {
	return () => fetcher();
}

function createSwr<T>(key: string | null, fetcher: () => Promise<T>): SWRResponse<T, Error> {
	return useSWR(key, swrFetcher(fetcher));
}

function createSwrMutation<T, Arg = any>(
	key: string | null,
	fetcher: (arg: Arg) => Promise<T>,
	config?: SWRMutationConfiguration<T, Error, string | null, Arg>,
): SWRMutationResponse<T, Error, string | null, Arg> {
	return useSWRMutation(key, (_key: string | null, { arg }: { arg: Arg }) => fetcher(arg), config);
}

type ProviderOverride = {
	enabled?: boolean;
	settings?: Record<string, any>;
	models?: Record<string, { enabled?: boolean }>;
};

const AI_PROVIDER_OVERRIDES_KEY = "ai_image_studio_ai_provider_overrides";

function readProviderOverrides(): Record<string, ProviderOverride> {
	if (typeof localStorage === "undefined") return {};
	try {
		return JSON.parse(localStorage.getItem(AI_PROVIDER_OVERRIDES_KEY) || "{}");
	} catch {
		return {};
	}
}

function writeProviderOverrides(overrides: Record<string, ProviderOverride>) {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(AI_PROVIDER_OVERRIDES_KEY, JSON.stringify(overrides));
}

export function getProviderStoredSettings(providerId: string): Record<string, any> {
	return readProviderOverrides()[providerId]?.settings || {};
}

export function getProviderApiKey(providerId: string): string | undefined {
	return getProviderStoredSettings(providerId).apiKey;
}

// Pull the current user's server-side provider configs into local overrides.
// Called once after login / initial auth load so keys persist across devices & cache clears.
export async function syncProvidersFromServer(): Promise<void> {
	if (!apiClient.getToken()) return;
	try {
		const serverProviders = await apiClient.providers.list();
		if (!Array.isArray(serverProviders)) return;

		const overrides = readProviderOverrides();
		for (const sp of serverProviders) {
			const providerId = sp.providerId;
			const current = overrides[providerId] || {};
			overrides[providerId] = {
				...current,
				enabled: sp.enabled ?? current.enabled,
				settings: sp.settings && Object.keys(sp.settings).length > 0 ? sp.settings : current.settings,
			};
		}
		writeProviderOverrides(overrides);
	} catch (e) {
		console.error("Failed to sync providers from server:", e);
	}
}

function getProvidersWithOverrides() {
	const overrides = readProviderOverrides();
	return AI_PROVIDERS.map((provider) => {
		const providerOverride = overrides[provider.id] || {};
		return {
			...provider,
			enabled: providerOverride.enabled ?? provider.enabledByDefault !== false,
			settingsValues: providerOverride.settings || {},
			models: provider.models.map((model) => ({
				...model,
				enabled: providerOverride.models?.[model.id]?.enabled ?? model.enabledByDefault !== false,
			})),
		};
	});
}

// Chat service (Worker API)
const chatService = {
	getChats: {
		swr: (key: string | null) => createSwr(key, () => apiClient.chats.getChats()),
	},
	getChatById: {
		swr: (key: string | null, params: { id: string }) =>
			createSwr(key, () => (params.id ? apiClient.chats.getChatById(params.id) : Promise.resolve(null))),
	},
	createChat: {
		swrMutation: (key: string | null, config?: any) =>
			createSwrMutation(key, (arg: any) => apiClient.chats.createChat(arg), config),
	},
	deleteChat: {
		swrMutation: (key: string | null, config?: any) =>
			createSwrMutation(key, (arg: { id: string }) => apiClient.chats.deleteChat(arg.id), config),
	},
	updateChat: {
		swrMutation: (key: string | null, config?: any) =>
			createSwrMutation(
				key,
				(arg: { id: string; title?: string; provider?: string; model?: string }) =>
					apiClient.chats.updateChat(arg.id, { title: arg.title, provider: arg.provider, model: arg.model }),
				config,
			),
	},
	createMessage: {
		swrMutation: (key: string | null, config?: any) =>
			createSwrMutation(key, (arg: any) => apiClient.chats.createMessage(arg), config),
	},
	deleteMessage: {
		swrMutation: (key: string | null, config?: any) =>
			createSwrMutation(key, (arg: any) => apiClient.chats.deleteMessage(arg.chatId, arg.messageId), config),
	},
	getGenerationStatus: {
		swr: (key: string | null, params: { generationId: string }) =>
			createSwr(key, () =>
				params.generationId ? apiClient.generate.getStatus(params.generationId) : Promise.resolve(null),
			),
	},
	createMessageGenerate: {
		swrMutation: (key: string | null, config?: any) =>
			createSwrMutation(
				key,
				(arg: { generationId: string; apiKey?: string }) => apiClient.generate.submit(arg.generationId, arg.apiKey),
				config,
			),
	},
	regenerateMessage: {
		swrMutation: (key: string | null, config?: any) =>
			createSwrMutation(key, (arg: { messageId: string }) => apiClient.generate.regenerate(arg.messageId), config),
	},
};

// AI service (static providers + Worker API)
const aiService = {
	getAiProviders: {
		swr: (key: string | null) => createSwr(key, async () => getProvidersWithOverrides()),
	},
	getEnabledAiProvidersWithModels: {
		swr: (key: string | null) =>
			createSwr(key, async () => {
				return getProvidersWithOverrides()
					.filter((provider) => provider.enabled)
					.map((provider) => ({
						...provider,
						models: provider.models.filter((model) => model.enabled),
					}));
			}),
	},
	getAiProviderById: {
		swr: (key: string | null, params: { providerId: string }) =>
			createSwr(key, async () => {
				return getProvidersWithOverrides().find((provider) => provider.id === params.providerId) || null;
			}),
	},
	getAiModelsByProviderId: {
		swr: (key: string | null, params: { providerId: string }) =>
			createSwr(key, async () => {
				return getProvidersWithOverrides().find((provider) => provider.id === params.providerId)?.models || [];
			}),
	},
	updateAiProvider: async (params: { providerId: string; enabled?: boolean; settings?: Record<string, any> }) => {
		const overrides = readProviderOverrides();
		const current = overrides[params.providerId] || {};
		const next = {
			...current,
			enabled: params.enabled ?? current.enabled,
			settings: params.settings ?? current.settings,
		};
		overrides[params.providerId] = next;
		writeProviderOverrides(overrides);

		// Sync to the server when logged in (persists keys across devices / cache clears)
		if (apiClient.getToken()) {
			try {
				await apiClient.providers.save(params.providerId, {
					enabled: next.enabled,
					settings: next.settings,
				});
			} catch (e) {
				console.error("Failed to sync provider settings to server:", e);
			}
		}

		return getProvidersWithOverrides().find((provider) => provider.id === params.providerId) || null;
	},
	updateAiModel: async (params: { providerId: string; modelId: string; enabled: boolean }) => {
		const overrides = readProviderOverrides();
		const current = overrides[params.providerId] || {};
		overrides[params.providerId] = {
			...current,
			models: {
				...(current.models || {}),
				[params.modelId]: { enabled: params.enabled },
			},
		};
		writeProviderOverrides(overrides);
		return (
			getProvidersWithOverrides()
				.find((provider) => provider.id === params.providerId)
				?.models.find((model) => model.id === params.modelId) || null
		);
	},
};

// Settings service (UI store based)
const settingsService = {
	getSettings: {
		swr: (key: string | null) =>
			createSwr(key, async () => {
				const state = useUIStore.getState();
				return {
					theme: state.theme,
					themeColor: state.themeColor,
					language: state.language,
				};
			}),
	},
	updateSettings: {
		swrMutation: (key: string | null, config?: any) =>
			createSwrMutation(
				key,
				async (arg: Record<string, any>) => {
					const state = useUIStore.getState();
					if ("theme" in arg) state.setTheme(arg.theme);
					if ("themeColor" in arg) state.setThemeColor(arg.themeColor);
					if ("language" in arg) state.setLanguage(arg.language);
					return state;
				},
				config,
			),
	},
};

export function useChatService() {
	return chatService as any;
}

export function useAiService() {
	return aiService as any;
}

export function useSettingsService() {
	return settingsService as any;
}
