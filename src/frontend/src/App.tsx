import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddStylist, useStylists } from "@/hooks/useQueries";
import { useState } from "react";

const FILTERS = ["Specialty", "Availability", "Fairness"];

export default function App() {
  const { data: stylists = [], isLoading } = useStylists();
  const addStylist = useAddStylist();

  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [availability, setAvailability] = useState("");

  const canSubmit =
    name.trim() !== "" && specialty.trim() !== "" && availability.trim() !== "";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const captured = {
      name: name.trim(),
      specialty: specialty.trim(),
      availability: availability.trim(),
    };
    setName("");
    setSpecialty("");
    setAvailability("");
    addStylist.mutate(captured, {
      onError: () => {
        setName((current) => (current === "" ? captured.name : current));
        setSpecialty((current) =>
          current === "" ? captured.specialty : current,
        );
        setAvailability((current) =>
          current === "" ? captured.availability : current,
        );
      },
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
        {/* Header */}
        <header className="flex flex-col items-center gap-6 text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
            Stylist Directory
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {FILTERS.map((filter) => (
              <span
                key={filter}
                data-ocid={`filter.${filter.toLowerCase()}`}
                className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground"
              >
                {filter}
              </span>
            ))}
          </div>
        </header>

        {/* Add Stylist form */}
        <Card data-ocid="add_stylist_card" className="shadow-subtle">
          <CardContent className="flex flex-col gap-5">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Add Stylist
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name" className="text-sm text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="name"
                  data-ocid="stylist.name_input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Stylist name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="specialty"
                  className="text-sm text-muted-foreground"
                >
                  Specialty
                </Label>
                <Input
                  id="specialty"
                  data-ocid="stylist.specialty_input"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Hair, Nails, Makeup"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="availability"
                  className="text-sm text-muted-foreground"
                >
                  Availability
                </Label>
                <Input
                  id="availability"
                  data-ocid="stylist.availability_input"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder="e.g. Mon–Fri, Weekends"
                />
              </div>
              <Button
                type="submit"
                data-ocid="stylist.submit_button"
                className="mt-1 w-full"
                disabled={!canSubmit || addStylist.isPending}
              >
                {addStylist.isPending ? "Adding…" : "Add Stylist"}
              </Button>
              {addStylist.isError ? (
                <p
                  data-ocid="stylist.error_state"
                  className="text-sm text-destructive"
                >
                  Could not add the stylist. Please try again.
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>

        {/* Stylist list */}
        <section data-ocid="stylist_list" className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Stylists
          </h2>
          {isLoading ? (
            <p
              data-ocid="stylist.loading_state"
              className="text-sm text-muted-foreground"
            >
              Loading stylists…
            </p>
          ) : stylists.length === 0 ? (
            <div
              data-ocid="stylist.empty_state"
              className="rounded-xl border border-dashed border-border px-6 py-12 text-center"
            >
              <p className="font-display text-lg text-foreground">
                No stylists yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first stylist above to get started.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {stylists.map((stylist, index) => (
                <li
                  key={`${stylist.name}-${stylist.specialty}-${stylist.availability}`}
                  data-ocid={`stylist.item.${index + 1}`}
                  className="flex items-baseline justify-between gap-4 py-4"
                >
                  <span className="font-display text-lg font-medium text-foreground">
                    {stylist.name}
                  </span>
                  <span className="text-right text-sm text-muted-foreground">
                    {stylist.specialty}
                    <span className="mx-2 text-border">·</span>
                    {stylist.availability}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-auto pt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            className="underline underline-offset-2"
          >
            caffeine.ai
          </a>
          .
        </footer>
      </main>
    </div>
  );
}
