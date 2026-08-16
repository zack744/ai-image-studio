import { ServiceException } from "@/app/lib/exception";
import type { AiProvider } from "../types/provider";

export const SUCHUANG_PROVIDER_ID = "suchuang";
export const SUCHUANG_MODEL_ID = "suchuang-ai";
export const WAVESPEED_PROVIDER_ID = "wavespeed";
export const WAVESPEED_MODEL_ID = "wavespeed-ai/z-image/turbo";

export const AI_PROVIDERS: AiProvider[] = [
	{
		id: SUCHUANG_PROVIDER_ID,
		name: "速创AI",
		enabledByDefault: true,
		supportCors: true,
		models: [
			{
				id: SUCHUANG_MODEL_ID,
				name: "速创AI",
				ability: "i2i",
				maxInputImages: 1,
				enabledByDefault: true,
				supportedAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
			},
		],
		settings: [{ key: "apiKey", type: "password", required: false }],
		parseSettings: <T>() => ({}) as T,
		generate: async (_request) => {
			throw new Error("Direct generation is not supported. Use the Worker API instead.");
		},
	},
	{
		id: WAVESPEED_PROVIDER_ID,
		name: "WaveSpeed",
		enabledByDefault: false,
		supportCors: true,
		models: [
			{
				id: WAVESPEED_MODEL_ID,
				name: "Z-Image Turbo",
				ability: "t2i",
				enabledByDefault: true,
				supportedAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
			},
		],
		settings: [{ key: "apiKey", type: "password", required: false }],
		parseSettings: <T>() => ({}) as T,
		generate: async (_request) => {
			throw new Error("Direct generation is not supported. Use the Worker API instead.");
		},
	},
];

export function getDefaultProvider() {
	return AI_PROVIDERS[0]!;
}

export function getProviderById(providerId: string) {
	const provider = AI_PROVIDERS.find((provider) => provider.id === providerId);
	if (!provider) {
		throw new ServiceException("not_found", "AI provider not found in system");
	}
	return provider;
}

export function getModelById(providerId: string, modelId: string) {
	const provider = getProviderById(providerId);
	const model = provider.models.find((model) => model.id === modelId);
	if (!model) {
		throw new ServiceException("not_found", `Model ${modelId} not found in provider ${providerId}`);
	}
	return model;
}

function aspectRatioToSize(aspectRatio?: string) {
	switch (aspectRatio) {
		case "16:9":
			return "1920x1080";
		case "9:16":
			return "1080x1920";
		case "4:3":
			return "1600x1200";
		case "3:4":
			return "1200x1600";
		default:
			return "1024x1024";
	}
}
