import assert from "node:assert/strict";
import test from "node:test";

import { compareVersions, formatVersion, parseVersion, satisfiesRange } from "../../src/core/mcp/version-range.js";

test("a version is read from command output", () => {
  assert.deepEqual(parseVersion("v26.13.0"), { major: 26, minor: 13, patch: 0 });
  assert.deepEqual(parseVersion("node v24.22.1 build 123"), { major: 24, minor: 22, patch: 1 });
  assert.equal(parseVersion("no version here"), undefined);
  assert.equal(formatVersion({ major: 26, minor: 13, patch: 0 }), "26.13.0");
});

test("versions compare by major, then minor, then patch", () => {
  assert.ok(compareVersions({ major: 26, minor: 13, patch: 0 }, { major: 26, minor: 10, patch: 0 }) > 0);
  assert.ok(compareVersions({ major: 24, minor: 22, patch: 1 }, { major: 26, minor: 10, patch: 0 }) < 0);
  assert.equal(compareVersions({ major: 1, minor: 2, patch: 3 }, { major: 1, minor: 2, patch: 3 }), 0);
});

test("the rea-agents range accepts exactly the runtimes it declares", () => {
  const range = "^22.23.4 || ^24.22.1 || >=26.12.1";
  const accepted = ["22.23.4", "22.24.0", "24.22.1", "24.30.0", "26.12.1", "26.13.0", "30.0.0"];
  const rejected = ["22.23.3", "22.22.0", "23.5.0", "24.22.0", "25.9.9", "26.10.0", "26.12.0"];

  for (const version of accepted) {
    assert.ok(satisfiesRange(parseVersion(version)!, range), `${version} must satisfy ${range}`);
  }
  for (const version of rejected) {
    assert.ok(!satisfiesRange(parseVersion(version)!, range), `${version} must NOT satisfy ${range}`);
  }
});

test("comparators, caret bounds and wildcards behave like npm ranges", () => {
  const at = (text: string) => parseVersion(text)!;
  assert.ok(satisfiesRange(at("1.2.3"), ">=1.2.3"));
  assert.ok(!satisfiesRange(at("1.2.2"), ">=1.2.3"));
  assert.ok(satisfiesRange(at("1.2.3"), ">1.2.2 <2.0.0"));
  assert.ok(!satisfiesRange(at("2.0.0"), ">1.2.2 <2.0.0"));
  assert.ok(satisfiesRange(at("1.9.9"), "^1.2.3"));
  assert.ok(!satisfiesRange(at("2.0.0"), "^1.2.3"));
  assert.ok(satisfiesRange(at("0.2.9"), "^0.2.3"));
  assert.ok(!satisfiesRange(at("0.3.0"), "^0.2.3"));
  assert.ok(satisfiesRange(at("0.0.3"), "^0.0.3"));
  assert.ok(!satisfiesRange(at("0.0.4"), "^0.0.3"));
  assert.ok(satisfiesRange(at("26.10.0"), "26.x"));
  assert.ok(!satisfiesRange(at("25.10.0"), "26.x"));
  assert.ok(satisfiesRange(at("26.10.0"), "=26"));
  assert.ok(!satisfiesRange(at("26.10.0"), "not-a-range"));
  assert.ok(!satisfiesRange(at("26.10.0"), ""));
});
