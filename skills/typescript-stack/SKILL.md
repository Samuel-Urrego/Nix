---
name: typescript-stack
description: "Trigger: TypeScript, Next.js, NestJS, tRPC, Zod, Prisma, Drizzle, tsup, tsconfig strict. Pick the TypeScript stack and keep the type surface honest."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract

Use this skill for typed JavaScript work where the framework, boundary validation, or build strategy must be decided or validated.

## Hard Rules

- Read `tsconfig.json` (strictness flags), `package.json`, and the lockfile before choosing APIs. Never weaken `strict` to make an error disappear.
- `any` and non-null assertions are last resorts; prefer `unknown` plus a narrowing guard.
- Types are not validation. Every external input (HTTP body, query string, env var, LLM output, third-party response) is validated at runtime with the project's schema library.
- Do not export types that mirror an internal implementation detail; publish the contract, not the internals.
- Generics must earn their place: two or more real instantiations, or a genuine constraint. Otherwise use a concrete type or a union.

## Framework Map

| Need | Choose | Avoid when |
| --- | --- | --- |
| Full-stack React with SSR/SSG | Next.js | The deliverable is a pure SPA: Vite + React is leaner |
| SPA with typed API | Vite + React + TanStack Query | The app is mostly static: a static site generator is cheaper |
| Backend with structure and DI | NestJS | The service is small and would drown in decorators |
| Typed client/server contract without REST drift | tRPC (inside a TypeScript-only stack) | A non-TypeScript consumer exists |
| Runtime validation | Zod | The project already standardizes on another schema library |
| ORM with migrations | Prisma | You need hand-written SQL-first control: Drizzle |
| SQL-first typed queries | Drizzle | The team wants generated client ergonomics |
| Library build | tsup or `tsc` | The project already has a bundler |
| Tests | Vitest | Jest is already configured and works |
| E2E | Playwright | — |

## Decision Gates

| Situation | Action |
| --- | --- |
| A `catch` block receives `unknown` | Narrow it explicitly; never assume `Error`. |
| A config object comes from the environment | Parse it once at startup with a schema, then pass the parsed type. |
| A type assertion is proposed | Prove the runtime check exists, or replace the assertion with a parser. |
| An API type changes | Update the schema and the test that pins the contract in the same commit. |

## Execution Steps

1. Read `tsconfig.json`, package scripts, lockfile, and the existing schema/validation layer.
2. State the decision (framework, ORM, validation) and the rejected alternative.
3. Implement with `unknown` at boundaries and narrowed types inside.
4. Add unit tests beside the module and one integration test through the public entry point.
5. Run `tsc --noEmit`, the linter, and the tests.

## Verification

- `tsc --noEmit` clean, lint clean, tests green, build clean.
- For schema changes, verify both a valid and an invalid payload through the public interface.

## Pitfalls

- `as` used to silence a real mismatch.
- Optional fields that are actually required at runtime.
- `ts-ignore`/`ts-expect-error` without an issue reference.
- Types duplicated between client and server and drifting.
- Enums where a union of literals is enough.
