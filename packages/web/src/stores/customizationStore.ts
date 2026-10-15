import { create } from 'zustand';
import { useEffect } from 'react';
import type { CosmeticItem, CustomizationCatalog } from '@backspace/shared';

interface CustomizationState {
  items: CosmeticItem[];
  byId: Map<string, CosmeticItem>;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
}
let pending: Promise<void> | null = null;
export const useCustomizationStore = create<CustomizationState>((set, get) => ({
  items: [], byId: new Map(), loading: false, loaded: false, error: null,
  load: () => {
    if (get().loaded) return Promise.resolve();
    if (pending) return pending;
    set({ loading: true, error: null });
    pending = (async () => {
      try {
        const response = await fetch('/api/customization/catalog');
        if (!response.ok) throw new Error('Não foi possível carregar a biblioteca de personalização.');
        const catalog = await response.json() as CustomizationCatalog;
        if (!Array.isArray(catalog.items)) throw new Error('A biblioteca de personalização está indisponível.');
        set({ items: catalog.items, byId: new Map(catalog.items.map(item => [item.id, item])), loaded: true });
      } catch (error) { set({ error: error instanceof Error ? error.message : 'Não foi possível carregar a biblioteca.' }); }
      finally { set({ loading: false }); pending = null; }
    })();
    return pending;
  },
}));
export function useCosmeticItem(id: string | null | undefined): CosmeticItem | undefined {
  const item = useCustomizationStore(state => id ? state.byId.get(id) : undefined);
  const load = useCustomizationStore(state => state.load);
  useEffect(() => { if (id) void load(); }, [id, load]);
  return item;
}
export function cosmeticAvatarUrl(id: string | null | undefined, animated = true): string | undefined {
  return id && /^\d{1,24}$/.test(id) ? `/api/customization/items/${id}/${animated ? 'animated' : 'static'}` : undefined;
}
