import { useAuthStore } from "@/app/stores";

let initialLoadStarted = false;
if (!initialLoadStarted && typeof window !== "undefined") {
	initialLoadStarted = true;
	void useAuthStore.getState().loadUser();
}

export function useAuth() {
	const user = useAuthStore((s) => s.user);
	const isLoading = useAuthStore((s) => s.isLoading);
	const error = useAuthStore((s) => s.error);
	return {
		user,
		isLogin: !!user,
		isLoading,
		error,
		register: useAuthStore.getState().register,
		login: useAuthStore.getState().login,
		logout: useAuthStore.getState().logout,
	};
}
