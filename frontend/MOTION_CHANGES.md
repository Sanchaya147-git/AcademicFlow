# Motion & structure pass

Copy the `frontend/` folder over the repo's `frontend/`, then:

```bash
cd frontend && npm run typecheck && npm run lint && npm run dev
git checkout -b feat/motion-layer
git add app/layout.tsx app/motion.css components/session.tsx components/motion.tsx components/sidebar-nav.tsx components/logo.tsx components/status-badge.tsx components/workspace.tsx components/activity-table.tsx components/analytics-charts.tsx MOTION_CHANGES.md
git commit -m "Add motion layer, session provider, derived loading state"
git push -u origin feat/motion-layer
```

No new dependencies. Palette unchanged.

## New files
- `app/motion.css`: motion tokens, keyframes, transitions, reduced-motion override; shadcn token names now point at the existing hex palette.
- `components/session.tsx`: auth/health check moved to the root layout so it runs once instead of per section.
- `components/motion.tsx`: `CountUp`, `Bar` (replaces `<progress>`), `Meter`, `PageSkeleton`, `useBump`.
- `components/sidebar-nav.tsx`: sliding active indicator, review-count bump, tooltips when collapsed.

## Edited
- `app/layout.tsx`: imports motion.css, wraps app in `SessionProvider`.
- `components/workspace.tsx`:
  - loading derived from a request key, so refresh and section changes show feedback (Refresh icon spins; skeleton on first load)
  - notices move to an auto-dismissing toast stack
  - metric count-up + stagger; metric colors keyed on `auto_linked` / `needs_review` instead of nth-child
  - department bars fill on enter
  - report pipeline step indicator
  - spreadsheet drop zone accepts dropped files
  - review cards slide out after a decision
  - modal animates in/out, closes on Esc and backdrop click
  - confidence meter on candidates; audit timeline staggers in
- `components/activity-table.tsx`: animated progress bar, rotating sort chevron, row hover.
- `components/analytics-charts.tsx`: chart animations set to 700ms ease-out, staggered series, disabled under reduced motion.

## Icons
- One stroke weight (1.75) across all lucide icons.
- Metric icons mapped per metric key (Link2 for auto-linked, SearchCheck for review, CircleHelp for unmatched, AlarmClock for delayed…) in tinted chips using the badge palette.
- Chips on panel headings, upload zone, "Transparent by design" card and empty states.
- Check / X icons on Approve / Reject; X icon replaces the "×" text in toasts; RotateCcw on Retry.
- Spreadsheet reports show FileSpreadsheet in report history.
- Hover motion: nav icons nudge, brand mark tilts, sign-out turns red, metric chip scales, upload icon lifts on drag-over.

## Icons v2
- `components/status-badge.tsx`: every status/disposition badge gets a matching icon (Link2 linked, Clock3 review, CircleHelp unmatched, XCircle rejected, CheckCircle2 completed, PlayCircle in progress, CircleDashed planned…). Used in workspace and activity table.
- Duotone fill on icon chips, active nav icon and trust card.
- Review columns get Quote / ScanText / ListChecks icons.
- Audit timeline dots become icon chips keyed on the action (approve, reject, map, report, classify).
- Search field in the activity table gets a Search icon that turns blue on focus.
- Bell tilts on hover; footer shield in status green.

## Logo
- New `components/logo.tsx` (`Logo`, `LogoMark`, `Wordmark`) used in the sidebar, login card and boot screen.
- Mark: #2563eb→#1d4ed8 gradient, inner highlight, soft blue shadow, green live dot (#10b981, same as the status dot).
- Wordmark: "Academic" in ink #122846, "Flow" in #2563eb.
- Motion: hover tilt + light sheen sweep; live dot pulses softly; boot screen pulses the mark.

## Not done in this pass
- Splitting each section into its own route file (Phase 1, item 1 in the plan). The session provider removes the boot flash, which was the main user-facing cost; the full split is a larger refactor best done with type-checking in place.
- Base UI Dialog swap; the existing modal got Esc/backdrop close and animation instead.
- Untested here: run typecheck, lint and Playwright before merging.
