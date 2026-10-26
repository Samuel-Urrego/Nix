# Security Policy

## Reporting a vulnerability

If you discover a security issue, please do not open a public issue with exploit details.

Until the public repository contact flow is finalized, treat security reporting as private maintainer communication.

When the repository is live, add a dedicated private reporting channel and update this document with:

- security contact address,
- expected response window,
- disclosure handling policy.

## Scope

Security reports are especially relevant for:

- orchestration behavior,
- provider integrations,
- memory persistence boundaries,
- execution and review flows,
- component, skill, MCP, and security-hook lifecycle behavior,
- release manifest generation and verification,
- any capability that can affect code execution or data exposure.

## Supported release scope

- Windows 10/11 is the only verified platform for v1.
- Node.js `>=20.11.0` is required.
- OpenCode and Codex are the only verified agents.
- Component and hook operations are project-local; there is no global installation mode.
- Security hooks are opt-in advisory safeguards, not a sandbox.
- Codex custom slash prompts are unsupported.

The full matrix is in [docs/support-matrix.md](docs/support-matrix.md).

## Release integrity

Nix generates a SHA-256 manifest for the built `dist/` tree. The manifest detects missing, modified, and extra files. It is **not** a signature: the project does not have signing key infrastructure, key custody, or a published trust root. Do not treat checksums as proof of authenticity.

Report a release-integrity issue if the manifest can be bypassed, a symlink or unsupported file is silently accepted, or verification reports success for changed content. See [docs/release.md](docs/release.md).

## Temporary status

This project is pre-release. Security processes are being established during the initial open-source setup.
