# Project memory

## Product intent & audience

- Eyewear try-on web app.
- Core features: frame catalog, lens configurator, 3D try-on.
- Audience: online eyewear shoppers (exact segment unspecified).

## Brand personality & voice

- Not yet defined.

## Visual design & UX direction

- No explicit direction provided yet.
- 3D try-on implies WebGL/Three.js or similar rendering layer likely present.

## Decisions, constraints & rationale

- Stack: Vite + React.
- Package manager: Bun (`bun.lock` present). npm install fails due to a known peer-resolution bug; use bun instead.
- Production build verified passing.
- Dev server runs automatically in the Bolt environment; no manual launch needed.

## Open questions & assumptions

- Brand voice and visual identity undefined.
- Target audience specifics and price positioning unknown.
- 3D try-on technology choice (library/approach) unconfirmed.
- Accessibility and responsive requirements not yet specified.