import type { SkillCatalogEntry } from "./skill-contracts.js";

function installPaths(id: string) {
  return {
    opencode: `.opencode/skills/${id}`,
    codex: `.agents/skills/${id}`
  } as const;
}

/**
 * Requested skills with truthful upstream or bundled-package provenance.
 * Git refs are pinned commit SHAs; advance them only through a reviewed catalog change.
 */
export const skillCatalog: ReadonlyArray<SkillCatalogEntry> = [
  {
    id: "brag",
    name: "Brag",
    description: "Turn the current project into a short, polished, shareable launch video using Hyperframes.",
    source: {
      kind: "git",
      repo: "https://github.com/latent-spaces/brag",
      ref: "069432cac935ed1895859df201c31436c07fb74e",
      path: "skills/brag",
      licensePath: "LICENSE"
    },
    license: "MIT",
    version: "0.4.0",
    dependencies: [
      { kind: "runtime", name: "node", description: "Node.js 22 or newer", required: true },
      { kind: "command", name: "ffmpeg", description: "FFmpeg on PATH for video rendering", required: true },
      { kind: "command", name: "npx", description: "npx for the Hyperframes CLI", required: true },
      { kind: "command", name: "uv", description: "uv for custom music cue analysis", required: false }
    ],
    compatibleAgents: ["opencode", "codex"],
    installPaths: installPaths("brag"),
    updatePolicy: "pinned",
    stackTags: ["frontend", "marketing", "video"]
  },
  {
    id: "grafana-k6",
    name: "Grafana k6",
    description: "Generate, validate, and review k6 load, stress, spike, soak, and browser test scripts.",
    source: {
      kind: "git",
      repo: "https://github.com/grafana/skills",
      ref: "cc33318b60a7fbc2c69a25122164baf00e805f79",
      path: "skills/grafana-k6/k6",
      licensePath: "LICENSE"
    },
    license: "Apache-2.0",
    version: "main@cc33318",
    dependencies: [
      { kind: "command", name: "k6", description: "k6 v2.0 or newer on PATH", required: true }
    ],
    compatibleAgents: ["opencode", "codex"],
    installPaths: installPaths("grafana-k6"),
    updatePolicy: "pinned",
    stackTags: ["testing", "performance", "backend"]
  },
  {
    id: "security-audit",
    name: "Cloudflare Security Audit",
    description: "Run a coverage-led security audit with isolated hunters, adversarial validation, and verified findings.",
    source: {
      kind: "git",
      repo: "https://github.com/cloudflare/security-audit-skill",
      ref: "c1c8a8c1471069fb0e188eeaff69b8e8db6564a8",
      path: "skills/security-audit",
      licensePath: "LICENSE"
    },
    license: "MIT",
    version: "main@c1c8a8c",
    dependencies: [
      { kind: "runtime", name: "node", description: "Node.js for the findings and coverage validators", required: true }
    ],
    compatibleAgents: ["opencode", "codex"],
    installPaths: installPaths("security-audit"),
    updatePolicy: "pinned",
    stackTags: ["security", "review", "backend", "mcp"]
  },
  {
    id: "emil-design-eng",
    name: "Emil Kowalski Design Engineering",
    description: "Apply Emil Kowalski's design engineering rules for UI polish, animation decisions, and component feel.",
    source: {
      kind: "git",
      repo: "https://github.com/emilkowalski/skills",
      ref: "2d228630ba1446365f614a108cb8252f1feda202",
      path: "skills/emil-design-eng",
      licensePath: "LICENSE"
    },
    license: "MIT",
    version: "main@2d22863",
    dependencies: [],
    compatibleAgents: ["opencode", "codex"],
    installPaths: installPaths("emil-design-eng"),
    updatePolicy: "pinned",
    stackTags: ["frontend", "design", "react", "astro"]
  },
  {
    id: "design-taste-frontend",
    name: "Taste",
    description: "Give coding agents art direction, reference imagery, and a browser check to avoid generic AI frontend design.",
    source: {
      kind: "git",
      repo: "https://github.com/Leonxlnx/taste-skill",
      ref: "6010f91a9935f1c167dfc500fb1a475681892e6b",
      path: "skills/taste-skill",
      licensePath: "LICENSE"
    },
    license: "MIT",
    version: "2.0.0-experimental",
    dependencies: [
      { kind: "runtime", name: "node", description: "Node.js 22 or newer", required: true },
      { kind: "runtime", name: "chrome", description: "Chrome, Edge, or Chromium for the browser check", required: true },
      { kind: "network", name: "image-search", description: "Network access to find reference images", required: false }
    ],
    compatibleAgents: ["opencode", "codex"],
    installPaths: installPaths("design-taste-frontend"),
    updatePolicy: "pinned",
    stackTags: ["frontend", "design", "react", "astro"]
  },
  {
    id: "rea",
    name: "Reverse Engineer Anything",
    description: "Investigate shipped applications, binaries, and runtime behavior with evidence-backed reverse-engineering workflows.",
    source: {
      kind: "git",
      repo: "https://github.com/morluto/rea",
      ref: "160d821ac9a0310afcb8d1fc427862dd6508add5",
      path: ".agents/skills/reverse-engineer-anything",
      licensePath: "LICENSE"
    },
    license: "MIT",
    version: "6.8.0",
    dependencies: [
      { kind: "runtime", name: "node", description: "Node.js 22.23.4+, 24.22.1+, or 26.12.1+", required: true },
      { kind: "command", name: "npm", description: "npm to install or run the REA MCP package", required: true }
    ],
    compatibleAgents: ["opencode", "codex"],
    installPaths: installPaths("rea"),
    updatePolicy: "pinned",
    stackTags: ["reverse-engineering", "security", "binary-analysis", "mcp"]
  },
  {
    id: "accessibility",
    name: "Accessibility",
    description: "Audit and improve web accessibility following WCAG 2.2 guidelines.",
    source: {
      kind: "git",
      repo: "https://github.com/addyosmani/web-quality-skills",
      ref: "afa8da942115f2961fdbfa80807ea0b232ff6c00",
      path: "skills/accessibility",
      licensePath: "LICENSE"
    },
    license: "MIT",
    version: "2.0",
    dependencies: [
      { kind: "command", name: "lighthouse", description: "Lighthouse CLI for automated audits", required: false },
      { kind: "command", name: "npx", description: "npx for Lighthouse or axe", required: false }
    ],
    compatibleAgents: ["opencode", "codex"],
    installPaths: installPaths("accessibility"),
    updatePolicy: "pinned",
    stackTags: ["frontend", "accessibility", "review"]
  },
  {
    id: "python-fastapi",
    name: "Python and FastAPI",
    description: "Build async FastAPI APIs with explicit Pydantic validation, uv, and pytest conventions.",
    source: { kind: "bundled", path: "skills/python-fastapi" },
    license: "Apache-2.0",
    version: "1.0.0",
    dependencies: [],
    compatibleAgents: ["opencode", "codex"],
    installPaths: installPaths("python-fastapi"),
    updatePolicy: "pinned",
    stackTags: ["backend", "python", "fastapi", "testing"]
  },
  {
    id: "araxys-integration",
    name: "Araxys Integration",
    description: "Integrate the installed Araxys security library into consuming FastAPI applications without modifying Araxys.",
    source: { kind: "bundled", path: "skills/araxys-integration" },
    license: "Apache-2.0",
    version: "1.0.0",
    dependencies: [],
    compatibleAgents: ["opencode", "codex"],
    installPaths: installPaths("araxys-integration"),
    updatePolicy: "pinned",
    stackTags: ["backend", "python", "fastapi", "security"]
  }
];

export function findSkillEntry(id: string): SkillCatalogEntry | undefined {
  return skillCatalog.find((entry) => entry.id === id);
}
