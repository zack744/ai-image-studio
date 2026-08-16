import type { GenerateOptions, ImageProvider } from "./interface";

const SUBMIT_URL = "https://api.wavespeed.ai/api/v3";
const DEFAULT_MODEL_ID = "wavespeed-ai/z-image/turbo";

function aspectRatioToSize(aspectRatio?: string): string {
	switch (aspectRatio) {
		case "16:9":
			return "1920*1080";
		case "9:16":
			return "1080*1920";
		case "4:3":
			return "1600*1200";
		case "3:4":
			return "1200*1600";
		default:
			return "1024*1024";
	}
}

export const wavespeedProvider: ImageProvider = {
	id: "wavespeed",
	name: "WaveSpeed",
	models: [
		{
			id: "wavespeed-ai/z-image/turbo",
			name: "Z-Image Turbo",
			ability: "t2i",
			supportedAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
		},
	],

	async submit(prompt: string, options: GenerateOptions, apiKey: string): Promise<string> {
		const modelId = options.modelId || DEFAULT_MODEL_ID;
		const size = aspectRatioToSize(options.aspectRatio);
		const body = { prompt, size };

		const resp = await fetch(`${SUBMIT_URL}/${modelId}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(60_000),
		});

		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(`WaveSpeed submit failed with status ${resp.status}: ${text}`);
		}

		const payload: any = await resp.json();
		if (payload.code !== 200) {
			throw new Error(`WaveSpeed submit failed: ${JSON.stringify(payload)}`);
		}

		const taskId = payload?.data?.id;
		if (!taskId) {
			throw new Error(`WaveSpeed submit response did not include a task id: ${JSON.stringify(payload)}`);
		}
		return String(taskId);
	},

	async poll(
		taskId: string,
		apiKey: string,
	): Promise<{ status: "pending" | "generating" | "completed" | "failed"; images?: string[]; error?: string }> {
		const url = `https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(taskId)}/result`;

		const resp = await fetch(url, {
			headers: { Authorization: `Bearer ${apiKey}` },
			signal: AbortSignal.timeout(30_000),
		});

		if (!resp.ok) {
			return { status: "failed", error: `Poll failed with status ${resp.status}` };
		}

		const payload: any = await resp.json();
		if (payload.code !== 200 || !payload.data) {
			return { status: "failed", error: `Poll failed: ${JSON.stringify(payload)}` };
		}

		const status = payload.data.status;
		const outputs = payload.data.outputs;

		if (status === "completed") {
			const images = Array.isArray(outputs) ? outputs.filter((x: unknown) => typeof x === "string") : [];
			if (images.length === 0) {
				return { status: "generating" };
			}
			return { status: "completed", images };
		}

		if (status === "failed" || status === "cancelled" || status === "timeout") {
			return { status: "failed", error: "Generation failed" };
		}

		return { status: "generating" };
	},
};
