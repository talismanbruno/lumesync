import fs from 'node:fs';
import path from 'node:path';
import type { CustomizationCatalog, ProfileCustomization } from '@backspace/shared';
import { config } from '../config.js';

let cached: CustomizationCatalog | undefined;
export function getCustomizationCatalog(): CustomizationCatalog {
  if (cached) return cached;
  const file = path.join(config.customizationDir, 'catalog.json');
  if (!fs.existsSync(file)) return { items: [] };
  cached = JSON.parse(fs.readFileSync(file, 'utf8')) as CustomizationCatalog;
  return cached;
}
export function hasValidCosmeticSelections(value: ProfileCustomization | null): boolean {
  if (!value) return true;
  const selections = ([['avatarDecorationId', 0], ['profileEffectId', 1], ['nameplateId', 2], ['profileFrameId', 3]] as const)
    .filter(([key]) => Boolean(value[key]));
  if (!selections.length) return true;
  const items = getCustomizationCatalog().items;
  return selections.every(([key, type]) => items.some(item => item.id === value[key] && item.type === type));
}
