---
name: css-stack
description: "Trigger: CSS, Tailwind, Bootstrap, Sass, PostCSS, CSS Modules, design tokens, container queries. Pick the CSS strategy and verify it against the build pipeline."
license: Apache-2.0
metadata:
  author: "Samuel Urrego"
  version: "1.0"
---

## Activation Contract

Use this skill for styling work where the approach must be decided or validated: utility framework vs component CSS, tokens, theming, responsive strategy, and the build pipeline that produces the final stylesheet.

## Hard Rules

- Read the build configuration (Vite/webpack/PostCSS/Tailwind config) and the existing global stylesheet before adding a new styling system.
- One styling strategy per app. Do not mix Tailwind utilities, Bootstrap components and hand-written BEM for the same surface.
- Design tokens (color, spacing, radius, typography) live in one place and every surface consumes them; no hardcoded hex values scattered across components.
- Accessibility is part of the style contract: visible focus, sufficient contrast, and no motion that ignores `prefers-reduced-motion`.
- No `!important` to win a specificity fight. If it is needed, the cascade is the problem.

## Framework Map

| Need | Choose | Avoid when |
| --- | --- | --- |
| Custom design, fast iteration, consistent spacing | Tailwind CSS | The team will not adopt utility classes and rewrites them as components anyway |
| Admin or internal tool with ready components | Bootstrap | The product needs a bespoke visual identity |
| Small semantic framework, low coupling | Bulma | You need a large component library with JavaScript behavior |
| Variables, nesting, mixins, math | Sass (SCSS) | The build already has native nesting and custom properties and the team prefers them |
| Modern transformations, future CSS syntax | PostCSS (with explicit plugins) | The toolchain already has an equivalent step |
| Component-scoped class names | CSS Modules | The project uses a utility framework as its primary strategy |
| Type-safe styling with tokens | vanilla-extract | The team wants zero extra build steps |
| Themeable variables without a build step | Native custom properties + `@layer` | You need computed color functions the browser does not support yet |

## Decision Gates

| Situation | Action |
| --- | --- |
| A component needs one small override | Use an existing token or a modifier class; do not add a new stylesheet. |
| Layout must adapt to container width, not viewport | Use container queries (`@container`) with a named container. |
| A color is missing | Add a token; do not inline the color. |
| A stylesheet grows past a component's scope | Split by component, not by property. |

## Execution Steps

1. Read the styling pipeline, tokens, and one existing component to learn the house pattern.
2. State the strategy and the rejected alternative in one line.
3. Implement with tokens, responsive behavior at named breakpoints, and focus states.
4. Verify in a real browser at mobile, tablet, and desktop widths, including keyboard focus and reduced motion.
5. Check that the production build emits the expected stylesheet size.

## Verification

- Build the app and inspect the produced CSS for duplicates and unused rules.
- Keyboard-navigate the changed surface; confirm focus is visible and contrast passes.
- Confirm no horizontal scroll at 320px width.

## Pitfalls

- Specificity escalation instead of a token or a modifier.
- `rem` mixed with `px` for the same scale.
- Dark mode implemented as a second stylesheet that drifts.
- Animations that ignore reduced motion.
- Utility classes generated dynamically so the build cannot detect them.
