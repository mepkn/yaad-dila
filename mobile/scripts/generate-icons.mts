// Redraws the old Yaad Dila bell-with-bolt mark in the pastel-blue palette.
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";

// Usage: npm run icons  (writes into assets/images)
const OUT = process.argv[2] ?? "assets/images";
const NAVY = "#15264A";        // --primary-foreground (light)
const PASTEL = "#8CC2F2";      // --primary
const PASTEL_HI = "#B9DBFA";
const PASTEL_LO = "#78AEEA";
const DARK_BG = "#09090B";     // --background (dark)
const LIGHT_BG = "#EEF5FD";

// Geometry traced from the old 1024px icon, re-centred vertically.
const bell = "M340 452 C340 320 410 247 512 247 C614 247 684 320 684 452 L684 569 L742 650 L282 650 L340 569 Z";
const bolt = "M557 317 L529 443 L593 443 L471 616 L497 501 L437 501 Z";
const clapper = { cx: 512, cy: 731, r: 46 };

type MarkOptions = {
  bellFill: string;
  boltFill: string;
  dotFill: string;
  scale?: number;
  withDot?: boolean;
};

function mark({ bellFill, boltFill, dotFill, scale = 1, withDot = true }: MarkOptions): string {
  const t = `translate(512 500) scale(${scale}) translate(-512 -500)`;
  return `<g transform="${t}">
    <path d="${bell}" fill="${bellFill}"/>
    <path d="${bolt}" fill="${boltFill}"/>
    ${withDot ? `<circle cx="${clapper.cx}" cy="${clapper.cy}" r="${clapper.r}" fill="${dotFill}"/>` : ""}
  </g>`;
}

const gradient = `<defs><radialGradient id="g" cx="0.25" cy="0.12" r="1.1">
  <stop offset="0" stop-color="${PASTEL_HI}"/><stop offset="0.55" stop-color="${PASTEL}"/><stop offset="1" stop-color="${PASTEL_LO}"/>
</radialGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>`;

// Monochrome (Android themed icons) only uses alpha: bolt is cut out of the bell.
const mono = `<defs><mask id="m"><rect width="1024" height="1024" fill="white"/>
  <g transform="translate(512 500) scale(0.62) translate(-512 -500)"><path d="${bolt}" fill="black"/></g></mask></defs>
  <g mask="url(#m)">${mark({ bellFill: "#fff", boltFill: "#fff", dotFill: "#fff", scale: 0.62 })}</g>`;

const svgs: Record<string, [size: number, body: string]> = {
  "icon.png": [1024, gradient + mark({ bellFill: NAVY, boltFill: "#fff", dotFill: "#fff" })],
  "android-icon-background.png": [1024, gradient],
  // Adaptive icons are cropped to the centre ~66%, so the mark is scaled down.
  "android-icon-foreground.png": [1024, mark({ bellFill: NAVY, boltFill: "#fff", dotFill: "#fff", scale: 0.62 })],
  "android-icon-monochrome.png": [1024, mono],
  "splash-icon.png": [1024, mark({ bellFill: NAVY, boltFill: "#fff", dotFill: NAVY })],
  "splash-icon-dark.png": [1024, mark({ bellFill: PASTEL, boltFill: NAVY, dotFill: PASTEL })],
  "favicon.png": [48, gradient + mark({ bellFill: NAVY, boltFill: "#fff", dotFill: "#fff" })],
};

for (const [name, [size, body]] of Object.entries(svgs)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(`${OUT}/${name}`, png);
  console.log(name, size);
}
console.log("splash bg", LIGHT_BG, DARK_BG);
