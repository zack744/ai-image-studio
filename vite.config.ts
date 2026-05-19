import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";
import { analyzer } from "vite-bundle-analyzer";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	function getEnv(key: string, defaultValue?: string): string | undefined {
		const envValue = process.env[key] || env[key];
		if (envValue !== undefined) {
			return JSON.stringify(envValue);
		}
		if (defaultValue !== undefined) {
			return JSON.stringify(defaultValue);
		}
		return undefined;
	}

	return {
		plugins: [
			TanStackRouterVite({
				target: "react",
				autoCodeSplitting: true,
				routesDirectory: "src/app/routes",
				generatedRouteTree: "src/app/routeTree.gen.ts",
			}),
			react(),
			tailwindcss(),
			mode === "analyze" ? analyzer() : undefined,
		],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
		define: {
			"import.meta.env.RUNTIME": getEnv("RUNTIME"),
			"import.meta.env.MODE": getEnv("MODE"),
			"import.meta.env.VITE_WORKER_URL": getEnv("VITE_WORKER_URL", "http://localhost:8787"),
			"import.meta.env.GOOGLE_ANALYTICS_ID": getEnv("GOOGLE_ANALYTICS_ID"),
		},
	};
});
