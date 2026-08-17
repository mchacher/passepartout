// The layout catalog.
//
// A page arrangement is an explicit, named template chosen by the user, NOT an
// emergent side effect of the whitespace slider. Each template is a nested split
// of the page box: a "slot" holds one photo, a "split" divides the box along an
// axis into children (optionally weighted). Leaves are visited in order and mapped
// to the page's photos in order.
//
// This module is pure data + pure helpers. A page persists only a layout id; the
// tree lives here, versioned with the app, so templates can be refined without
// migrating existing projects.

/** A node of a layout template. */
export type LayoutNode =
  | { kind: "slot" }
  | {
      kind: "split";
      /** "h" = children side by side (columns); "v" = children stacked (rows). */
      axis: "h" | "v";
      children: LayoutNode[];
      /** Optional relative sizes along the split axis; equal when omitted. */
      weights?: number[];
    };

export interface LayoutTemplate {
  id: string;
  label: string;
  count: number; // number of photo slots (leaves)
  node: LayoutNode;
}

const slot: LayoutNode = { kind: "slot" };
const split = (
  axis: "h" | "v",
  children: LayoutNode[],
  weights?: number[],
): LayoutNode => ({ kind: "split", axis, children, weights });

/** Count the photo slots (leaves) in a template tree. */
export function leafCount(node: LayoutNode): number {
  if (node.kind === "slot") return 1;
  return node.children.reduce((a, c) => a + leafCount(c), 0);
}

// Weight used to make a "hero" photo bigger than its companions.
const HERO = 1.7;

/**
 * The catalog. Order matters: the first template of a given count is that count's
 * default. Ids are stable (persisted on pages) - do not rename, only add.
 */
export const CATALOG: LayoutTemplate[] = [
  { id: "single", label: "Single", count: 1, node: slot },

  { id: "two-row", label: "Side by side", count: 2, node: split("h", [slot, slot]) },
  { id: "two-col", label: "Stacked", count: 2, node: split("v", [slot, slot]) },

  { id: "three-row", label: "Row of 3", count: 3, node: split("h", [slot, slot, slot]) },
  { id: "three-col", label: "Column of 3", count: 3, node: split("v", [slot, slot, slot]) },
  {
    id: "one-over-two",
    label: "1 over 2",
    count: 3,
    node: split("v", [slot, split("h", [slot, slot])]),
  },
  {
    id: "two-over-one",
    label: "2 over 1",
    count: 3,
    node: split("v", [split("h", [slot, slot]), slot]),
  },
  {
    id: "one-beside-two",
    label: "1 beside 2",
    count: 3,
    node: split("h", [slot, split("v", [slot, slot])], [HERO, 1]),
  },

  { id: "four-row", label: "Row of 4", count: 4, node: split("h", [slot, slot, slot, slot]) },
  {
    id: "grid-2x2",
    label: "2 x 2 grid",
    count: 4,
    node: split("v", [split("h", [slot, slot]), split("h", [slot, slot])]),
  },
  {
    id: "one-over-three",
    label: "1 over 3",
    count: 4,
    node: split("v", [slot, split("h", [slot, slot, slot])]),
  },
  {
    id: "three-over-one",
    label: "3 over 1",
    count: 4,
    node: split("v", [split("h", [slot, slot, slot]), slot]),
  },
  {
    id: "one-beside-three",
    label: "1 beside 3",
    count: 4,
    node: split("h", [slot, split("v", [slot, slot, slot])], [HERO, 1]),
  },
];

const BY_ID = new Map(CATALOG.map((t) => [t.id, t]));

/** All templates offered for a given photo count (empty when out of the 1-4 range). */
export function layoutsForCount(count: number): LayoutTemplate[] {
  return CATALOG.filter((t) => t.count === count);
}

/** Resolve a template by id, or undefined when unknown (e.g. an auto layout). */
export function getLayout(id: string): LayoutTemplate | undefined {
  return BY_ID.get(id);
}

/**
 * The default layout id for a photo count: the first catalog template of that
 * count. Counts outside 1-4 have no catalog entry and use an auto template at
 * render time, so we return a synthetic "auto" id here.
 */
export function defaultLayoutId(count: number): string {
  return layoutsForCount(count)[0]?.id ?? "auto";
}

/**
 * A balanced template for any photo count, used when no catalog entry exists
 * (0 photos, or more than 4 dropped on a page by drag). Rows of up to 3, stacked.
 */
export function autoTemplate(count: number): LayoutNode {
  if (count <= 1) return slot;
  const perRow = count <= 4 ? Math.ceil(count / 2) : 3;
  const rows: LayoutNode[] = [];
  let remaining = count;
  while (remaining > 0) {
    const n = Math.min(perRow, remaining);
    rows.push(split("h", Array.from({ length: n }, () => slot)));
    remaining -= n;
  }
  return rows.length === 1 ? rows[0] : split("v", rows);
}

/**
 * Resolve the node to render for a page: its chosen template when the id is known
 * and its leaf count still matches, else a balanced auto template for that count.
 */
export function resolveNode(layoutId: string, count: number): LayoutNode {
  const tpl = getLayout(layoutId);
  if (tpl && tpl.count === count) return tpl.node;
  return autoTemplate(count);
}
