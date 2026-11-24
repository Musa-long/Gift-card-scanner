import { amazon } from "./amazon.js";
import { apple } from "./apple.js";
import { xbox } from "./xbox.js";
import type { Provider } from "./types.js";

const REGISTRY: Record<string, Provider> = { amazon, apple, xbox };

export const getProvider = (brand: string): Provider => {
  const p = REGISTRY[brand];
  if (!p) throw new Error(`no provider for ${brand}`);
  return p;
};

export const brands = Object.keys(REGISTRY);
