# Design Brief

## Direction

Salon Ledger — a minimal, editorial stylist directory for recording who's in the chair, what they do, and when they're free.

## Tone

Refined calm — warm cream surfaces, a single terracotta accent, and generous whitespace so the directory reads like a well-kept appointment book rather than a busy dashboard.

## Differentiation

A sparse, paper-like ledger: one clean list, one quiet add form, and a warm rose accent that signals "stylist" without resorting to generic tech blue or pink clichés.

## Color Palette

| Token      | OKLCH        | Role                          |
| ---------- | ------------ | ----------------------------- |
| background | 0.97 0.015 70 | warm cream page               |
| foreground | 0.2 0.03 50  | deep warm charcoal text       |
| card       | 1 0.008 70   | white list/form surfaces      |
| primary    | 0.5 0.15 25  | terracotta accent / CTA       |
| accent     | 0.5 0.15 25  | active state highlight        |
| muted      | 0.94 0.015 70 | soft field / secondary fill   |
| border     | 0.88 0.02 70 | hairline dividers             |

## Typography

- Display: Fraunces — stylist names and page heading (editorial serif)
- Body: General Sans — labels, fields, list meta (clean sans)
- Scale: hero text-3xl font-display tracking-tight, label text-xs uppercase tracking-widest, body text-sm/base

## Elevation & Depth

Flat, hairline-bordered surfaces with one soft `shadow-subtle` on the add card; depth comes from layered cards and borders, not heavy shadows.

## Structural Zones

| Zone    | Background  | Border   | Notes                                |
| ------- | ----------- | -------- | ------------------------------------ |
| Header  | card        | border-b | title + filter placeholders row      |
| Content | background  | —        | list on background, add card on card |
| Footer  | background  | border-t | sparse, muted caption                |

## Spacing & Rhythm

Spacious section gaps (p-6/p-8), list rows separated by hairline borders, form fields stacked with consistent spacing for a calm, uncluttered read.

## Component Patterns

- Buttons: rounded-md primary (terracotta) for the single "Add" action; few buttons overall
- Cards: rounded-md white card with shadow-subtle for the add form
- Badges: rounded-full muted chips for specialty / availability placeholders

## Motion

- Entrance: single subtle fade-up on first load (0.3s ease-out)
- Hover: gentle border/background shift on rows and buttons
- Decorative: none — restraint over flourish

## Constraints

- Extremely minimal: few buttons, sparse layout
- Do NOT build working specialty/availability/fairness filters (placeholders only)
- Do NOT build edit/remove for stylists
- Only add stylist (name, specialty, availability) + list display

## Signature Detail

A paper-ledger aesthetic — cream ground, hairline dividers, and one warm terracotta accent — makes the directory feel calm and hand-kept, not like a generic admin tool.
