#!/usr/bin/env node
// Replays Blurb's book size specification calculator and prints the tables that
// `src/lib/provider-blurb.ts` holds. Run it when Blurb changes a size, a cover construction or a
// spine, and paste the result rather than editing a number by hand.
//
//   node scripts/harvest-blurb-specs.mjs            # every size, cover and sampled page count
//   node scripts/harvest-blurb-specs.mjs --json     # raw rows instead of the table
//
// The calculator is a plain Rails form: GET the page for a CSRF token and a session cookie,
// then POST one combination at a time. Be gentle. Blurb rate limits, and a burst of parallel
// requests gets the whole IP dropped for a while (which is how this script learned to be
// sequential with a delay).

const URL_CALC = "https://www.blurb.com/make/pdf_to_book/booksize_calculator";
const DELAY_MS = 1500;

// Our catalog ids, mapped to the calculator's book_type values.
const SIZES = {
  "blurb-square-7": "small_square",
  "blurb-square-12": "large_square",
  "blurb-portrait-8x10": "standard_portrait_true8x10",
  "blurb-landscape-10x8": "standard_landscape",
  "blurb-landscape-13x11": "large_format_landscape",
};

// Our cover ids, mapped to the calculator's cover_type values and to the i18n key that names
// each construction in the export panel.
const COVERS = {
  softcover: { type: "softcover", labelKey: "export.coverSoftcover" },
  "dust-jacket": { type: "hardcover", labelKey: "export.coverDustJacket" },
  imagewrap: { type: "lithowrap", labelKey: "export.coverImageWrap" },
};

// Sampled page counts. The spine is the only field that moves with the page count, and we
// interpolate between these points.
const PAGE_COUNTS = [20, 40, 80, 160];
// The spine, and only the spine, moves with the paper. Blurb prices many stocks but they
// thicken the block in two families.
const PAPERS = { standard: "standard", premium: "premium-matte" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function session() {
  const res = await fetch(URL_CALC);
  const html = await res.text();
  const token = html.match(/name="authenticity_token" type="hidden" value="([^"]+)"/)?.[1];
  if (!token) throw new Error("no CSRF token: the calculator page changed shape");
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return { token, cookie };
}

async function measure({ token, cookie }, bookType, coverType, paper, pages) {
  const body = new URLSearchParams({
    authenticity_token: token,
    book_type: bookType,
    cover_type: coverType,
    page_count: String(pages),
    paper_type: paper,
    unit_measurement: "inches",
    commit: "Get Measurements",
  });
  const res = await fetch(URL_CALC, { method: "POST", body, headers: { cookie } });
  return parse(await res.text());
}

// The results are a plain definition list. Flatten the markup to tokens and read the value
// that follows each label, skipping the parenthetical units.
function parse(html) {
  const tokens = html
    .replace(/<[^>]+>/g, "|")
    .replace(/&amp;/g, "&")
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean);
  const start = tokens.indexOf("Page Specifications");
  if (start < 0) return null;
  const coverAt = tokens.indexOf("Cover Specifications");
  const value = (label, from) => {
    for (let i = from; i < tokens.length; i++) {
      if (!tokens[i].startsWith(label)) continue;
      for (let j = i + 1; j < Math.min(i + 6, tokens.length); j++) {
        const v = tokens[j];
        if (v.startsWith("(") || v.endsWith(")")) continue;
        if (/^[\d.]+( x [\d.]+)?$/.test(v) || v === "none") return v;
      }
    }
    return null;
  };
  const pair = (v) => (v && v.includes(" x ") ? v.split(" x ").map(Number) : null);
  const out = {
    pageFinal: pair(value("Final, exported PDF", start)),
    pageTrim: pair(value("Page size / trim line", start)),
    pageBleed: Number(value("Bleed", start)),
    safeOuter: Number(value("Margins / Safe boundary", start)),
  };
  if (coverAt > 0) {
    out.coverFinal = pair(value("Final, exported PDF", coverAt));
    out.coverTrim = pair(value("Page size / trim line", coverAt));
    out.coverBleed = Number(value("Bleed", coverAt));
    const flaps = value("Flaps", coverAt);
    out.flap = flaps === "none" ? 0 : pair(flaps)?.[0] ?? 0;
    out.spine = pair(value("Gutter / Spine", coverAt))?.[0] ?? 0;
  }
  // A combination Blurb does not offer comes back as a row of zeroes, not an error.
  return out.pageTrim && out.pageTrim[0] > 0 ? out : null;
}

const rows = [];
const sess = await session();
for (const [sizeId, bookType] of Object.entries(SIZES)) {
  for (const [coverId, cover] of Object.entries(COVERS)) {
    for (const pages of PAGE_COUNTS) {
      for (const [family, paperType] of Object.entries(PAPERS)) {
        await sleep(DELAY_MS);
        let spec = null;
        try {
          spec = await measure(sess, bookType, cover.type, paperType, pages);
        } catch (err) {
          console.error(`  ${sizeId} ${coverId} ${family} ${pages}p failed: ${err.message}`);
        }
        if (!spec) continue;
        rows.push({ sizeId, coverId, family, pages, ...spec });
        console.error(`  ${sizeId} ${coverId} ${family} ${pages}p ok`);
      }
    }
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 1));
  process.exit(0);
}

// Print the two tables in the shape src/lib/provider-blurb.ts wants.
console.log("// pages (src/lib/provider-blurb.ts)");
for (const sizeId of Object.keys(SIZES)) {
  const r = rows.find((x) => x.sizeId === sizeId);
  if (!r) continue;
  console.log(`  "${sizeId}": page(${r.pageTrim[0]}, ${r.pageTrim[1]}),   // bleed ${r.pageBleed}, safe ${r.safeOuter}`);
}
console.log("\n// covers (src/lib/provider-blurb.ts)");
for (const sizeId of Object.keys(SIZES)) {
  const perCover = [];
  for (const coverId of Object.keys(COVERS)) {
    const rs = rows.filter((x) => x.sizeId === sizeId && x.coverId === coverId);
    if (rs.length === 0) continue;
    const r = rs[0];
    // face = (coverTrim - 2 * flap - spine) / 2, and the overhang is what it adds to the page.
    const faceW = (r.coverTrim[0] - 2 * r.flap - r.spine) / 2;
    const overW = round(faceW - r.pageTrim[0]);
    const overH = round((r.coverTrim[1] - r.pageTrim[1]) / 2);
    const spine = (family) =>
      rs
        .filter((x) => x.family === family)
        .map((x) => `{ pages: ${x.pages}, width: ${x.spine} }`)
        .join(", ");
    perCover.push(
      `    "${coverId}": {\n` +
        `      id: "${coverId}", labelKey: "${COVERS[coverId].labelKey}",\n` +
        `      overhangIn: { w: ${overW}, h: ${overH} }, bleedIn: ${r.coverBleed}, flapIn: ${r.flap},\n` +
        `      spineIn: { standard: [${spine("standard")}], premium: [${spine("premium")}] },\n` +
        `    },`,
    );
  }
  if (perCover.length === 0) continue;
  console.log(`  "${sizeId}": {\n${perCover.join("\n")}\n  },`);
}

function round(n) {
  return Math.round(n * 1e6) / 1e6;
}
