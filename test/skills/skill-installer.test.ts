import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { SkillCatalogEntry, SkillFileMap } from "../../src/core/skills/skill-contracts.js";
import {
  getSkillStatus,
  installSkill,
  previewSkill,
  removeSkill,
  updateSkill
} from "../../src/core/skills/skill-installer.js";
import { useProjectHome } from "../helpers/home.js";

function entry(overrides: Partial<SkillCatalogEntry> = {}): SkillCatalogEntry {
  return {
    id: "demo-skill",
    name: "Demo Skill",
    description: "A demo skill used by installer tests.",
    source: {
      kind: "git",
      repo: "https://github.com/example/demo",
      ref: "a".repeat(40),
      path: "skills/demo-skill",
      licensePath: "LICENSE"
    },
    license: "MIT",
    version: "1.0.0",
    dependencies: [],
    compatibleAgents: ["opencode", "codex"],
    installPaths: {
      opencode: ".config/opencode/skills/demo-skill",
      codex: ".agents/skills/demo-skill"
    },
    updatePolicy: "pinned",
    stackTags: ["test"],
    ...overrides
  };
}

function files(): SkillFileMap {
  return new Map([
    ["SKILL.md", Buffer.from("---\nname: demo-skill\n---\n\n# Demo\n")],
    ["references/notes.md", Buffer.from("# Notes\n")],
    ["LICENSE", Buffer.from("MIT License\n")]
  ]);
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-skill-installer-"));
  const restoreHome = useProjectHome(root);
  return { root, restoreHome };
}

function options(catalogEntry: SkillCatalogEntry, fetcher: () => Promise<SkillFileMap> = async () => files()) {
  return { catalog: [catalogEntry], fetcher: async () => fetcher() };
}

test("preview is read-only and discloses source, license, dependencies, and target", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const demo = entry({ dependencies: [{ kind: "file", path: "prereq.txt", description: "Prerequisite file", required: true }] });
    const plan = await previewSkill(root, demo.id, "opencode", options(demo, async () => {
      throw new Error("preview must not fetch");
    }));
    assert.equal(plan.action, "install");
    assert.match(plan.targetPath, /\.config[\\/]opencode[\\/]skills[\\/]demo-skill$/);
    assert.equal(plan.repo, "https://github.com/example/demo");
    assert.equal(plan.license, "MIT");
    assert.equal(plan.network, true);
    assert.deepEqual(plan.missing, ["Prerequisite file"]);
    await assert.rejects(readFile(plan.targetPath, "utf8"), /ENOENT/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("install writes the pinned tree, records ownership, and reinstall is current", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const demo = entry();
    const installed = await installSkill(root, demo.id, "opencode", options(demo));
    assert.equal(installed.action, "installed");
    assert.equal(installed.fileCount, 3);
    assert.equal(await readFile(path.join(root, ".config", "opencode", "skills", "demo-skill", "SKILL.md"), "utf8"), "---\nname: demo-skill\n---\n\n# Demo\n");
    assert.equal(await readFile(path.join(root, ".config", "opencode", "skills", "demo-skill", "LICENSE"), "utf8"), "MIT License\n");
    assert.equal((await getSkillStatus(root, options(demo))).find((item) => item.agent === "opencode")?.state, "current");

    let fetches = 0;
    const again = await installSkill(root, demo.id, "opencode", options(demo, async () => {
      fetches += 1;
      return files();
    }));
    assert.equal(again.action, "already-current");
    assert.equal(fetches, 0);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("incompatible agents and missing dependencies refuse installation", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const openCodeOnly = entry({ compatibleAgents: ["opencode"] });
    const plan = await previewSkill(root, openCodeOnly.id, "codex", options(openCodeOnly));
    assert.equal(plan.action, "incompatible");
    await assert.rejects(installSkill(root, openCodeOnly.id, "codex", options(openCodeOnly)), /not compatible|incompatible/i);

    const needsFile = entry({ dependencies: [{ kind: "file", path: "prereq.txt", description: "Prerequisite file", required: true }] });
    await assert.rejects(installSkill(root, needsFile.id, "opencode", options(needsFile)), /Missing dependency/i);
    await writeFile(path.join(root, "prereq.txt"), "ready\n");
    assert.equal((await installSkill(root, needsFile.id, "opencode", options(needsFile))).action, "installed");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("an unowned same-id target is a conflict and is never overwritten", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const demo = entry();
    const target = path.join(root, ".config", "opencode", "skills", "demo-skill");
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "SKILL.md"), "user-owned\n");
    const plan = await previewSkill(root, demo.id, "opencode", options(demo));
    assert.equal(plan.action, "conflict");
    await assert.rejects(installSkill(root, demo.id, "opencode", options(demo)), /not managed|user-owned/i);
    assert.equal(await readFile(path.join(target, "SKILL.md"), "utf8"), "user-owned\n");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("modified managed content is refused until an explicit update restores it", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const demo = entry();
    await installSkill(root, demo.id, "codex", options(demo));
    const target = path.join(root, ".agents", "skills", "demo-skill");
    await writeFile(path.join(target, "SKILL.md"), "tampered\n");
    assert.equal((await getSkillStatus(root, options(demo))).find((item) => item.agent === "codex")?.state, "modified");
    assert.equal((await previewSkill(root, demo.id, "codex", options(demo))).action, "conflict");
    await assert.rejects(removeSkill(root, demo.id, "codex", options(demo)), /modified/i);

    assert.equal((await updateSkill(root, demo.id, "codex", options(demo))).action, "updated");
    assert.match(await readFile(path.join(target, "SKILL.md"), "utf8"), /# Demo/);
    assert.equal((await removeSkill(root, demo.id, "codex", options(demo))).action, "removed");
    assert.equal((await getSkillStatus(root, options(demo))).find((item) => item.agent === "codex")?.state, "absent");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("a catalog version change reports update-available and install updates the tree", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const first = entry();
    await installSkill(root, first.id, "opencode", options(first));
    const second = entry({ version: "1.1.0" });
    const plan = await previewSkill(root, second.id, "opencode", options(second));
    assert.equal(plan.action, "update");
    assert.equal((await getSkillStatus(root, options(second))).find((item) => item.agent === "opencode")?.state, "update-available");
    assert.equal((await installSkill(root, second.id, "opencode", options(second))).action, "updated");
    assert.equal((await getSkillStatus(root, options(second))).find((item) => item.agent === "opencode")?.state, "current");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("unsafe fetched paths and extra local files are rejected", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const demo = entry();
    const unsafe = options(demo, async () => new Map([["../escape.txt", Buffer.from("no\n")]]));
    await assert.rejects(installSkill(root, demo.id, "opencode", unsafe), /unsafe|escape|traversal/i);

    await installSkill(root, demo.id, "opencode", options(demo));
    await writeFile(path.join(root, ".config", "opencode", "skills", "demo-skill", "extra.txt"), "extra\n");
    assert.equal((await getSkillStatus(root, options(demo))).find((item) => item.agent === "opencode")?.state, "modified");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});
