import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const drawer = readFileSync(
  join(process.cwd(), "src/components/layout/navigation-drawer.tsx"),
  "utf8",
);

describe("mobile and contrast CSS invariants", () => {
  it("frames section headings that sit directly on the red shell", () => {
    expect(css).toContain(".section-stack:not(.content-panel) > .section-heading {");
    expect(css).toMatch(
      /\.section-stack:not\(\.content-panel\) > \.section-heading \{[\s\S]*?background: var\(--paper\);[\s\S]*?color: var\(--ink\);/,
    );
  });

  it("renders heading actions as accessible dark touch targets", () => {
    expect(css).toMatch(
      /\.section-stack:not\(\.content-panel\) > \.section-heading \.text-link,[\s\S]*?min-height: 44px;[\s\S]*?background: var\(--ink\);[\s\S]*?color: white;/,
    );
  });

  it("keeps red-device and dark-screen labels legible", () => {
    expect(css).toMatch(/\.device-panel \.eyebrow \{\s*color: #fff1f3;\s*\}/);
    expect(css).toMatch(/\.screen-panel \.eyebrow \{\s*color: var\(--lime\);\s*\}/);
    expect(css).toMatch(/\.partner-feature \.eyebrow,[\s\S]*?color: var\(--lime\);/);
  });

  it("preserves mobile safe areas and a compact 390px layout", () => {
    expect(css).toMatch(/body \{\s*min-width: 0;/);
    expect(css).toContain("calc(7px + env(safe-area-inset-bottom))");
    expect(css).toMatch(
      /@media \(max-width: 430px\) \{[\s\S]*?\.page-shell \{[\s\S]*?100% - 16px[\s\S]*?\.search-console \{[\s\S]*?grid-template-columns: auto minmax\(0, 1fr\);/,
    );
  });

  it("keeps the mobile scanner action at least 44px high", () => {
    expect(css).toMatch(/\.search-console \.button \{\s*min-height: 46px;/);
  });

  it("keeps the contest winners modal inside iPhone safe areas without horizontal overflow", () => {
    expect(css).toMatch(
      /\.contest-hall-modal \{[\s\S]*?safe-area-inset-top[\s\S]*?safe-area-inset-right[\s\S]*?safe-area-inset-bottom[\s\S]*?safe-area-inset-left/,
    );
    expect(css).toMatch(
      /\.contest-hall-modal__content \{[\s\S]*?overflow-x: hidden;[\s\S]*?overflow-y: auto;/,
    );
    expect(css).toMatch(/\.contest-hall-modal__close \{[\s\S]*?width: 48px;[\s\S]*?height: 48px;/);
  });

  it("clips the closed drawer so it cannot create horizontal mobile scrolling", () => {
    expect(css).toMatch(/\.nav-drawer \{[\s\S]*?inset: 0;[\s\S]*?overflow: hidden;/);
    expect(css).toMatch(/\.bottom-nav__inner \{[\s\S]*?repeat\(7, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(
      /\.nav-drawer__panel \{[\s\S]*?padding:[\s\S]*?var\(--bottom-nav-height\)[\s\S]*?env\(safe-area-inset-bottom\)[\s\S]*?scroll-padding-bottom:/,
    );
    const topbarBlock = css.match(/\.topbar \{([\s\S]*?)\}/)?.[1] ?? "";
    expect(topbarBlock).not.toContain("backdrop-filter");
  });

  it("keeps Settings as the last admin destination and scrollable above the bottom bar", () => {
    const administration = drawer.slice(drawer.indexOf("const administrationLinks"));
    expect(administration.indexOf('label: "Paramètres"')).toBeGreaterThan(
      administration.indexOf('label: "Journal"'),
    );
    expect(css).toMatch(
      /\.nav-drawer__panel \{[\s\S]*?height: 100dvh;[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior: contain;/,
    );
  });
});
