import { type Actor as PicActor, PocketIc, createIdentity } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

let pic: PocketIc | undefined;
let actor: PicActor<_SERVICE>;
let allyId = 0n;
let bellaId = 0n;

beforeAll(async () => {
  pic = await PocketIc.create(PIC_URL);
  if (BASELINE_WASM === undefined) {
    ({ actor } = await pic.setupCanister<_SERVICE>({
      idlFactory,
      wasm: BACKEND_WASM,
    }));
  } else {
    const installed = await pic.setupCanister<_SERVICE>({
      idlFactory,
      wasm: BASELINE_WASM,
    });
    await pic.upgradeCanister({
      canisterId: installed.canisterId,
      wasm: BACKEND_WASM,
      arg: new Uint8Array(),
    });
    actor = installed.actor;
  }
  actor.setIdentity(createIdentity("fairchair-owner-test-identity"));
  await actor._initialize_access_control();
});

afterAll(async () => {
  await pic?.tearDown();
});

const availableUntil = 9_999_999_999_999_999_999n;

describe("FairChair backend", () => {
  it("starts with a durable empty dashboard", async () => {
    await expect(actor.getDashboard()).resolves.toEqual({
      audit: [],
      requests: [],
      stylists: [],
    });
  });

  it("stores complete service and availability profiles", async () => {
    const ally = await actor.createStylist({
      name: "Ally Rivera",
      phone: "555-0123",
      services: [
        { name: "Balayage", level: "love" },
        { name: "Haircut", level: "perform" },
      ],
      availabilityStatus: "now",
      availabilityNote: "Today until 6",
      availabilityExpiresAt: availableUntil,
      acceptsNewClients: true,
    });
    const bella = await actor.createStylist({
      name: "Bella Chen",
      phone: "555-0199",
      services: [
        { name: "Balayage", level: "perform" },
        { name: "Haircut", level: "perform" },
      ],
      availabilityStatus: "now",
      availabilityNote: "Today until 7",
      availabilityExpiresAt: availableUntil,
      acceptsNewClients: true,
    });
    allyId = ally.id;
    bellaId = bella.id;

    expect(ally.name).toBe("Ally Rivera");
    expect((await actor.getDashboard()).stylists).toHaveLength(2);
  });

  it("prioritizes a requested specialty and explains the decision", async () => {
    const result = await actor.routeClient({
      idempotencyKey: "specialty-route",
      clientName: "Maria",
      service: "Balayage",
      requestedTime: "As soon as possible",
      timing: "now",
      specialtyMatters: true,
      notes: "",
    });

    expect(result.recommended[0]?.name).toBe("Ally Rivera");
    expect(result.request.explanation).toContain("loves this service");
  });

  it("moves the next equal-fit client through the fair rotation", async () => {
    const first = await actor.routeClient({
      idempotencyKey: "fairness-route-1",
      clientName: "Jamie",
      service: "Haircut",
      requestedTime: "As soon as possible",
      timing: "now",
      specialtyMatters: false,
      notes: "",
    });
    const firstStylist = first.recommended[0];
    expect(firstStylist).toBeDefined();
    await actor.assignRequest(
      first.request.id,
      firstStylist!.id,
      first.request.revision,
      "",
    );

    const second = await actor.routeClient({
      idempotencyKey: "fairness-route-2",
      clientName: "Robin",
      service: "Haircut",
      requestedTime: "As soon as possible",
      timing: "now",
      specialtyMatters: false,
      notes: "",
    });
    expect(second.recommended[0]?.name).not.toBe(firstStylist!.name);
  });

  it("uses the Booksy availability selection for a specific time", async () => {
    const result = await actor.routeAppointment({
      idempotencyKey: "booksy-selection",
      clientName: "Morgan",
      service: "Haircut",
      requestedTime: "Sunday at 11",
      availableStylistIds: [allyId],
      notes: "",
    });

    expect(result.recommended[0]?.id).toBe(allyId);
    expect(result.request.explanation).toContain("marked available");
  });

  it("preserves a busy stylist's turn while moving through the selected list", async () => {
    const first = await actor.routeAppointment({
      idempotencyKey: "preserved-turn-1",
      clientName: "Avery",
      service: "Haircut",
      requestedTime: "As soon as possible",
      availableStylistIds: [allyId, bellaId],
      notes: "",
    });
    const heldStylist = first.recommended[0];
    expect(heldStylist).toBeDefined();

    const next = await actor.useBackup(
      first.request.id,
      first.request.revision,
      "Busy — turn preserved",
    );
    expect(next.recommended[0]?.id).not.toBe(heldStylist!.id);
    await actor.assignRequest(
      next.request.id,
      next.recommended[0]!.id,
      next.request.revision,
      "",
    );

    const following = await actor.routeAppointment({
      idempotencyKey: "preserved-turn-2",
      clientName: "Riley",
      service: "Haircut",
      requestedTime: "As soon as possible",
      availableStylistIds: [allyId, bellaId],
      notes: "",
    });
    expect(following.recommended[0]?.id).toBe(heldStylist!.id);
  });

  it("deduplicates a retried routing request and exports a recovery copy", async () => {
    const input = {
      idempotencyKey: "safe-retry",
      clientName: "Taylor",
      service: "Haircut",
      requestedTime: "Tomorrow at 2",
      timing: "later",
      specialtyMatters: false,
      notes: "",
    };
    const first = await actor.routeClient(input);
    const retry = await actor.routeClient(input);
    expect(retry.request.id).toBe(first.request.id);

    const backup = await actor.exportBackup();
    expect(backup.version).toBe(1n);
    expect(
      backup.dashboard.requests.filter(
        (request) => request.idempotencyKey === "safe-retry",
      ),
    ).toHaveLength(1);
  });
});
