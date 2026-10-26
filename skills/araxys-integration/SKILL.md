---
name: araxys-integration
description: "Trigger: Araxys, AraxysShield, AraxysConfig, FastAPI security integration. Integrate the installed Araxys library into a consuming application only."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract

Use this skill when adding, configuring, or troubleshooting Araxys in an application that consumes the library.

## Hard Rules

- Work only in the consuming application. Never create, edit, or commit files in the Araxys library repository.
- Verify the consumer's declared and installed Araxys version before recommending APIs.
- Confirm every import against that version's public exports and matching documentation or examples; do not assume the latest README applies.
- Report suspected Araxys defects or missing capabilities to the user with reproducible evidence instead of patching the library.

## Decision Gates

| Situation | Action |
| --- | --- |
| Declared and installed versions differ | Stop API changes and report the mismatch. |
| A symbol is not publicly exported by the installed version | Do not import it; find a supported public interface or ask the user. |
| The fix appears to require changing Araxys itself | Stop and present the evidence to the user. |

## Execution Steps

1. Identify the consuming application root and inspect its dependency source and environment.
2. Verify the installed package version and inspect its public exports, version-matched docs, examples, and relevant tests.
3. Plan the smallest consumer-only integration using confirmed public APIs.
4. Add or adjust consumer tests that exercise the integration through its public interface.
5. Run focused checks and report the exact version and evidence used.

## Output Contract

State the consumer project, installed Araxys version, confirmed APIs, files changed, checks run, and any library-side issue left for the user.

## References

- `agents/araxys-specialist.md` — matching specialist role and library-boundary contract.
