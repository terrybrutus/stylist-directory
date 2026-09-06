import "@testing-library/jest-dom/vitest";

import App from "@/App";
import type {
  AppointmentInput,
  Dashboard,
  Stylist,
  StylistInput,
} from "@/backend";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const state: Dashboard = { stylists: [], requests: [], audit: [] };
let actorReady = true;

function makeStylist(input: StylistInput): Stylist {
  return {
    id: BigInt(state.stylists.length + 1),
    active: true,
    assignments: 0n,
    eligibleOpportunities: 0n,
    declines: 0n,
    noResponses: 0n,
    lastAssignedAt: 0n,
    createdAt: 1n,
    updatedAt: 1n,
    revision: 1n,
    ...input,
  };
}

const mockActor = {
  _initialize_access_control: vi.fn(async () => undefined),
  getCallerUserRole: vi.fn(async () => "admin"),
  getDashboard: vi.fn(async () => ({
    stylists: [...state.stylists],
    requests: [...state.requests],
    audit: [...state.audit],
  })),
  createStylist: vi.fn(async (input: StylistInput) => {
    const stylist = makeStylist(input);
    state.stylists.push(stylist);
    return stylist;
  }),
  updateStylist: vi.fn(),
  setStylistActive: vi.fn(),
  routeAppointment: vi.fn(async (input: AppointmentInput) => {
    const recommended = state.stylists.find((stylist) =>
      input.availableStylistIds.includes(stylist.id),
    );
    return {
      request: {
        id: 1n,
        idempotencyKey: input.idempotencyKey,
        clientName: input.clientName,
        service: input.service,
        requestedTime: input.requestedTime,
        timing: "staff_selected",
        specialtyMatters: false,
        notes: input.notes,
        status: "suggested",
        recommendedStylistId: recommended?.id,
        backupStylistId: undefined,
        assignedStylistId: undefined,
        explanation: `${recommended?.name} was marked available, matches the service, and is first in the current rotation.`,
        createdAt: 1n,
        updatedAt: 1n,
        revision: 1n,
      },
      recommended,
      backup: undefined,
    };
  }),
  assignRequest: vi.fn(async () => undefined),
  useBackup: vi.fn(),
  setRequestStatus: vi.fn(),
  exportBackup: vi.fn(),
};

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({
    actor: actorReady ? mockActor : undefined,
    isFetching: !actorReady,
  }),
  useInternetIdentity: () => ({
    isAuthenticated: true,
    isInitializing: false,
    isLoggingIn: false,
    isLoginError: false,
    login: vi.fn(),
    clear: vi.fn(),
  }),
}));

vi.mock("@caffeineai/object-storage", () => ({
  ExternalBlob: class ExternalBlob {},
}));

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe("FairChair", () => {
  afterEach(cleanup);

  beforeEach(() => {
    actorReady = true;
    state.stylists.length = 0;
    state.requests.length = 0;
    state.audit.length = 0;
    vi.clearAllMocks();
  });

  it("opens the secure routing workspace", async () => {
    renderApp();
    expect(
      await screen.findByRole("heading", { name: "Who’s up next?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "See the live order, then check the service before marking someone booked.",
      ),
    ).toBeInTheDocument();
  });

  it("waits for the authenticated actor instead of deadlocking initialization", async () => {
    actorReady = false;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );
    expect(
      screen.getByText("Opening your secure workspace…"),
    ).toBeInTheDocument();
    expect(mockActor._initialize_access_control).not.toHaveBeenCalled();

    actorReady = true;
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Who’s up next?" }),
    ).toBeInTheDocument();
    expect(mockActor._initialize_access_control).toHaveBeenCalledOnce();
  });

  it("adds a complete stylist profile", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: "Who’s up next?" });
    await user.click(screen.getAllByRole("button", { name: "Stylists" })[0]);
    await user.click(screen.getByRole("button", { name: "Add first stylist" }));
    await user.type(screen.getByLabelText("Name"), "Ally Rivera");
    await user.type(
      screen.getByLabelText("Services they love"),
      "Balayage, vivid color",
    );
    await user.type(
      screen.getByLabelText("Services they perform"),
      "Haircuts, blowouts",
    );
    await user.click(screen.getByRole("button", { name: "Save stylist" }));

    await waitFor(() => expect(mockActor.createStylist).toHaveBeenCalledOnce());
    expect(await screen.findByText("Ally Rivera")).toBeInTheDocument();
    expect(mockActor.createStylist).toHaveBeenCalledWith(
      expect.objectContaining({
        services: expect.arrayContaining([
          { name: "Balayage", level: "love" },
          { name: "Haircuts", level: "perform" },
        ]),
      }),
    );
  });

  it("explains and confirms a recommendation", async () => {
    state.stylists.push(
      makeStylist({
        name: "Ally Rivera",
        phone: "555-0123",
        services: [{ name: "Balayage", level: "love" }],
        availabilityStatus: "now",
        availabilityNote: "Until 6",
        availabilityExpiresAt: 9_999_999_999_999_999_999n,
        acceptsNewClients: true,
      }),
    );
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: "Who’s up next?" });
    expect(
      screen.getByRole("heading", { name: "Ally Rivera is first in line" }),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("What service do they want?"),
      "Balayage",
    );
    const submit = screen.getByRole("button", { name: "Check who’s up next" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Ally Rivera.*#1/ }));
    await user.click(submit);

    expect(
      await screen.findByRole("heading", { name: "Ally Rivera" }),
    ).toBeInTheDocument();
    expect(mockActor.routeAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: "New client",
        availableStylistIds: [1n],
      }),
    );
    expect(
      screen.getByText(/first in the current rotation/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Mark booked with Ally Rivera" }),
    );
    await waitFor(() => expect(mockActor.assignRequest).toHaveBeenCalledOnce());
  });
});
