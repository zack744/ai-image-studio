export interface GenerateOptions {
  prompt: string;
  images?: string[];
  n?: number;
  aspectRatio?: string;
  modelId?: string;
}

export interface GenerateResult {
  images: string[];
  errorReason?: string;
}

export interface ImageProvider {
  id: string;
  name: string;
  models: ProviderModel[];
  submit(prompt: string, options: GenerateOptions, apiKey: string): Promise<string>;
  poll(taskId: string, apiKey: string): Promise<{ status: "pending" | "generating" | "completed" | "failed"; images?: string[]; error?: string }>;
}

export interface ProviderModel {
  id: string;
  name: string;
  ability: "t2i" | "i2i";
  maxInputImages?: number;
  supportedAspectRatios?: string[];
}

export interface ProviderRegistry {
  [id: string]: ImageProvider;
}

const registry: ProviderRegistry = {};

export function registerProvider(provider: ImageProvider) {
  registry[provider.id] = provider;
}

export function getProvider(id: string): ImageProvider | undefined {
  return registry[id];
}

export function getProviders(): ImageProvider[] {
  return Object.values(registry);
}
