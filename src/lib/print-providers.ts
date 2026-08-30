// The registry of print providers (spec 041). One entry today; the point of the model is that
// a second one is a table, not a refactor. `BookSize.provider` names which entry a size
// belongs to, so an album always knows whose specifications it has to satisfy.

import { BLURB } from "./provider-blurb";
import type { CoverSpec, PageSpec, PrintProvider } from "./print-provider";

export const PROVIDERS: PrintProvider[] = [BLURB];

export const DEFAULT_PROVIDER = BLURB.id;

export function providerOrDefault(id: string | undefined | null): PrintProvider {
  return PROVIDERS.find((p) => p.id === id) ?? BLURB;
}

/** The page specification for a book size, or undefined when the provider has no such size. */
export function pageSpecOf(providerId: string, sizeId: string): PageSpec | undefined {
  return providerOrDefault(providerId).pages[sizeId];
}

/** The cover specification for a size and construction, or undefined when it is not offered. */
export function coverSpecOf(providerId: string, sizeId: string, coverId: string): CoverSpec | undefined {
  return providerOrDefault(providerId).covers[sizeId]?.[coverId];
}

/** The constructions a provider can print for a size, in menu order. */
export function coverSpecsFor(providerId: string, sizeId: string): CoverSpec[] {
  return Object.values(providerOrDefault(providerId).covers[sizeId] ?? {});
}
