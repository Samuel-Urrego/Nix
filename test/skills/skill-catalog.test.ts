import assert from "node:assert/strict";
import test from "node:test";

import { findSkillEntry, skillCatalog } from "../../src/core/skills/skill-catalog.js";

test("skill catalog declares the six requested skills with unique ids and install paths", () => {
  assert.deepEqual(
    skillCatalog.map((entry) => entry.id).sort(),
    ["accessibility", "brag", "design-taste-frontend", "emil-design-eng", "grafana-k6", "security-audit"]
  );
  assert.equal(new Set(skillCatalog.map((entry) => entry.id)).size, skillCatalog.length);
  for (const entry of skillCatalog) {
    assert.ok(entry.description.length > 20);
    assert.ok(entry.version.length > 0);
    assert.ok(entry.stackTags.length > 0);
    assert.equal(entry.updatePolicy, "pinned");
    assert.equal(entry.source.kind, "git");
    assert.match(entry.source.ref, /^[a-f0-9]{40}$/);
    assert.ok(entry.source.repo.startsWith("https://github.com/"));
    assert.ok(entry.source.path.length > 0);
    assert.equal(entry.installPaths.opencode, `.opencode/skills/${entry.id}`);
    assert.equal(entry.installPaths.codex, `.agents/skills/${entry.id}`);
  }
});

test("skill catalog records verified licenses and provenance", () => {
  const expected = [
    ["brag", "MIT", "latent-spaces/brag", "0.4.0"],
    ["grafana-k6", "Apache-2.0", "grafana/skills", "main@cc33318"],
    ["security-audit", "MIT", "cloudflare/security-audit-skill", "main@c1c8a8c"],
    ["emil-design-eng", "MIT", "emilkowalski/skills", "main@2d22863"],
    ["design-taste-frontend", "MIT", "Leonxlnx/taste-skill", "2.0.0-experimental"],
    ["accessibility", "MIT", "addyosmani/web-quality-skills", "2.0"]
  ] as const;
  for (const [id, license, repo, version] of expected) {
    const entry = findSkillEntry(id);
    assert.ok(entry, id);
    assert.equal(entry.license, license);
    assert.match(entry.source.repo, new RegExp(repo.replace("/", "\\/")));
    assert.equal(entry.version, version);
  }
});

test("skill catalog encodes agent compatibility and dependencies", () => {
  assert.deepEqual(findSkillEntry("security-audit")?.compatibleAgents, ["opencode"]);
  for (const id of ["brag", "grafana-k6", "emil-design-eng", "design-taste-frontend", "accessibility"]) {
    assert.deepEqual(findSkillEntry(id)?.compatibleAgents, ["opencode", "codex"]);
  }
  assert.ok(findSkillEntry("brag")?.dependencies.some((item) => item.name === "ffmpeg"));
  assert.ok(findSkillEntry("brag")?.dependencies.some((item) => item.name === "node"));
  assert.ok(findSkillEntry("grafana-k6")?.dependencies.some((item) => item.name === "k6"));
  assert.ok(findSkillEntry("design-taste-frontend")?.dependencies.some((item) => item.name === "chrome"));
  assert.equal(findSkillEntry("emil-design-eng")?.dependencies.length, 0);
});
