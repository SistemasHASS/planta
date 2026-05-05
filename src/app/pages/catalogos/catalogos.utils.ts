import { CATALOGOS_CONFIG } from "./catalogos.config";
import { CatalogoKey } from "./catalogos.type";

export function isCatalogoKey(value: string | null): value is CatalogoKey {
  return !!value && value in CATALOGOS_CONFIG;
}

export function getCatalogoConfig(key: CatalogoKey) {
  return CATALOGOS_CONFIG[key];
}