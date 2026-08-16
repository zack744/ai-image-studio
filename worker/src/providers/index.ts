import { registerProvider } from "./interface";
import { suchuangProvider } from "./suchuang";
import { wavespeedProvider } from "./wavespeed";

export function initProviders() {
  registerProvider(suchuangProvider);
  registerProvider(wavespeedProvider);
}

export * from "./interface";
