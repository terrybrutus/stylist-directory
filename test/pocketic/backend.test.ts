import { PocketIc } from "@dfinity/pic";
import { afterAll, beforeAll, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
// Set only on a converted project; this greenfield app has an empty OldActor,
// so a fresh install of the current wasm is the correct starting point.
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

let pic: PocketIc | undefined;
let actor: _SERVICE;

beforeAll(async () => {
  pic = await PocketIc.create(PIC_URL);
  if (BASELINE_WASM === undefined) {
    ({ actor } = await pic.setupCanister<_SERVICE>({ idlFactory, wasm: BACKEND_WASM }));
    return;
  }
  const installed = await pic.setupCanister<_SERVICE>({ idlFactory, wasm: BASELINE_WASM });
  await pic.upgradeCanister({ canisterId: installed.canisterId, wasm: BACKEND_WASM, arg: new Uint8Array() });
  actor = installed.actor;
});

afterAll(async () => {
  await pic?.tearDown();
});

it("answers an empty-state read instead of trapping", async () => {
  await expect(actor.getStylists()).resolves.toEqual([]);
});

it("round-trips a stylist through the real canister", async () => {
  await actor.addStylist({ name: "Ada", specialty: "Hair", availability: "Mon-Fri" });
  await expect(actor.getStylists()).resolves.toContainEqual({
    name: "Ada",
    specialty: "Hair",
    availability: "Mon-Fri",
  });
});
