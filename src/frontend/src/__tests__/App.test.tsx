import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
import type { Stylist } from "@/backend";

// The App talks to the backend exclusively through useActor(createActor) from
// @caffeineai/core-infrastructure. Mock that seam with a typed in-memory actor
// so the component/integration journey runs without a replica or network.
const mockStylists: Stylist[] = [];
const mockActor = {
  getStylists: vi.fn(async (): Promise<Stylist[]> => [...mockStylists]),
  addStylist: vi.fn(async (stylist: Stylist): Promise<void> => {
    mockStylists.push(stylist);
  }),
};

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: mockActor, isFetching: false }),
}));

// The generated backend bindings import @caffeineai/object-storage for blob
// upload/download helpers that this app never uses (the actor is mocked above).
// Mocking the module keeps the test from loading a package whose extensionless
// ESM relative imports do not resolve under Vitest's resolver.
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

describe("Stylist Directory", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockStylists.length = 0;
    mockActor.getStylists.mockClear();
    mockActor.addStylist.mockClear();
  });

  it("loads without a blank screen and shows the empty state when no stylists exist", async () => {
    renderApp();

    expect(
      screen.getByRole("heading", { name: "Stylist Directory" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("No stylists yet")).toBeInTheDocument();
  });

  it("shows the three filter options as visible placeholders", () => {
    const { container } = renderApp();

    const filterChips = Array.from(
      container.querySelectorAll('[data-ocid^="filter."]'),
    );
    expect(filterChips.map((chip) => chip.textContent)).toEqual([
      "Specialty",
      "Availability",
      "Fairness",
    ]);
  });

  it("adds a stylist and shows it in the list immediately, clearing the form", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.type(screen.getByLabelText("Specialty"), "Hair");
    await user.type(screen.getByLabelText("Availability"), "Mon-Fri");
    await user.click(screen.getByRole("button", { name: "Add Stylist" }));

    expect(await screen.findByText("Ada")).toBeInTheDocument();
    // Specialty and availability render together in one list-item span.
    expect(screen.getByText(/Hair/)).toBeInTheDocument();
    expect(screen.getByText(/Mon-Fri/)).toBeInTheDocument();

    // The form fields clear after a successful add.
    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toHaveValue("");
      expect(screen.getByLabelText("Specialty")).toHaveValue("");
      expect(screen.getByLabelText("Availability")).toHaveValue("");
    });

    // The empty state is gone once a stylist exists.
    expect(screen.queryByText("No stylists yet")).not.toBeInTheDocument();
  });

  it("does not submit when required fields are missing", async () => {
    const user = userEvent.setup();
    renderApp();

    const submit = screen.getByRole("button", { name: "Add Stylist" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "Ada");
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Specialty"), "Hair");
    await user.type(screen.getByLabelText("Availability"), "Mon-Fri");
    expect(submit).toBeEnabled();
  });
});
