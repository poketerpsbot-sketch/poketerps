import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const output = join(process.cwd(), "public", "badges", "v2");

const badges = [
  [
    "role-editor",
    "Rédaction",
    "uncommon",
    `<path d="M86 167l16-49 54-54 34 34-54 54-50 15z"/><path d="M104 119l32 32M151 69l34 34"/><path d="M62 65h70M62 88h45M61 188h124"/>`,
  ],
  [
    "trainer-of-the-week",
    "Dresseur de la semaine",
    "rare",
    `<rect x="67" y="69" width="122" height="118" rx="18"/><path d="M68 104h120M94 54v31M163 54v31M138 116l-26 35h24l-17 34 42-47h-25z"/>`,
  ],
  [
    "trainer-of-the-month",
    "Dresseur du mois",
    "epic",
    `<path d="M157 62a58 58 0 1 0 30 100 68 68 0 0 1-30-100z"/><path d="M74 166c-17-14-26-31-27-52M182 176c19-15 28-35 28-57M58 93l-15-8M198 95l16-8"/>`,
  ],
  [
    "capture-streak",
    "Série de captures",
    "rare",
    `<path d="M128 48c17 31-6 40 11 61 11-15 18-24 15-42 30 29 43 58 32 89-9 27-31 42-58 42s-52-19-58-47c-5-27 7-52 34-78-3 21 4 31 13 42 16-21-1-36 11-67z"/><path d="M107 172c0-18 11-29 22-42 12 15 22 26 20 42"/>`,
  ],
  [
    "top-trainer",
    "Top Dresseur",
    "legendary",
    `<path d="M48 194h160M67 194v-43h38v43M105 194v-82h46v82M151 194v-58h38v58"/><circle cx="128" cy="76" r="27"/><circle cx="128" cy="76" r="9"/><path d="M93 105C72 91 65 72 67 51M163 105c21-14 28-33 26-54M68 64l-17-9M188 64l17-9"/>`,
  ],
  [
    "historic-contributor",
    "Contributeur historique",
    "epic",
    `<path d="M65 62h126v142H65zM86 82h84v35H86zM86 136h84v47H86z"/><path d="M107 136v47M149 136v47M128 93v13M128 148v23M48 81h17M191 81h17"/>`,
  ],
  [
    "first-review",
    "Premier avis",
    "common",
    `<path d="M57 70h142v96H116l-38 28 8-28H57z"/><path d="M128 88l11 22 25 4-18 17 4 25-22-12-22 12 4-25-18-17 25-4z"/>`,
  ],
  [
    "captures-10",
    "10 captures",
    "uncommon",
    `<rect x="58" y="79" width="94" height="112" rx="9" transform="rotate(-9 58 79)"/><rect x="104" y="66" width="94" height="112" rx="9" transform="rotate(9 104 66)"/><path d="M104 113h50M104 132h38M105 151h27"/>`,
  ],
  [
    "captures-50",
    "50 captures",
    "rare",
    `<circle cx="128" cy="128" r="70"/><circle cx="128" cy="128" r="45"/><circle cx="128" cy="128" r="13"/><path d="M128 42v35M128 179v35M42 128h35M179 128h35M128 128l48-27"/>`,
  ],
  [
    "captures-100",
    "100 captures",
    "legendary",
    `<path d="M128 42l27 21 34-2 10 33 28 20-13 32 4 34-34 7-23 26-30-17-33 12-18-29-33-12 1-35-18-29 25-24 6-34 35 2z"/><circle cx="128" cy="128" r="52"/><path d="M95 132l21 21 48-55M128 55v20M128 181v20"/>`,
  ],
  [
    "contest-winner",
    "Gagnant de concours",
    "epic",
    `<path d="M83 71h90v45c0 33-18 55-45 65-27-10-45-32-45-65V71zM83 87H51c1 30 13 47 39 51M173 87h32c-1 30-13 47-39 51"/><path d="M128 88l9 18 20 3-14 14 3 20-18-10-18 10 3-20-14-14 20-3zM104 196h48"/>`,
  ],
  [
    "level-1",
    "Niveau 1",
    "common",
    `<circle cx="128" cy="128" r="61"/><circle cx="128" cy="128" r="23"/><path d="M128 67v38M128 151v38M67 128h38M151 128h38"/>`,
  ],
  [
    "level-5",
    "Niveau 5",
    "uncommon",
    `<path d="M128 47l24 51 57 8-41 40 10 57-50-27-50 27 10-57-41-40 57-8z"/><circle cx="128" cy="128" r="24"/><path d="M46 161l31-4M210 161l-31-4"/>`,
  ],
  [
    "level-10",
    "Niveau 10",
    "rare",
    `<circle cx="128" cy="128" r="77"/><circle cx="128" cy="128" r="56"/><path d="M128 51v77l54-36M53 147l75-19 38 55M86 74l42 54"/><circle cx="128" cy="128" r="12"/>`,
  ],
  [
    "level-15",
    "Niveau 15",
    "legendary",
    `<path d="M64 199V88l64-42 64 42v111M84 199V99l44-29 44 29v100"/><path d="M105 199v-61h46v61M128 82l10 21 23 3-17 16 4 23-20-11-20 11 4-23-17-16 23-3zM45 199h166"/>`,
  ],
  [
    "partner",
    "Partenaire",
    "rare",
    `<path d="M46 117l35-35 43 12 17-12 69 43-33 48-34-3-20 20-28-21-24-1-25-51z"/><path d="M87 109l35 28c9 7 20 5 27-4l12-15M91 151l18-19M110 169l18-20M145 170l-25-20"/>`,
  ],
];

const frames = {
  common: `<circle cx="128" cy="128" r="106"/>`,
  uncommon: `<path d="M128 20l91 54v108l-91 54-91-54V74z"/>`,
  rare: `<path d="M128 18l83 39 17 90-58 73H86l-58-73 17-90z"/>`,
  epic: `<path d="M128 16l28 30 40-4 13 38 35 20-15 37 15 37-35 20-13 38-40-4-28 30-28-30-40 4-13-38-35-20 15-37-15-37 35-20 13-38 40 4z"/>`,
  legendary: `<path d="M128 12l26 24 35-10 12 34 35 8-7 35 27 25-27 25 7 35-35 8-12 34-35-10-26 24-26-24-35 10-12-34-35-8 7-35-27-25 27-25-7-35 35-8 12-34 35 10z"/>`,
};

function asset(slug, title, rarity, symbol) {
  const accent = rarity === "legendary" ? "#f4b942" : rarity === "epic" ? "#ff756b" : "#e51d3d";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="title"><title id="title">${title}</title><defs><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff8e8"/><stop offset="1" stop-color="#cbbda8"/></linearGradient><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="3" flood-color="#111" flood-opacity=".4"/></filter></defs><g filter="url(#shadow)" stroke="#171918" stroke-width="9" stroke-linejoin="round" fill="url(#metal)">${frames[rarity]}</g><g fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">${symbol}</g><g fill="none" stroke="#171918" stroke-width="3" opacity=".34"><circle cx="128" cy="128" r="92" stroke-dasharray="3 11"/></g></svg>`;
}

await mkdir(output, { recursive: true });
for (const badge of badges) {
  await writeFile(join(output, `${badge[0]}.svg`), asset(...badge), "utf8");
}
console.log(`Generated ${badges.length} badge assets in ${output}`);
