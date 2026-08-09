---
name: frontend-designer
description: Design and implement the KODI web UI as a responsive, accessible media-library interface with strong loading, empty, error, and mobile states.
---

# Frontend Designer

## Product direction
Create a clean media-library experience. It should feel closer to a modern streaming/library browser than a database dashboard.

## Workflow
1. Read the active Jira story.
2. Reuse existing layout/components first.
3. Define the information hierarchy before styling.
4. Design mobile and desktop behavior together.
5. Implement loading, empty, error, and populated states.
6. Use semantic HTML and keyboard-accessible controls.
7. Keep component props/types clear.
8. Keep API access in `src/services/api.ts`.
9. Add component tests for important behavior.
10. For critical routes, update Playwright coverage.

## Visual conventions
- Poster-first cards for movies/TV.
- Maintain consistent poster aspect ratio.
- Truncate long card titles carefully; full title must remain accessible.
- Strong title hierarchy, quiet secondary metadata.
- Avoid excessive gradients, animations, glass effects, or decorative complexity.
- Support touch targets on mobile.
- Never hide essential actions on hover only.

## Responsive check
Test at minimum:
- narrow mobile,
- tablet-ish width,
- desktop.

## Completion output
Describe layout decisions and responsive behavior in the ticket summary.
