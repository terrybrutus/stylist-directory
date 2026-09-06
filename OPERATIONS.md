# FairChair operations and recovery

FairChair keeps its live directory, routing ledger, and audit history in persistent Motoko state. GitHub contains the application code only; it is not a backup of live business records.

## Before every production upgrade

1. Use **History → Export backup** and store the dated JSON file in the business's approved encrypted storage.
2. As the canister controller, stop the canister and create an ICP canister snapshot.
3. Deploy the tested build.
4. Verify sign-in, the stylist count, the latest request, and a non-destructive test route.
5. Retain the prior snapshot until the new version has operated successfully.

## Routine safeguards

- Export the application backup at least weekly and after major schedule or staffing changes.
- Treat Booksy as the authoritative calendar. FairChair records who staff marked free for each opportunity but does not replace or synchronize the Booksy schedule yet.
- Keep more than one backup generation and keep one copy outside the device used at the front desk.
- Monitor canister cycles and top up well before the warning threshold.
- Test snapshot restoration on a non-production canister quarterly.
- Give controller access and the owner identity to at least two trusted recovery custodians.
- Never treat a browser confirmation as saved until FairChair shows the confirmed record in **Booked**.

## Recovery order

1. Stop writes if records appear inconsistent.
2. Export the current state if the app is still readable.
3. Record the affected request IDs and the last known correct event from **History**.
4. Restore the newest known-good canister snapshot.
5. Reconcile later events from the exported JSON and the salon's booking system.

## Current privacy boundary

The first authenticated principal becomes the workspace administrator. Other identities cannot read or change FairChair business data. Client intake intentionally stores only a short reference, requested service, time, and optional operational note. Do not enter medical, payment, or other sensitive personal information in notes.
