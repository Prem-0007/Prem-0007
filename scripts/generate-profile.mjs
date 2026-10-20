// Generates assets/public-builder-profile*.png from public GitHub data.
// Usage: GITHUB_TOKEN=... node scripts/generate-profile.mjs   (or add --mock to test offline)
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";

const USER = "Prem-0007";
const NAME = "Prem Kumar";
const TAGLINE = "Full-stack developer building web apps, AI/ML projects and security tools.";
const STACK = [
  ["Frontend", ["React", "Next.js", "TypeScript", "Tailwind", "Vite"]],
  ["Backend", ["Node.js", "Express", "PHP", "Prisma"]],
  ["Data", ["MongoDB", "MySQL", "PostgreSQL", "Firebase"]],
  ["AI/ML", ["Python", "scikit-learn", "FAISS", "XGBoost"]],
  ["Deploy", ["Vercel", "Render", "Netlify", "Git"]],
];
const MOCK = process.argv.includes("--mock");

const THEMES = {
  light: { bg: "#ffffff", card: "#f6f8fa", border: "#d0d7de", text: "#1f2328", muted: "#656d76", accent: "#8a2be2", accent2: "#0a7ea4" },
  dark: { bg: "#0d1117", card: "#161b22", border: "#30363d", text: "#e6edf3", muted: "#8b949e", accent: "#b57bff", accent2: "#00f7ff" },
};
const LANG_COLORS = ["#3178c6", "#f1e05a", "#b07219", "#3572a5", "#e34c26", "#563d7c", "#89e051", "#4f5d95"];

async function gql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function fetchData() {
  if (MOCK) {
    return {
      stars: 42, repos: 31, followers: 18, mergedPRs: 7, commits: 640,
      langs: [["JavaScript", 44], ["Python", 22], ["TypeScript", 18], ["Java", 9], ["PHP", 7]],
      top: [
        { name: "CollegeSphere", stars: 12, forks: 3, lang: "TypeScript" },
        { name: "phishshield-ai-omnikon2026", stars: 9, forks: 2, lang: "Python" },
        { name: "Inventory_Management_System", stars: 6, forks: 1, lang: "JavaScript" },
        { name: "FoodRush", stars: 5, forks: 1, lang: "JavaScript" },
      ],
      contribs: [["example-org/example-repo", 4], ["another/project", 2], ["some/library", 1]],
    };
  }
  const d = await gql(
    `query($login:String!, $q:String!){
      user(login:$login){
        followers{totalCount}
        contributionsCollection{totalCommitContributions}
        repositories(first:100, privacy:PUBLIC, ownerAffiliations:OWNER, isFork:false, orderBy:{field:STARGAZERS,direction:DESC}){
          totalCount
          nodes{name stargazerCount forkCount primaryLanguage{name}
            languages(first:5, orderBy:{field:SIZE,direction:DESC}){edges{size node{name}}}}
        }
      }
      search(query:$q, type:ISSUE, first:100){
        issueCount
        nodes{... on PullRequest{repository{nameWithOwner}}}
      }
    }`,
    { login: USER, q: `author:${USER} is:pr is:merged is:public -user:${USER}` }
  );
  const u = d.user;
  const bytes = {};
  for (const r of u.repositories.nodes)
    for (const e of r.languages.edges) bytes[e.node.name] = (bytes[e.node.name] || 0) + e.size;
  const total = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
  const langs = Object.entries(bytes).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([n, b]) => [n, Math.round((b / total) * 100)]);
  const cmap = {};
  for (const n of d.search.nodes) if (n.repository) cmap[n.repository.nameWithOwner] = (cmap[n.repository.nameWithOwner] || 0) + 1;
  return {
    stars: u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0),
    repos: u.repositories.totalCount,
    followers: u.followers.totalCount,
    mergedPRs: d.search.issueCount,
    commits: u.contributionsCollection.totalCommitContributions,
    langs,
    top: u.repositories.nodes.slice(0, 4).map((r) => ({ name: r.name, stars: r.stargazerCount, forks: r.forkCount, lang: r.primaryLanguage?.name || "" })),
    contribs: Object.entries(cmap).sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FONT = "DejaVu Sans, Helvetica, Arial, sans-serif";

function render(data, t, W) {
  const mobile = W < 800;
  const pad = mobile ? 24 : 40;
  const s = mobile ? 0.85 : 1;
  const inner = W - pad * 2;
  let y = pad;
  const out = [];
  const text = (x, yy, str, size, fill, weight = 400, anchor = "start") =>
    out.push(`<text x="${x}" y="${yy}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(str)}</text>`);
  const section = (title) => { y += 34; text(pad, y, title.toUpperCase(), 12 * s, t.muted, 700); y += 14; };

  // header
  text(pad, (y += 34 * s), NAME, 34 * s, t.text, 700);
  y += 26 * s;
  const tag = mobile ? "Full-stack developer · AI/ML · security tools" : TAGLINE;
  text(pad, y, tag, 15 * s, t.muted);
  y += 14;

  // stat tiles
  const tiles = [["Stars", data.stars], ["Repositories", data.repos], ["Followers", data.followers], ["Merged PRs", data.mergedPRs], ["Commits (yr)", data.commits]];
  const perRow = mobile ? 3 : 5, gap = 12;
  const tw = (inner - gap * (perRow - 1)) / perRow, th = 74 * s;
  y += 22;
  tiles.forEach(([label, val], i) => {
    const row = Math.floor(i / perRow), col = i % perRow;
    const x = pad + col * (tw + gap), yy = y + row * (th + gap);
    out.push(`<rect x="${x}" y="${yy}" width="${tw}" height="${th}" rx="10" fill="${t.card}" stroke="${t.border}"/>`);
    text(x + 16, yy + 34 * s, Number(val).toLocaleString("en-US"), 26 * s, t.accent, 700);
    text(x + 16, yy + 56 * s, label, 12 * s, t.muted);
  });
  y += Math.ceil(tiles.length / perRow) * (th + gap) - gap;

  // languages
  section("Top languages");
  let x = pad;
  data.langs.forEach(([n, pct], i) => {
    const w = (inner * pct) / Math.max(1, data.langs.reduce((a, l) => a + l[1], 0));
    out.push(`<rect x="${x}" y="${y}" width="${Math.max(w - 2, 2)}" height="10" rx="3" fill="${LANG_COLORS[i % LANG_COLORS.length]}"/>`);
    x += w;
  });
  y += 30;
  let lx = pad;
  data.langs.forEach(([n, pct], i) => {
    const label = `${n} ${pct}%`, w = label.length * 7.4 * s + 28;
    if (lx + w > W - pad) { lx = pad; y += 22; }
    out.push(`<circle cx="${lx + 5}" cy="${y - 4}" r="5" fill="${LANG_COLORS[i % LANG_COLORS.length]}"/>`);
    text(lx + 16, y, label, 13 * s, t.text);
    lx += w;
  });
  y += 6;

  // top repos
  section("Top repositories");
  y += 8;
  data.top.forEach((r) => {
    out.push(`<rect x="${pad}" y="${y}" width="${inner}" height="${48 * s}" rx="8" fill="${t.card}" stroke="${t.border}"/>`);
    text(pad + 16, y + 29 * s, r.name.length > (mobile ? 24 : 48) ? r.name.slice(0, mobile ? 23 : 47) + "…" : r.name, 15 * s, t.text, 700);
    text(W - pad - 16, y + 29 * s, `${r.lang ? r.lang + "   " : ""}★ ${r.stars}   ⑂ ${r.forks}`, 12.5 * s, t.muted, 400, "end");
    y += 58 * s;
  });
  y -= 10 * s;

  // contributions
  if (data.contribs.length) {
    section("Selected contributions (merged PRs)");
    y += 6;
    data.contribs.forEach(([repo, n]) => {
      y += 24;
      text(pad, y, repo, 14 * s, t.text);
      text(W - pad, y, `${n} merged`, 13 * s, t.accent2, 700, "end");
    });
  }

  // stack
  section("Tech stack");
  y += 6;
  for (const [group, items] of STACK) {
    y += 26 * s;
    text(pad, y, group, 13 * s, t.muted, 700);
    let px = pad + (mobile ? 70 : 90);
    for (const it of items) {
      const w = it.length * 7.6 * s + 22;
      if (px + w > W - pad) { px = pad + (mobile ? 70 : 90); y += 28 * s; }
      out.push(`<rect x="${px}" y="${y - 16 * s}" width="${w}" height="${24 * s}" rx="12" fill="${t.card}" stroke="${t.border}"/>`);
      text(px + w / 2, y, it, 12 * s, t.text, 400, "middle");
      px += w + 8;
    }
    y += 6;
  }

  const H = Math.ceil(y + pad);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" rx="14" fill="${t.bg}"/>
<rect width="${W}" height="5" rx="2" fill="${t.accent}"/>
${out.join("\n")}
</svg>`;
  return new Resvg(svg, { fitTo: { mode: "width", value: W * 2 }, font: { loadSystemFonts: true } }).render().asPng();
}

const data = await fetchData();
mkdirSync("assets", { recursive: true });
for (const [mode, t] of Object.entries(THEMES)) {
  const sfx = mode === "dark" ? "-dark" : "";
  writeFileSync(`assets/public-builder-profile${sfx}.png`, render(data, t, 1200));
  writeFileSync(`assets/public-builder-profile-mobile${sfx}.png`, render(data, t, 600));
}
console.log("Generated 4 images", MOCK ? "(mock data)" : "");
