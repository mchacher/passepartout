import type { Photo } from "../types";

// Generates a handful of gradient "photos" with varied aspect ratios so the
// engine can be seen working before importing real files. Portraits stay
// portrait, panoramas stay panorama: proof that framing is respected.

const SPECS: Array<[number, number]> = [
  [2, 3],
  [3, 2],
  [1, 1],
  [16, 9],
  [3, 4],
  [4, 3],
  [2, 3],
  [16, 7],
  [4, 5],
  [3, 2],
  [1, 1],
  [5, 7],
];

const PALETTE: Array<[string, string]> = [
  ["#2E5B6B", "#7FB0BF"],
  ["#8A6A4A", "#D8B48C"],
  ["#5A6B4E", "#AEC49B"],
  ["#6B4A5A", "#C79BB0"],
  ["#3E4C6B", "#93A6D0"],
  ["#7A5140", "#D2A183"],
  ["#42604F", "#93C0A2"],
  ["#5C5470", "#ABA0C7"],
  ["#71513A", "#C9A277"],
  ["#2F5560", "#86AEB6"],
  ["#6B5E3E", "#CBB988"],
  ["#514A6B", "#A199C4"],
];

export function makeDemoPhotos(): Photo[] {
  const photos: Photo[] = [];
  SPECS.forEach((spec, i) => {
    const [rw, rh] = spec;
    const base = 560;
    let w: number, h: number;
    if (rw >= rh) {
      w = base;
      h = Math.round((base * rh) / rw);
    } else {
      h = base;
      w = Math.round((base * rw) / rh);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, PALETTE[i][0]);
    grad.addColorStop(1, PALETTE[i][1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,.16)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, h * 0.62);
    g.lineTo(w, h * 0.52);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,.85)";
    g.font = "600 22px system-ui, sans-serif";
    g.fillText(String(i + 1).padStart(2, "0"), 16, 34);

    photos.push({
      id: crypto.randomUUID(),
      url: canvas.toDataURL("image/jpeg", 0.85),
      w,
      h,
      ratio: w / h,
      time: 1000 + i,
      name: `example-${i + 1}`,
      caption: "",
      pageId: null,
    });
  });
  return photos;
}
