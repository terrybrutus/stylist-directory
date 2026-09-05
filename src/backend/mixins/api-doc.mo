mixin () {
  public query func getApiDoc() : async Text {
    "# Stylist Registry — Backend API

This canister is a minimal stylist registry. It stores a flat list of stylists
(each with a name, a specialty, and an availability note), exposes that list to
the frontend, and makes the persisted data queryable through OQL. Access control
is role-based and gated behind Internet Identity sign-in.

## Public methods

### Stylist management

- `addStylist(stylist : Stylist) : async ()`
  Appends one stylist to the registry. `Stylist` is a record
  `{ name : Text; specialty : Text; availability : Text }`. All three fields are
  free-form text; no validation is performed. The call is an update and is
  idempotent in the sense that adding the same record twice stores two entries.
  There is no edit or delete endpoint — stylists can only be added.

- `getStylists() : async [Stylist]`
  Returns every stylist currently stored, in insertion order, as an array of
  `Stylist` records. This is a query and reads no caller identity.

### OQL data access

- `schema() : async Text`
  Returns a JSON document describing the queryable entities. The single entity is
  `stylist` (type `Stylist`, primary key `name`). Because the entity is declared
  `.public_()`, the schema is visible to any caller, including anonymous callers.

- `execute(qJson : Text) : async Result`
  Runs an OQL query against the registry. The query is a JSON string; the result
  is a typed Candid value. The `stylist` entity is `.public_()`, so any caller —
  signed-in or anonymous — may read every row. An invalid query traps with
  `OQL: invalid query — <reason>`.

### Authentication and authorization

The app uses Internet Identity. The frontend pins an Internet Identity derivation
origin, published at `/.well-known/ii-derivation-origin` when available. An agent
already holding the user's Internet Identity authorization derives the correct
per-app principal against that origin (for example
`icp identity link web <name> --app <host>`). Such a delegation acts with the
user's full authority in this app until it expires.

Registration happens only when a caller signs in through the app's own frontend.
A principal that never did so is unregistered even when it belongs to the app's
owner, and a signed-in caller derived against a different origin is a different
principal than the one the frontend registered.

- `_internet_identity_sign_in_start() : async Blob`
  Begins an Internet Identity sign-in and returns a challenge blob to present to
  the identity provider. No caller identity is required.

- `_internet_identity_sign_in_finish() : async Result.Result<(), Verify.Error>`
  Completes the sign-in and registers the caller. The first caller to register
  becomes `#admin`; every later caller becomes `#user`. Anonymous callers are
  ignored (never registered).

- `_initialize_access_control() : async ()`
  Registers the caller directly, without a full sign-in round-trip. The first
  caller becomes `#admin`; every later caller becomes `#user`. Anonymous callers
  are ignored. This is the registration prerequisite for any direct API caller:
  call it once as a signed-in caller before any role-guarded call, guarded
  queries included.

- `getCallerUserRole() : async UserRole`
  Returns the caller's role: `#admin`, `#user`, or `#guest`. An anonymous caller
  always receives `#guest`. A non-anonymous caller who has not registered traps
  with `User is not registered`.

- `isCallerAdmin() : async Bool`
  Returns whether the caller is an admin. An unregistered non-anonymous caller
  traps with `User is not registered` (the check reads the caller's role).

- `assignCallerUserRole(user : Principal, role : UserRole) : async ()`
  Assigns a role to another principal. Only an admin may call this; a non-admin
  caller traps with `Unauthorized: Only admins can assign user roles`.

### Documentation

- `getApiDoc() : async Text`
  Returns this Markdown document.

## Units and encodings

- `Stylist` fields (`name`, `specialty`, `availability`) are plain UTF-8 `Text`.
  There are no timestamps, identifiers, blobs, or numeric fields in the stylist
  records; the primary key used by OQL is the `name` field.
- `UserRole` is a variant: `#admin`, `#user`, `#guest`.
- `execute` accepts a JSON query string and returns a typed Candid result; the
  exact shape is described by `schema()`.

## Lifecycle and polling

- Stylists are append-only: `addStylist` adds, `getStylists` reads. There is no
  lifecycle state machine and nothing to poll.
- OQL queries are synchronous queries; call them and read the result directly.

## Mutation retry safety

- `addStylist` is not idempotent by identity: retrying the same call appends a
  duplicate entry. There is no deduplication, so callers should avoid retrying
  an add that already succeeded.
- `_initialize_access_control` and `_internet_identity_sign_in_finish` are
  idempotent: re-registering an already-registered caller is a no-op.
- `assignCallerUserRole` is idempotent: assigning the same role twice is a no-op.

## Errors, traps, and limits

- `getCallerUserRole` and `isCallerAdmin` trap with `User is not registered` for
  a non-anonymous caller who has not registered.
- `assignCallerUserRole` traps with `Unauthorized: Only admins can assign user
  roles` for a non-admin caller.
- `execute` traps with `OQL: invalid query — <reason>` for a malformed query.
- There is no enforced size limit on the stylist list beyond the canister's
  storage capacity.

## Non-obvious gotchas

- The `stylist` OQL entity is `.public_()`: any caller, including anonymous, can
  read all stylist rows through `schema()`/`execute()`. The role system governs
  the authorization endpoints, not the stylist data.
- A caller can be unregistered while the app already knows it: registration only
  happens through the app's own frontend sign-in flow, so a principal that never
  signed in there is unregistered even if it is the app's owner.
- `addStylist` accepts any text, including empty strings; no validation rejects
  blank names, specialties, or availability."
  };
};
