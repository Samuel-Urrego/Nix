---
name: javascript-stack
description: "Trigger: JavaScript, React, Vue, Svelte, Angular, Express, Fastify, Nest, Vite, Vitest, Playwright. Pick the JavaScript stack and verify it against package.json."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract

Use this skill for plain JavaScript projects where the runtime, framework, bundler, or test strategy must be decided or validated. For typed projects, `typescript-stack` is the deeper authority.

## Hard Rules

- Read `package.json`, the lockfile, the Node engine pin, and the existing build and test scripts first.
- Do not add a dependency that duplicates one already installed for the same job.
- Modules are explicit: keep the project's module system (ESM or CJS) instead of mixing both in one package.
- Async errors are handled: no floating promises, no `async` callback passed to an API that ignores its result.
- Browser code never trusts input; server code never trusts the browser.

## Framework Map

| Need | Choose | Avoid when |
| --- | --- | --- |
| SPA with the largest ecosystem | React | The team wants smaller runtime and compiled reactivity: Svelte |
| Progressive framework with fine-grained reactivity | Vue | You need React's ecosystem breadth and hiring pool |
| Compiled, minimal runtime | Svelte / SvelteKit | You need a large existing component library |
| Enterprise-scale SPA with strong conventions | Angular | The app is small and the ceremony would dominate |
| HTTP API, minimal | Fastify | You need the middleware ecosystem and familiarity of Express |
| HTTP API, most familiar | Express | You need schema-first validation and speed out of the box |
| Structured server app with DI | NestJS | The service is small and DI would be indirection |
| Build tool | Vite | The project already has a working bundler |
| Unit tests | Vitest | The project already standardizes on Jest and works |
| End-to-end | Playwright | — |
| Validation | Zod (or the project's existing schema library) | — |

## Decision Gates

| Situation | Action |
| --- | --- |
| A component needs shared state | Lift it to the nearest common parent or the project's existing store; do not add a state library for one value. |
| Data fetching is repeated | Use the project's existing fetching layer; if none exists, add the smallest one that covers the case. |
| A dependency is only for a tiny helper | Write the helper. |
| Behaviour changes in an API handler | Pin status, body, and error shape with a test through the HTTP surface. |

## Execution Steps

1. Read `package.json`, scripts, engine pin, and the existing folder conventions.
2. State the decision (framework, bundler, tests) and the rejected alternative.
3. Implement in small modules with named exports and explicit error paths.
4. Add tests beside the module; one integration test through the public entry point.
5. Run the project's scripts, not ad-hoc commands.

## Verification

- `npm test` (or the project's runner), the linter, and the build script.
- For UI changes, verify the real browser path and keyboard access.
- For server changes, assert the response contract, including failures.

## Pitfalls

- `==` instead of `===`, and truthiness checks on `0` or `""`.
- Floating promises that reject silently.
- Deep-cloning state to avoid thinking about mutation.
- Lockfile changes without a dependency change.
- Tests that assert implementation details instead of observable behavior.
