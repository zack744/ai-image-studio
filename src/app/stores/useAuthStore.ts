import { apiClient } from "@/app/lib/api-client";
import { create } from "zustand";

type User = {
	id: string;
	name: string;
	email: string;
	image?: string;
};

type AuthState = {
	user: User | null;
	isLoading: boolean;
	error: Error | null;
	loaded: boolean;
	loadUser: () => Promise<void>;
	register: (email: string, password: string, name: string) => Promise<{ user: User }>;
	login: (email: string, password: string) => Promise<{ user: User }>;
	logout: () => void;
};

let inflight: Promise<void> | null = null;
let hasLoadedOnce = false;

export const useAuthStore = create<AuthState>((set, get) => ({
	user: null,
	isLoading: true,
	error: null,
	loaded: false,

	loadUser: async () => {
		if (inflight) return inflight;
		if (hasLoadedOnce && (get().user !== null || !apiClient.getToken())) return;

		inflight = (async () => {
			const token = apiClient.getToken();
			if (!token) {
				set({ user: null, loaded: true, isLoading: false });
				return;
			}

			try {
				const userData = await apiClient.auth.getMe();
				set({ user: userData, loaded: true, error: null, isLoading: false });
			} catch (e: any) {
				if (e?.code === "unauthorized") {
					apiClient.clearToken();
				}
				set({ user: null, loaded: true, isLoading: false });
			} finally {
				hasLoadedOnce = true;
				inflight = null;
			}
		})();

		return inflight;
	},

	register: async (email, password, name) => {
		try {
			const data = await apiClient.auth.register(email, password, name);
			set({ user: data.user, loaded: true, error: null, isLoading: false });
			return data;
		} catch (e) {
			set({ error: e as Error });
			throw e;
		}
	},

	login: async (email, password) => {
		try {
			const data = await apiClient.auth.login(email, password);
			set({ user: data.user, loaded: true, error: null, isLoading: false });
			return data;
		} catch (e) {
			set({ error: e as Error });
			throw e;
		}
	},

	logout: () => {
		apiClient.clearToken();
		set({ user: null });
	},
}));
