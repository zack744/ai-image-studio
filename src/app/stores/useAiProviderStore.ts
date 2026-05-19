import { create } from "zustand";

export type AiProvider = Record<string, any>;

interface AiProviderState {
	providers: AiProvider[];
	setProviders: (providers: AiProvider[]) => void;
}

export const useAiProviderStore = create<AiProviderState>((set) => ({
	providers: [],
	setProviders: (providers) => set({ providers }),
}));
