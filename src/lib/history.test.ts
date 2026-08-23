import { describe, it, expect } from "vitest";
import { pushHistory, popHistory, COALESCE_WINDOW_MS, type HistoryEntry } from "./history";

const LIMIT = 50;
const keys = (stack: HistoryEntry<string>[]) => stack.map((e) => e.snapshot);

describe("pushHistory", () => {
  it("records a step on an empty stack", () => {
    expect(keys(pushHistory([], "a", { limit: LIMIT }))).toEqual(["a"]);
  });

  it("keeps the stack immutable", () => {
    const stack = pushHistory<string>([], "a", { limit: LIMIT });
    const next = pushHistory(stack, "b", { limit: LIMIT });
    expect(keys(stack)).toEqual(["a"]); // the original is untouched
    expect(keys(next)).toEqual(["a", "b"]);
  });

  it("drops the oldest step past the limit", () => {
    let stack: HistoryEntry<string>[] = [];
    for (const s of ["a", "b", "c", "d"]) stack = pushHistory(stack, s, { limit: 3 });
    expect(keys(stack)).toEqual(["b", "c", "d"]);
    expect(stack).toHaveLength(3);
  });

  it("keeps only the newest when the limit is one", () => {
    let stack: HistoryEntry<string>[] = [];
    for (const s of ["a", "b"]) stack = pushHistory(stack, s, { limit: 1 });
    expect(keys(stack)).toEqual(["b"]);
  });
});

describe("pushHistory coalescing", () => {
  it("merges consecutive pushes with the same key, keeping the OLDEST snapshot", () => {
    // Typing "Ete": three pushes, and undo must restore the title as it was before the first
    // keystroke, which is the snapshot recorded first.
    let stack = pushHistory<string>([], "before typing", { limit: LIMIT, coalesceKey: "title:p1" });
    stack = pushHistory(stack, "E", { limit: LIMIT, coalesceKey: "title:p1" });
    stack = pushHistory(stack, "Et", { limit: LIMIT, coalesceKey: "title:p1" });
    expect(keys(stack)).toEqual(["before typing"]);
  });

  it("starts a new step when the key changes", () => {
    let stack = pushHistory<string>([], "a", { limit: LIMIT, coalesceKey: "title:p1" });
    stack = pushHistory(stack, "b", { limit: LIMIT, coalesceKey: "title:p2" });
    expect(keys(stack)).toEqual(["a", "b"]);
  });

  it("starts a new step when the same key comes back after another one", () => {
    let stack = pushHistory<string>([], "a", { limit: LIMIT, coalesceKey: "title:p1" });
    stack = pushHistory(stack, "b", { limit: LIMIT, coalesceKey: "title:p2" });
    stack = pushHistory(stack, "c", { limit: LIMIT, coalesceKey: "title:p1" });
    expect(keys(stack)).toEqual(["a", "b", "c"]);
  });

  it("never merges a keyless push", () => {
    let stack = pushHistory<string>([], "a", { limit: LIMIT });
    stack = pushHistory(stack, "b", { limit: LIMIT });
    expect(keys(stack)).toEqual(["a", "b"]);
  });

  it("does not merge a keyed push onto a keyless one", () => {
    let stack = pushHistory<string>([], "a", { limit: LIMIT });
    stack = pushHistory(stack, "b", { limit: LIMIT, coalesceKey: "title:p1" });
    expect(keys(stack)).toEqual(["a", "b"]);
  });

  it("still respects the limit when a merge happens", () => {
    let stack: HistoryEntry<string>[] = [];
    for (const s of ["a", "b", "c"]) stack = pushHistory(stack, s, { limit: 3 });
    stack = pushHistory(stack, "d", { limit: 3, coalesceKey: "k" });
    stack = pushHistory(stack, "e", { limit: 3, coalesceKey: "k" }); // merges, no growth
    expect(keys(stack)).toEqual(["b", "c", "d"]);
  });
});

describe("pushHistory: a pause breaks the run (R2)", () => {
  it("keeps merging while the edits keep coming", () => {
    let stack = pushHistory<string>([], "before", { limit: LIMIT, coalesceKey: "t", now: 1000 });
    stack = pushHistory(stack, "a", { limit: LIMIT, coalesceKey: "t", now: 1300 });
    stack = pushHistory(stack, "b", { limit: LIMIT, coalesceKey: "t", now: 1600 });
    expect(keys(stack)).toEqual(["before"]); // one step, still the oldest snapshot
  });

  it("starts a new step when the same field is edited again after a pause", () => {
    let stack = pushHistory<string>([], "before", { limit: LIMIT, coalesceKey: "t", now: 1000 });
    stack = pushHistory(stack, "Rome", { limit: LIMIT, coalesceKey: "t", now: 1000 + COALESCE_WINDOW_MS + 1 });
    expect(keys(stack)).toEqual(["before", "Rome"]);
  });

  it("measures the pause from the LAST edit of the run, not the first", () => {
    // Typing steadily for longer than the window is still one step.
    let stack = pushHistory<string>([], "before", { limit: LIMIT, coalesceKey: "t", now: 0 });
    for (let at = 500; at <= 5000; at += 500) {
      stack = pushHistory(stack, `at${at}`, { limit: LIMIT, coalesceKey: "t", now: at });
    }
    expect(keys(stack)).toEqual(["before"]);
  });

  it("merges without a clock, so a caller that passes no time keeps the old behaviour", () => {
    let stack = pushHistory<string>([], "before", { limit: LIMIT, coalesceKey: "t" });
    stack = pushHistory(stack, "a", { limit: LIMIT, coalesceKey: "t" });
    expect(keys(stack)).toEqual(["before"]);
  });
});

describe("popHistory", () => {
  it("returns null on an empty stack", () => {
    expect(popHistory([])).toBeNull();
  });

  it("takes the newest entry and leaves the rest", () => {
    let stack: HistoryEntry<string>[] = [];
    for (const s of ["a", "b", "c"]) stack = pushHistory(stack, s, { limit: LIMIT });
    const popped = popHistory(stack)!;
    expect(popped.entry.snapshot).toBe("c");
    expect(keys(popped.rest)).toEqual(["a", "b"]);
    expect(keys(stack)).toEqual(["a", "b", "c"]); // the input is untouched
  });
});
