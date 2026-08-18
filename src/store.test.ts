import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { useAlbum } from "./store";
import { clearAll, loadProjectDoc, saveProjectDoc } from "./persistence";
import { newCover, newProjectDoc } from "./lib/project";
import type { ProjectDoc } from "./lib/project";
import type { AlbumPage, Photo } from "./types";

// syncLayout is the load-bearing rule: a page's layoutId must always match a
// template whose leaf count equals the page's photo count. Any action that changes
// the count has to keep that invariant, or a persisted layout would render wrong.

const photo = (id: string, pageId: string | null = null): Photo => ({
  id,
  url: "",
  w: 100,
  h: 100,
  ratio: 1,
  time: 0,
  name: id,
  caption: "",
  pageId,
});

const page = (id: string, photoIds: string[], layoutId: string): AlbumPage => ({
  id,
  title: "",
  photoIds,
  whitespace: 4,
  layoutId,
});

const layoutOf = (pageId: string) =>
  useAlbum.getState().pages.find((p) => p.id === pageId)!.layoutId;

describe("store layout sync", () => {
  it("setPageCount resets the layout to the new count's default when shrinking", () => {
    useAlbum.setState({
      photos: [photo("a", "pg"), photo("b", "pg"), photo("c", "pg")],
      pages: [page("pg", ["a", "b", "c"], "three-row")],
    });
    useAlbum.getState().setPageCount("pg", 2);
    expect(layoutOf("pg")).toBe("two-row"); // defaultLayoutId(2)
    expect(useAlbum.getState().pages[0].photoIds).toHaveLength(2);
  });

  it("setPageCount resets the layout when growing from the library pool", () => {
    useAlbum.setState({
      photos: [photo("a", "pg"), photo("b", "pg"), photo("c", "pg"), photo("d", null)],
      pages: [page("pg", ["a", "b", "c"], "one-beside-two")],
    });
    useAlbum.getState().setPageCount("pg", 4);
    expect(layoutOf("pg")).toBe("four-row"); // defaultLayoutId(4)
  });

  it("setPageCount borrows from later pages when the library pool is empty", () => {
    useAlbum.setState({
      photos: [
        photo("a", "p1"),
        photo("b", "p1"),
        photo("c", "p1"),
        photo("d", "p2"),
        photo("e", "p2"),
        photo("f", "p2"),
      ],
      pages: [
        page("p1", ["a", "b", "c"], "three-row"),
        page("p2", ["d", "e", "f"], "three-row"),
      ],
    });
    useAlbum.getState().setPageCount("p1", 5);
    const s = useAlbum.getState();
    expect(s.pages.find((p) => p.id === "p1")!.photoIds).toEqual(["a", "b", "c", "d", "e"]);
    expect(s.pages.find((p) => p.id === "p2")!.photoIds).toEqual(["f"]);
    expect(s.pages.find((p) => p.id === "p1")!.layoutId).toBe("five-2-3"); // default for 5
  });

  it("setPageCount keeps a custom layout when the count is unchanged", () => {
    useAlbum.setState({
      photos: [photo("a", "pg"), photo("b", "pg"), photo("c", "pg")],
      pages: [page("pg", ["a", "b", "c"], "one-beside-two")],
    });
    useAlbum.getState().setPageCount("pg", 3);
    expect(layoutOf("pg")).toBe("one-beside-two");
  });

  it("setPageLayout changes only the target page", () => {
    useAlbum.setState({
      photos: [
        photo("a", "p1"),
        photo("b", "p1"),
        photo("c", "p1"),
        photo("d", "p2"),
        photo("e", "p2"),
        photo("f", "p2"),
      ],
      pages: [
        page("p1", ["a", "b", "c"], "three-row"),
        page("p2", ["d", "e", "f"], "three-row"),
      ],
    });
    useAlbum.getState().setPageLayout("p1", "one-over-two");
    expect(layoutOf("p1")).toBe("one-over-two");
    expect(layoutOf("p2")).toBe("three-row");
  });

  it("placeOnPage across a count boundary re-syncs the layout", () => {
    useAlbum.setState({
      photos: [photo("a", "pg"), photo("b", "pg"), photo("c", "pg"), photo("d", null)],
      pages: [page("pg", ["a", "b", "c"], "two-over-one")],
    });
    useAlbum.getState().placeOnPage("d", "pg");
    expect(useAlbum.getState().pages[0].photoIds).toHaveLength(4);
    expect(layoutOf("pg")).toBe("four-row"); // 3-photo layout no longer valid
  });

  it("removeFromPage across a count boundary re-syncs the layout", () => {
    useAlbum.setState({
      photos: [photo("a", "pg"), photo("b", "pg"), photo("c", "pg")],
      pages: [page("pg", ["a", "b", "c"], "one-beside-two")],
    });
    useAlbum.getState().removeFromPage("c");
    expect(useAlbum.getState().pages[0].photoIds).toHaveLength(2);
    expect(layoutOf("pg")).toBe("two-row");
  });
});

describe("store project management", () => {
  beforeAll(() => {
    // jsdom-less node has no object URL API; the CRUD paths never render, so stub it.
    globalThis.URL.createObjectURL ??= () => "blob:test";
    globalThis.URL.revokeObjectURL ??= () => {};
  });

  beforeEach(async () => {
    await clearAll();
    useAlbum.setState({
      photos: [],
      pages: [],
      format: "square",
      projects: [],
      activeId: null,
      activeCreatedAt: 0,
      ready: false,
      persistent: false,
    });
    await useAlbum.getState().initProjects();
  });

  it("initProjects marks persistence available with no projects yet", () => {
    const s = useAlbum.getState();
    expect(s.persistent).toBe(true);
    expect(s.ready).toBe(true);
    expect(s.projects).toEqual([]);
    expect(s.activeId).toBeNull();
  });

  it("createProject sets an active empty project and lists it", async () => {
    await useAlbum.getState().createProject("Holiday");
    const s = useAlbum.getState();
    expect(s.activeId).not.toBeNull();
    expect(s.activeName).toBe("Holiday");
    expect(s.photos).toEqual([]);
    expect(s.pages).toEqual([]);
    expect(s.projects.map((m) => m.name)).toContain("Holiday");
  });

  it("renameProject updates the active name and its meta", async () => {
    await useAlbum.getState().createProject("Old");
    const id = useAlbum.getState().activeId!;
    await useAlbum.getState().renameProject(id, "New");
    const s = useAlbum.getState();
    expect(s.activeName).toBe("New");
    expect(s.projects.find((m) => m.id === id)!.name).toBe("New");
  });

  it("duplicateProject creates a distinct active copy in the list", async () => {
    await useAlbum.getState().createProject("Base");
    const srcId = useAlbum.getState().activeId!;
    await useAlbum.getState().duplicateProject(srcId);
    const s = useAlbum.getState();
    expect(s.activeId).not.toBe(srcId);
    expect(s.projects).toHaveLength(2);
    expect(s.projects.some((m) => m.name === "Base copy")).toBe(true);
  });

  it("deleteProject switches to the remaining project", async () => {
    await useAlbum.getState().createProject("First");
    const firstId = useAlbum.getState().activeId!;
    await useAlbum.getState().createProject("Second");
    const secondId = useAlbum.getState().activeId!;
    await useAlbum.getState().deleteProject(secondId);
    const s = useAlbum.getState();
    expect(s.projects.map((m) => m.id)).toEqual([firstId]);
    expect(s.activeId).toBe(firstId);
  });

  it("deleteProject of the only project falls back to the empty state", async () => {
    await useAlbum.getState().createProject("Solo");
    const id = useAlbum.getState().activeId!;
    await useAlbum.getState().deleteProject(id);
    const s = useAlbum.getState();
    expect(s.projects).toEqual([]);
    expect(s.activeId).toBeNull();
    expect(s.photos).toEqual([]);
  });

  it("flushes the outgoing project's pending edit when switching away", async () => {
    await useAlbum.getState().createProject("A");
    const aId = useAlbum.getState().activeId!;
    useAlbum.getState().addPage();
    const pageId = useAlbum.getState().pages[0].id;
    useAlbum.getState().setPageTitle(pageId, "kept edit");
    // The 400ms debounce has NOT elapsed; switching must flush A's edit explicitly,
    // or it would be lost (and a stale timer could later write under B's id).
    await useAlbum.getState().createProject("B");
    const aDoc = await loadProjectDoc(aId);
    expect(aDoc?.pages.find((p) => p.id === pageId)?.title).toBe("kept edit");
  });

  it("updateCover changes only the target cover face", async () => {
    await useAlbum.getState().createProject("X");
    useAlbum.getState().updateCover("front", { title: "Front title" });
    useAlbum.getState().updateCover("insideFront", { title: "Dedication" });
    useAlbum.getState().updateCover("back", { subtitle: "Back note" });
    const s = useAlbum.getState();
    expect(s.frontCover.title).toBe("Front title");
    expect(s.insideFrontCover.title).toBe("Dedication");
    expect(s.insideBackCover.title).toBe(""); // untouched
    expect(s.backCover.subtitle).toBe("Back note");
    expect(s.frontCover.subtitle).toBe(""); // untouched
  });

  it("persists covers with the project", async () => {
    await useAlbum.getState().createProject("Cov");
    const id = useAlbum.getState().activeId!;
    useAlbum.getState().updateCover("front", { title: "Hello", subtitle: "2026" });
    await useAlbum.getState().createProject("Other"); // flushes Cov on switch
    const doc = await loadProjectDoc(id);
    expect(doc?.frontCover).toMatchObject({ title: "Hello", subtitle: "2026" });
  });

  it("setFontTheme and setColorTheme change only their own field", async () => {
    await useAlbum.getState().createProject("Styled");
    useAlbum.getState().setFontTheme("rounded");
    useAlbum.getState().setColorTheme("slate");
    const s = useAlbum.getState();
    expect(s.fontTheme).toBe("rounded");
    expect(s.colorTheme).toBe("slate");
    expect(s.format).toBe("square"); // untouched
  });

  it("createProject resets the theme to the defaults", async () => {
    await useAlbum.getState().createProject("A");
    useAlbum.getState().setFontTheme("typewriter");
    useAlbum.getState().setColorTheme("sage");
    await useAlbum.getState().createProject("B");
    const s = useAlbum.getState();
    expect(s.fontTheme).toBe("serif");
    expect(s.colorTheme).toBe("classic");
  });

  it("persists the theme with the project and restores it on open", async () => {
    await useAlbum.getState().createProject("Themed");
    const id = useAlbum.getState().activeId!;
    useAlbum.getState().setFontTheme("humanist");
    useAlbum.getState().setColorTheme("warm");
    await useAlbum.getState().createProject("Other"); // flush Themed on switch
    await useAlbum.getState().openProject(id);
    const s = useAlbum.getState();
    expect(s.fontTheme).toBe("humanist");
    expect(s.colorTheme).toBe("warm");
  });

  it("defaults the theme when opening a project saved before it existed", async () => {
    const legacy = newProjectDoc("LegacyTheme", 1);
    legacy.id = "legacy-theme";
    delete (legacy as Partial<ProjectDoc>).fontTheme;
    delete (legacy as Partial<ProjectDoc>).colorTheme;
    await saveProjectDoc(legacy as ProjectDoc);
    await useAlbum.getState().openProject("legacy-theme");
    const s = useAlbum.getState();
    expect(s.fontTheme).toBe("serif");
    expect(s.colorTheme).toBe("classic");
  });

  it("setTextSize changes only the target role", async () => {
    await useAlbum.getState().createProject("Sized");
    useAlbum.getState().setTextSize("title", "lg");
    useAlbum.getState().setTextSize("caption", "sm");
    const s = useAlbum.getState();
    expect(s.textSizes).toEqual({ title: "lg", subtitle: "md", caption: "sm" });
  });

  it("createProject resets the text sizes to the defaults", async () => {
    await useAlbum.getState().createProject("A");
    useAlbum.getState().setTextSize("title", "lg");
    await useAlbum.getState().createProject("B");
    expect(useAlbum.getState().textSizes).toEqual({ title: "md", subtitle: "md", caption: "md" });
  });

  it("persists the text sizes and restores them on open", async () => {
    await useAlbum.getState().createProject("Sized");
    const id = useAlbum.getState().activeId!;
    useAlbum.getState().setTextSize("subtitle", "lg");
    await useAlbum.getState().createProject("Other"); // flush on switch
    await useAlbum.getState().openProject(id);
    expect(useAlbum.getState().textSizes.subtitle).toBe("lg");
  });

  it("defaults the text sizes when opening a project saved before they existed", async () => {
    const legacy = newProjectDoc("LegacySizes", 1);
    legacy.id = "legacy-sizes";
    delete (legacy as Partial<ProjectDoc>).textSizes;
    await saveProjectDoc(legacy as ProjectDoc);
    await useAlbum.getState().openProject("legacy-sizes");
    expect(useAlbum.getState().textSizes).toEqual({ title: "md", subtitle: "md", caption: "md" });
  });

  it("defaults covers when opening a project saved before covers existed", async () => {
    const legacy = newProjectDoc("Legacy", 1);
    legacy.id = "legacy";
    // Simulate an old document that predates the cover fields (all four).
    delete (legacy as Partial<ProjectDoc>).frontCover;
    delete (legacy as Partial<ProjectDoc>).insideFrontCover;
    delete (legacy as Partial<ProjectDoc>).insideBackCover;
    delete (legacy as Partial<ProjectDoc>).backCover;
    await saveProjectDoc(legacy as ProjectDoc);
    await useAlbum.getState().openProject("legacy");
    const s = useAlbum.getState();
    expect(s.frontCover).toEqual(newCover());
    expect(s.insideFrontCover).toEqual(newCover());
    expect(s.insideBackCover).toEqual(newCover());
    expect(s.backCover).toEqual(newCover());
  });
});
