# FairChair design brief

## Product

FairChair is a private stylist rotation workspace for salon staff. Clients never book through it. The app shows who is up next, then applies three understandable rules when staff checks an opportunity: real availability, service fit, and the fairest comparable turn.

## Experience

- Mobile-first, single-column workflows with 44–56px touch targets.
- Four stable destinations: Rotation, Booked, Stylists, and History.
- The live general stylist order is the first and strongest element on the home screen.
- One recommendation and one backup, never a competitive ranking.
- Every recommendation carries a plain-language explanation.
- Warm editorial styling that feels like a well-kept appointment ledger rather than enterprise scheduling software.
- Color is always paired with text, keyboard focus remains visible, and reduced motion is respected.

## Visual system

- Warm cream background, paper-white surfaces, deep charcoal text.
- Terracotta is reserved for primary actions and selected navigation.
- Fraunces provides calm editorial headings; General Sans keeps controls highly legible.
- Hairline borders and restrained shadows separate state without visual noise.

## Safety cues

- Availability automatically expires after 12 hours.
- Mutation buttons show a pending state and backend failures never masquerade as saves.
- Revision numbers protect against overwriting a newer record.
- Idempotency keys protect routed requests from retry duplication.
- Confirmed, completed, cancelled, and unmatched states use both text and color.
