---
name: cpp-stack
description: "Trigger: C++, CMake, vcpkg, Conan, GoogleTest, Catch2, Qt, Boost, Asio. Pick the C++ toolchain and verify it against the build files."
license: Apache-2.0
metadata:
  author: "Samuel Urrego"
  version: "1.0"
---

## Activation Contract

Use this skill for C++ work where the build system, dependency manager, standard version, or framework must be decided or validated before implementation.

## Hard Rules

- Read `CMakeLists.txt`, the preset/toolchain files, the C++ standard in use, and the dependency manager manifest before writing code.
- State the standard you target (C++17/20/23) and do not use an API the project's standard or compiler does not guarantee.
- Ownership is explicit: `std::unique_ptr` by default, `std::shared_ptr` only for genuinely shared lifetime, no raw owning pointers.
- No undefined behaviour shortcuts: no out-of-bounds arithmetic, no reading uninitialized memory, no data races. If a lock-free scheme is proposed, it needs a written memory-ordering argument.
- Do not introduce a second dependency manager into a project that already has one.

## Framework Map

| Need | Choose | Avoid when |
| --- | --- | --- |
| Build system | CMake with presets | The project already has Meson/Bazel and works |
| Dependency management | vcpkg (manifest mode) | The team standardizes on Conan |
| Unit and property tests | GoogleTest / Catch2 | The project has an established framework |
| Benchmarks | Google Benchmark | — |
| Networking / async I/O | Asio (standalone or Boost.Asio) | You only need blocking HTTP: a small client is simpler |
| Cross-platform GUI | Qt | The app is a game or needs raw GPU control: SDL or a game engine |
| Desktop app with native UI | Qt Widgets/QML | You need a single-binary minimal UI: consider a native toolkit |
| General utilities | Boost (only the needed libraries) | A standard-library equivalent exists |
| Logging / formatting | `spdlog` / `fmt` | The project already has an abstraction |
| Serialization | `nlohmann/json` or protobuf | The project already defines its wire format |

## Decision Gates

| Situation | Action |
| --- | --- |
| A new dependency is header-only | Prefer it over a compiled one only if compile time stays acceptable; measure instead of guessing. |
| An operation can fail | Return `std::optional`, `std::expected`, or a status type; exceptions follow the project's existing policy. |
| Concurrency is introduced | Document who owns each mutex/atomic and the ordering; add a stress test under a sanitizer. |
| Public ABI changes | Bump the library version and state the break explicitly. |

## Execution Steps

1. Read build files, presets, standard level, dependency manager, and test setup.
2. State the decision (build, dependency manager, framework) and the rejected alternative.
3. Implement with RAII, `const` correctness, and narrow interfaces.
4. Add tests beside the code; add one integration test if a public entry point changed.
5. Build through the project's presets, not with an ad-hoc compiler invocation.

## Verification

- Configure and build with the project's preset; run `ctest` (or the configured runner).
- For concurrency or parsing code, run the tests once with ASan/UBSan or TSan in a scratch build directory.
- Keep scratch build directories out of the repository; report their paths.

## Pitfalls

- Implicit narrowing conversions and `int`/`size_t` mixing in loops.
- Lifetime bugs from returning references to temporaries.
- `std::shared_ptr` used to avoid thinking about ownership.
- Vendored globals and `using namespace` in headers.
- Build flags that differ between the IDE and CI.
