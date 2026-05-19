import { registerProvider } from "./interface";
import { suchuangProvider } from "./suchuang";

export function initProviders() {
  registerProvider(suchuangProvider);
}

export * from "./interface";
