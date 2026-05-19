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

// Chat service (Worker API)
const chatService = {
  getChats: {
    swr: (key: string | null) =>
      createSwr(key, () => apiClient.chats.getChats()),
  },
  getChatById: {
    swr: (key: string | null, params: { id: string }) =>
      createSwr(key, () => params.id ? apiClient.chats.getChatById(params.id) : Promise.resolve(null)),
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
      createSwrMutation(key, (arg: { id: string; title?: string; provider?: string; model?: string }) =>
        apiClient.chats.updateChat(arg.id, { title: arg.title, provider: arg.provider, model: arg.model }), config),
  },
  createMessage: {
    swrMutation: (key: string | null, config?: any) =>
      createSwrMutation(key, (arg: any) => apiClient.chats.createMessage(arg), config),
  },
  deleteMessage: {
    swrMutation: (key: string | null, config?: any) =>
      createSwrMutation(key, (arg: any) =>
        apiClient.chats.deleteMessage(arg.chatId, arg.messageId), config),
  },
  getGenerationStatus: {
    swr: (key: string | null, params: { generationId: string }) =>
      createSwr(key, () => params.generationId ? apiClient.generate.getStatus(params.generationId) : Promise.resolve(null)),
  },
  createMessageGenerate: {
    swrMutation: (key: string | null, config?: any) =>
      createSwrMutation(key, (arg: { generationId: string }) => apiClient.generate.submit(arg.generationId), config),
  },
  regenerateMessage: {
    swrMutation: (key: string | null, config?: any) =>
      createSwrMutation(key, (arg: { messageId: string }) => apiClient.generate.regenerate(arg.messageId), config),
  },
};

// AI service (static providers + Worker API)
const aiService = {
  getEnabledAiProvidersWithModels: {
    swr: (key: string | null) =>
      createSwr(key, async () => {
        return AI_PROVIDERS.filter((p) => p.enabledByDefault !== false).map((p) => ({
          ...p,
          enabled: true,
          models: p.models.filter((m) => m.enabledByDefault !== false).map((m) => ({ ...m, enabled: true })),
        }));
      }),
  },
  getAiProviderById: {
    swr: (key: string | null, params: { providerId: string }) =>
      createSwr(key, async () => {
        const provider = AI_PROVIDERS.find((p) => p.id === params.providerId);
        if (!provider) return null;
        return { ...provider, enabled: provider.enabledByDefault !== false };
      }),
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
      createSwrMutation(key, async (arg: Record<string, any>) => {
        const state = useUIStore.getState();
        if ("theme" in arg) state.setTheme(arg.theme);
        if ("themeColor" in arg) state.setThemeColor(arg.themeColor);
        if ("language" in arg) state.setLanguage(arg.language);
        return state;
      }, config),
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
