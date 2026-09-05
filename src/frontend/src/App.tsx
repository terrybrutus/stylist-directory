import type {
  ClientRequest,
  Dashboard,
  RoutingResult,
  ServicePreference,
  Stylist,
  StylistInput,
} from "@/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useAssignRequest,
  useBackupRecommendation,
  useCreateStylist,
  useDirectory,
  useExportBackup,
  useInitializeAccess,
  useRouteClient,
  useSetRequestStatus,
  useSetStylistActive,
  useUpdateStylist,
} from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  History,
  LoaderCircle,
  LogOut,
  Phone,
  Plus,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type View = "route" | "today" | "stylists" | "history";

const NAV_ITEMS: Array<{ id: View; label: string; icon: typeof Sparkles }> = [
  { id: "route", label: "Route", icon: Sparkles },
  { id: "today", label: "Today", icon: CalendarClock },
  { id: "stylists", label: "Stylists", icon: UsersRound },
  { id: "history", label: "History", icon: History },
];

const STATUS_LABELS: Record<string, string> = {
  suggested: "Ready to assign",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  unmatched: "Needs attention",
};

function expiryInHours(hours: number) {
  return BigInt(Date.now() + hours * 60 * 60 * 1000) * 1_000_000n;
}

function fromNanoseconds(value: bigint) {
  if (value === 0n) return "Not yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(Number(value / 1_000_000n));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function serviceNames(stylists: Stylist[]) {
  return Array.from(
    new Set(
      stylists.flatMap((stylist) =>
        stylist.services
          .filter((service) => service.level !== "avoid")
          .map((service) => service.name.trim()),
      ),
    ),
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function getStylist(stylists: Stylist[], id?: bigint) {
  if (id === undefined) return undefined;
  return stylists.find((stylist) => stylist.id === id);
}

function mutationMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("unauthorized")) {
    return "This workspace is restricted to its owner.";
  }
  if (
    message.toLowerCase().includes("reject") ||
    message.toLowerCase().includes("trap")
  ) {
    return "That record changed before your update was saved. Refresh and try again.";
  }
  return "Your change was not saved. Check your connection and try again.";
}

function LoginScreen() {
  const { login, isLoggingIn, isLoginError } = useInternetIdentity();
  const [attempted, setAttempted] = useState(false);
  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">
          <Scissors size={25} strokeWidth={1.8} />
        </div>
        <p className="eyebrow">Private workspace</p>
        <h1 id="login-title">A fair chair, every time.</h1>
        <p className="login-copy">
          Route new clients by real availability, service fit, and a transparent
          rotation your team can trust.
        </p>
        <Button
          className="h-14 w-full text-base"
          onClick={() => {
            setAttempted(true);
            login();
          }}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <ShieldCheck />
          )}
          {isLoggingIn ? "Opening secure workspace…" : "Sign in securely"}
        </Button>
        {attempted && isLoginError ? (
          <p className="form-error" role="alert">
            Sign-in did not finish. Please try again.
          </p>
        ) : null}
        <p className="privacy-note">
          Client and stylist details stay behind your organization’s sign-in.
        </p>
      </section>
    </main>
  );
}

function RouteView({ dashboard }: { dashboard: Dashboard }) {
  const route = useRouteClient();
  const assign = useAssignRequest();
  const useBackup = useBackupRecommendation();
  const [clientName, setClientName] = useState("");
  const [service, setService] = useState("");
  const [timing, setTiming] = useState("now");
  const [requestedTime, setRequestedTime] = useState("");
  const [specialtyMatters, setSpecialtyMatters] = useState(false);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<RoutingResult | null>(null);
  const [notice, setNotice] = useState("");
  const [overrideId, setOverrideId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const services = useMemo(
    () => serviceNames(dashboard.stylists),
    [dashboard.stylists],
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!clientName.trim() || !service.trim()) return;
    setNotice("");
    route.mutate(
      {
        idempotencyKey: crypto.randomUUID(),
        clientName: clientName.trim(),
        service: service.trim(),
        timing,
        requestedTime:
          timing === "now" ? "As soon as possible" : requestedTime.trim(),
        specialtyMatters,
        notes: notes.trim(),
      },
      {
        onSuccess: (next) => setResult(next),
        onError: (error) => setNotice(mutationMessage(error)),
      },
    );
  }

  function confirm() {
    if (!result?.recommended) return;
    setNotice("");
    assign.mutate(
      {
        requestId: result.request.id,
        stylistId: result.recommended.id,
        revision: result.request.revision,
      },
      {
        onSuccess: () => {
          setNotice(
            `${result.recommended?.name} is confirmed for this client.`,
          );
          setResult(null);
          setClientName("");
          setService("");
          setRequestedTime("");
          setNotes("");
          setSpecialtyMatters(false);
        },
        onError: (error) => setNotice(mutationMessage(error)),
      },
    );
  }

  function chooseBackup() {
    if (!result) return;
    useBackup.mutate(
      {
        requestId: result.request.id,
        revision: result.request.revision,
        reason: "Original recommendation was not available",
      },
      {
        onSuccess: (next) => setResult(next),
        onError: (error) => setNotice(mutationMessage(error)),
      },
    );
  }

  function confirmOverride() {
    if (!result || !overrideId || !overrideReason.trim()) return;
    const stylist = dashboard.stylists.find(
      (candidate) => candidate.id === BigInt(overrideId),
    );
    if (!stylist) return;
    assign.mutate(
      {
        requestId: result.request.id,
        stylistId: stylist.id,
        revision: result.request.revision,
        note: `Manager override: ${overrideReason.trim()}`,
      },
      {
        onSuccess: () => {
          setResult(null);
          setClientName("");
          setService("");
          setNotes("");
          setOverrideId("");
          setOverrideReason("");
        },
        onError: (error) => setNotice(mutationMessage(error)),
      },
    );
  }

  if (result) {
    return (
      <section className="page-section" aria-labelledby="match-heading">
        <button
          type="button"
          className="back-link"
          onClick={() => setResult(null)}
        >
          <ArrowLeft size={18} /> Edit request
        </button>
        <div className="recommendation-card">
          <div className="recommendation-topline">
            <span className="pulse-dot" /> Recommended match
          </div>
          {result.recommended ? (
            <>
              <div className="recommendation-person">
                <div className="avatar avatar-large">
                  {initials(result.recommended.name)}
                </div>
                <div>
                  <p className="eyebrow">Next fair opportunity</p>
                  <h2 id="match-heading">{result.recommended.name}</h2>
                  <p>
                    {result.request.service} · {result.request.requestedTime}
                  </p>
                </div>
              </div>
              <div className="reason-box">
                <Check size={20} aria-hidden="true" />
                <p>{result.request.explanation}</p>
              </div>
              {result.recommended.phone ? (
                <p className="contact-line">
                  <Phone size={17} /> {result.recommended.phone}
                </p>
              ) : null}
              <div className="stacked-actions">
                <Button
                  className="h-14 text-base"
                  onClick={confirm}
                  disabled={assign.isPending}
                >
                  {assign.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Check />
                  )}
                  Confirm with {result.recommended.name}
                </Button>
                {result.backup ? (
                  <Button
                    variant="outline"
                    className="h-12"
                    onClick={chooseBackup}
                    disabled={useBackup.isPending}
                  >
                    <RotateCcw /> Try backup: {result.backup.name}
                  </Button>
                ) : null}
              </div>
              <details className="override-panel">
                <summary>Manager override</summary>
                <p>
                  Use for a client request or real-world exception. The reason
                  is saved in History.
                </p>
                <Label htmlFor="override-stylist">Assign another stylist</Label>
                <select
                  id="override-stylist"
                  value={overrideId}
                  onChange={(event) => setOverrideId(event.target.value)}
                >
                  <option value="">Choose a stylist</option>
                  {dashboard.stylists
                    .filter((stylist) => stylist.active)
                    .map((stylist) => (
                      <option
                        key={stylist.id.toString()}
                        value={stylist.id.toString()}
                      >
                        {stylist.name}
                      </option>
                    ))}
                </select>
                <Label htmlFor="override-reason">Reason</Label>
                <Input
                  id="override-reason"
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  placeholder="e.g. Client specifically requested them"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={confirmOverride}
                  disabled={
                    !overrideId || !overrideReason.trim() || assign.isPending
                  }
                >
                  Confirm override
                </Button>
              </details>
            </>
          ) : (
            <div className="empty-panel">
              <div className="empty-icon">
                <CalendarClock />
              </div>
              <h2 id="match-heading">No match right now</h2>
              <p>{result.request.explanation}</p>
              <Button variant="outline" onClick={() => setResult(null)}>
                Adjust request
              </Button>
            </div>
          )}
        </div>
        {notice ? <output className="notice">{notice}</output> : null}
      </section>
    );
  }

  return (
    <section
      className="page-section route-grid"
      aria-labelledby="route-heading"
    >
      <div className="page-intro">
        <p className="eyebrow">New client</p>
        <h1 id="route-heading">Find the right chair.</h1>
        <p>Availability first. Service fit next. Fairness always.</p>
      </div>
      {dashboard.stylists.filter((stylist) => stylist.active).length === 0 ? (
        <div className="setup-callout">
          <UsersRound />
          <div>
            <strong>Add your team first</strong>
            <p>Create at least one stylist profile before routing a client.</p>
          </div>
        </div>
      ) : null}
      <form className="surface-form" onSubmit={submit}>
        <div className="field-grid">
          <div className="field">
            <Label htmlFor="client-name">Client first name or reference</Label>
            <Input
              id="client-name"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              placeholder="e.g. Maria"
              autoComplete="off"
            />
            <p className="field-help">
              Use only what your team needs to identify the request.
            </p>
          </div>
          <div className="field">
            <Label htmlFor="service">Requested service</Label>
            <Input
              id="service"
              list="service-options"
              value={service}
              onChange={(event) => setService(event.target.value)}
              placeholder="e.g. Balayage"
              autoComplete="off"
            />
            <datalist id="service-options">
              {services.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
        </div>
        <fieldset className="field">
          <legend>When do they need it?</legend>
          <div className="segmented-control">
            <button
              type="button"
              className={cn(timing === "now" && "active")}
              onClick={() => setTiming("now")}
              aria-pressed={timing === "now"}
            >
              Now
            </button>
            <button
              type="button"
              className={cn(timing === "later" && "active")}
              onClick={() => setTiming("later")}
              aria-pressed={timing === "later"}
            >
              Later
            </button>
          </div>
        </fieldset>
        {timing === "later" ? (
          <div className="field">
            <Label htmlFor="requested-time">Requested date and time</Label>
            <Input
              id="requested-time"
              type="datetime-local"
              value={requestedTime}
              onChange={(event) => setRequestedTime(event.target.value)}
              required
            />
          </div>
        ) : null}
        <div className="switch-row">
          <div>
            <Label htmlFor="specialty-matters">
              This service needs a specialist
            </Label>
            <p>Prioritize stylists who marked it as a service they love.</p>
          </div>
          <Switch
            id="specialty-matters"
            checked={specialtyMatters}
            onCheckedChange={setSpecialtyMatters}
          />
        </div>
        <div className="field">
          <Label htmlFor="route-notes">
            Helpful notes <span>Optional</span>
          </Label>
          <Textarea
            id="route-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Timing flexibility or another important detail"
          />
        </div>
        <Button
          className="h-14 w-full text-base"
          type="submit"
          disabled={!clientName.trim() || !service.trim() || route.isPending}
        >
          {route.isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          {route.isPending ? "Checking the rotation…" : "Find best match"}
        </Button>
        {notice ? (
          <p className="form-error" role="alert">
            {notice}
          </p>
        ) : null}
      </form>
      <div className="trust-strip" aria-label="How recommendations work">
        <span>
          <strong>1</strong> Available
        </span>
        <ChevronRight />
        <span>
          <strong>2</strong> Right service
        </span>
        <ChevronRight />
        <span>
          <strong>3</strong> Fairest turn
        </span>
      </div>
    </section>
  );
}

function TodayView({ dashboard }: { dashboard: Dashboard }) {
  const updateStatus = useSetRequestStatus();
  const active = [...dashboard.requests]
    .filter((request) => !["completed", "cancelled"].includes(request.status))
    .reverse();
  const confirmed = active.filter(
    (request) => request.status === "confirmed",
  ).length;

  function setStatus(request: ClientRequest, status: string, reason = "") {
    updateStatus.mutate({
      requestId: request.id,
      status,
      revision: request.revision,
      reason,
    });
  }

  return (
    <section className="page-section" aria-labelledby="today-heading">
      <div className="page-intro intro-row">
        <div>
          <p className="eyebrow">Live desk</p>
          <h1 id="today-heading">Today</h1>
          <p>Every open handoff in one calm view.</p>
        </div>
        <div className="count-card">
          <strong>{confirmed}</strong>
          <span>confirmed</span>
        </div>
      </div>
      {active.length === 0 ? (
        <div className="empty-panel bordered">
          <div className="empty-icon">
            <ClipboardList />
          </div>
          <h2>Nothing waiting</h2>
          <p>New recommendations and confirmed handoffs will appear here.</p>
        </div>
      ) : (
        <div className="request-list">
          {active.map((request) => {
            const assigned = getStylist(
              dashboard.stylists,
              request.assignedStylistId,
            );
            const recommended = getStylist(
              dashboard.stylists,
              request.recommendedStylistId,
            );
            const person = assigned ?? recommended;
            return (
              <article className="request-card" key={request.id.toString()}>
                <div className="request-card-top">
                  <span
                    className={cn("status-pill", `status-${request.status}`)}
                  >
                    {STATUS_LABELS[request.status] ?? request.status}
                  </span>
                  <time>{fromNanoseconds(request.createdAt)}</time>
                </div>
                <h2>{request.clientName || "Unnamed client"}</h2>
                <p className="request-meta">
                  {request.service} · {request.requestedTime}
                </p>
                {person ? (
                  <div className="person-row">
                    <div className="avatar">{initials(person.name)}</div>
                    <div>
                      <span>{assigned ? "Assigned to" : "Recommended"}</span>
                      <strong>{person.name}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="attention-copy">
                    No eligible stylist was found.
                  </p>
                )}
                {request.notes ? (
                  <p className="request-note">“{request.notes}”</p>
                ) : null}
                {request.status === "confirmed" ? (
                  <div className="inline-actions">
                    <Button
                      size="sm"
                      onClick={() => setStatus(request, "completed")}
                      disabled={updateStatus.isPending}
                    >
                      <Check /> Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setStatus(request, "cancelled", "client_cancelled")
                      }
                      disabled={updateStatus.isPending}
                    >
                      <X /> Client canceled
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setStatus(request, "cancelled", "stylist_cancelled")
                      }
                      disabled={updateStatus.isPending}
                    >
                      Stylist canceled
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function splitServices(value: string, level: string): ServicePreference[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((name) => ({ name, level }));
}

function StylistForm({
  stylist,
  onDone,
}: { stylist?: Stylist; onDone: () => void }) {
  const create = useCreateStylist();
  const update = useUpdateStylist();
  const [name, setName] = useState(stylist?.name ?? "");
  const [phone, setPhone] = useState(stylist?.phone ?? "");
  const [loves, setLoves] = useState(
    stylist?.services
      .filter((item) => item.level === "love")
      .map((item) => item.name)
      .join(", ") ?? "",
  );
  const [performs, setPerforms] = useState(
    stylist?.services
      .filter((item) => item.level === "perform")
      .map((item) => item.name)
      .join(", ") ?? "",
  );
  const [avoids, setAvoids] = useState(
    stylist?.services
      .filter((item) => item.level === "avoid")
      .map((item) => item.name)
      .join(", ") ?? "",
  );
  const [availabilityStatus, setAvailabilityStatus] = useState(
    stylist?.availabilityStatus ?? "now",
  );
  const [availabilityNote, setAvailabilityNote] = useState(
    stylist?.availabilityNote ?? "",
  );
  const [acceptsNewClients, setAcceptsNewClients] = useState(
    stylist?.acceptsNewClients ?? true,
  );
  const [error, setError] = useState("");
  const pending = create.isPending || update.isPending;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const services = [
      ...splitServices(loves, "love"),
      ...splitServices(performs, "perform"),
      ...splitServices(avoids, "avoid"),
    ];
    if (
      !name.trim() ||
      services.filter((item) => item.level !== "avoid").length === 0
    )
      return;
    const input: StylistInput = {
      name: name.trim(),
      phone: phone.trim(),
      services,
      availabilityStatus,
      availabilityNote: availabilityNote.trim(),
      acceptsNewClients,
      availabilityExpiresAt:
        availabilityStatus === "unavailable" ? 0n : expiryInHours(12),
    };
    const callbacks = {
      onSuccess: onDone,
      onError: (nextError: unknown) => setError(mutationMessage(nextError)),
    };
    if (stylist)
      update.mutate(
        { id: stylist.id, input, revision: stylist.revision },
        callbacks,
      );
    else create.mutate(input, callbacks);
  }

  return (
    <section className="page-section" aria-labelledby="stylist-form-heading">
      <button type="button" className="back-link" onClick={onDone}>
        <ArrowLeft size={18} /> Back to stylists
      </button>
      <div className="page-intro">
        <p className="eyebrow">Team profile</p>
        <h1 id="stylist-form-heading">
          {stylist ? `Edit ${stylist.name}` : "Add a stylist"}
        </h1>
        <p>
          Describe what they love, what they perform, and when they can take
          someone new.
        </p>
      </div>
      <form className="surface-form" onSubmit={submit}>
        <div className="field-grid">
          <div className="field">
            <Label htmlFor="stylist-name">Name</Label>
            <Input
              id="stylist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="field">
            <Label htmlFor="stylist-phone">
              Business phone <span>Optional</span>
            </Label>
            <Input
              id="stylist-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(555) 555-0123"
            />
          </div>
        </div>
        <div className="service-fields">
          <div className="field service-love">
            <Label htmlFor="loves">Services they love</Label>
            <Textarea
              id="loves"
              value={loves}
              onChange={(event) => setLoves(event.target.value)}
              placeholder="Balayage, vivid color"
            />
            <p className="field-help">Separate services with commas.</p>
          </div>
          <div className="field">
            <Label htmlFor="performs">Services they perform</Label>
            <Textarea
              id="performs"
              value={performs}
              onChange={(event) => setPerforms(event.target.value)}
              placeholder="Haircuts, blowouts, highlights"
            />
          </div>
          <div className="field service-avoid">
            <Label htmlFor="avoids">
              Services they don’t perform <span>Optional</span>
            </Label>
            <Textarea
              id="avoids"
              value={avoids}
              onChange={(event) => setAvoids(event.target.value)}
              placeholder="Extensions"
            />
          </div>
        </div>
        <fieldset className="field">
          <legend>Current availability</legend>
          <div className="three-way-control">
            {[
              { value: "now", label: "Available now" },
              { value: "later", label: "Available later" },
              { value: "unavailable", label: "Unavailable" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(availabilityStatus === option.value && "active")}
                onClick={() => setAvailabilityStatus(option.value)}
                aria-pressed={availabilityStatus === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="field-help">
            Available statuses automatically expire after 12 hours to prevent
            stale assignments.
          </p>
        </fieldset>
        <div className="field">
          <Label htmlFor="availability-note">Hours or timing note</Label>
          <Input
            id="availability-note"
            value={availabilityNote}
            onChange={(event) => setAvailabilityNote(event.target.value)}
            placeholder="e.g. Today until 6, Tue–Fri 10–4"
          />
        </div>
        <div className="switch-row">
          <div>
            <Label htmlFor="new-clients">Accepting new clients</Label>
            <p>Turn this off without archiving the stylist.</p>
          </div>
          <Switch
            id="new-clients"
            checked={acceptsNewClients}
            onCheckedChange={setAcceptsNewClients}
          />
        </div>
        <Button
          className="h-14 w-full text-base"
          type="submit"
          disabled={
            !name.trim() || (!loves.trim() && !performs.trim()) || pending
          }
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Check />}
          {pending ? "Saving securely…" : "Save stylist"}
        </Button>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}

function StylistsView({ dashboard }: { dashboard: Dashboard }) {
  const update = useUpdateStylist();
  const setActive = useSetStylistActive();
  const [editing, setEditing] = useState<Stylist | "new" | null>(null);
  const stylists = [...dashboard.stylists].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
  );

  if (editing)
    return (
      <StylistForm
        stylist={editing === "new" ? undefined : editing}
        onDone={() => setEditing(null)}
      />
    );

  function quickAvailability(stylist: Stylist, availabilityStatus: string) {
    const input: StylistInput = {
      name: stylist.name,
      phone: stylist.phone,
      services: stylist.services,
      availabilityStatus,
      availabilityNote: stylist.availabilityNote,
      availabilityExpiresAt:
        availabilityStatus === "unavailable" ? 0n : expiryInHours(12),
      acceptsNewClients: stylist.acceptsNewClients,
    };
    update.mutate({ id: stylist.id, input, revision: stylist.revision });
  }

  return (
    <section className="page-section" aria-labelledby="stylists-heading">
      <div className="page-intro intro-row">
        <div>
          <p className="eyebrow">Your team</p>
          <h1 id="stylists-heading">Stylists</h1>
          <p>Keep service fit and availability honest.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus /> Add stylist
        </Button>
      </div>
      {stylists.length === 0 ? (
        <div className="empty-panel bordered">
          <div className="empty-icon">
            <UserRound />
          </div>
          <h2>Build your team</h2>
          <p>Add each stylist’s services and current availability.</p>
          <Button onClick={() => setEditing("new")}>
            <Plus /> Add first stylist
          </Button>
        </div>
      ) : (
        <div className="stylist-list">
          {stylists.map((stylist) => {
            const loves = stylist.services.filter(
              (item) => item.level === "love",
            );
            const rate =
              stylist.eligibleOpportunities === 0n
                ? "New"
                : `${Math.round(Number((stylist.assignments * 100n) / stylist.eligibleOpportunities))}%`;
            return (
              <article
                className={cn("stylist-card", !stylist.active && "archived")}
                key={stylist.id.toString()}
              >
                <div className="stylist-main">
                  <div className="avatar avatar-large">
                    {initials(stylist.name)}
                  </div>
                  <div className="stylist-title">
                    <div>
                      <h2>{stylist.name}</h2>
                      {!stylist.active ? (
                        <span className="archive-label">Archived</span>
                      ) : null}
                    </div>
                    <p>
                      {loves.length
                        ? `Loves ${loves.map((item) => item.name).join(", ")}`
                        : "No specialties noted"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="edit-link"
                    onClick={() => setEditing(stylist)}
                  >
                    Edit
                  </button>
                </div>
                {stylist.active ? (
                  <div
                    className="quick-status"
                    aria-label={`${stylist.name} availability`}
                  >
                    {[
                      { value: "now", label: "Now" },
                      { value: "later", label: "Later" },
                      { value: "unavailable", label: "Off" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          stylist.availabilityStatus === option.value &&
                            "active",
                        )}
                        aria-pressed={
                          stylist.availabilityStatus === option.value
                        }
                        onClick={() => quickAvailability(stylist, option.value)}
                        disabled={update.isPending}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="stylist-details">
                  <span>
                    <strong>{stylist.assignments.toString()}</strong> new
                    clients
                  </span>
                  <span>
                    <strong>{rate}</strong> of eligible turns
                  </span>
                  <span>
                    <strong>{stylist.declines.toString()}</strong> passes
                  </span>
                </div>
                <div className="stylist-footer">
                  <span>{stylist.availabilityNote || "No hours note"}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setActive.mutate({
                        id: stylist.id,
                        active: !stylist.active,
                        revision: stylist.revision,
                      })
                    }
                  >
                    {stylist.active ? "Archive" : "Restore"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HistoryView({ dashboard }: { dashboard: Dashboard }) {
  const exportBackup = useExportBackup();
  const [exported, setExported] = useState(false);
  const events = [...dashboard.audit].reverse();

  function downloadBackup() {
    exportBackup.mutate(undefined, {
      onSuccess: (backup) => {
        const blob = new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `fairchair-backup-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        setExported(true);
      },
    });
  }

  return (
    <section className="page-section" aria-labelledby="history-heading">
      <div className="page-intro intro-row">
        <div>
          <p className="eyebrow">Accountability</p>
          <h1 id="history-heading">History</h1>
          <p>A durable record of recommendations and decisions.</p>
        </div>
        <Button
          variant="outline"
          onClick={downloadBackup}
          disabled={exportBackup.isPending}
        >
          {exportBackup.isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Download />
          )}{" "}
          Export backup
        </Button>
      </div>
      {exported ? (
        <output className="notice">
          <ShieldCheck /> Backup downloaded successfully.
        </output>
      ) : null}
      <div className="history-note">
        <ShieldCheck />
        <p>
          <strong>Nothing important disappears.</strong>
          <br />
          Changes are recorded as events so the team can understand what
          happened later.
        </p>
      </div>
      {events.length === 0 ? (
        <div className="empty-panel bordered">
          <div className="empty-icon">
            <History />
          </div>
          <h2>No activity yet</h2>
          <p>Your first stylist or routed client will start the record.</p>
        </div>
      ) : (
        <ol className="timeline">
          {events.map((event) => (
            <li key={event.id.toString()}>
              <span className="timeline-dot" />
              <div>
                <div className="timeline-heading">
                  <strong>
                    {event.kind
                      .split(".")
                      .slice(-1)[0]
                      .replace(/^./, (letter) => letter.toUpperCase())}
                  </strong>
                  <time>{fromNanoseconds(event.createdAt)}</time>
                </div>
                <p>{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Workspace() {
  const { clear } = useInternetIdentity();
  const initialize = useInitializeAccess();
  const [initialized, setInitialized] = useState(false);
  const [view, setView] = useState<View>("route");
  const directory = useDirectory(initialized);

  useEffect(() => {
    if (!initialized && !initialize.isPending && !initialize.isError) {
      initialize.mutate(undefined, {
        onSuccess: () => setInitialized(true),
      });
    }
  }, [initialize, initialized]);

  if (!initialized || directory.isLoading) {
    return (
      <main className="loading-screen">
        <LoaderCircle className="animate-spin" />
        <p>Opening your secure workspace…</p>
      </main>
    );
  }

  if (initialize.isError || directory.isError || !directory.data) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-mark">
            <ShieldCheck />
          </div>
          <p className="eyebrow">Access protected</p>
          <h1>This workspace is private.</h1>
          <p className="login-copy">
            The owner can grant team access when role management is enabled.
          </p>
          <Button variant="outline" className="h-12 w-full" onClick={clear}>
            <LogOut /> Sign out
          </Button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="wordmark"
          type="button"
          onClick={() => setView("route")}
        >
          <span className="brand-mark brand-mark-small">
            <Scissors />
          </span>
          <span>
            <strong>FairChair</strong>
            <small>New client rotation</small>
          </span>
        </button>
        <nav className="desktop-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(view === item.id && "active")}
              onClick={() => setView(item.id)}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="sign-out"
          onClick={clear}
          aria-label="Sign out"
        >
          <LogOut />
        </button>
      </header>
      <main className="content-shell">
        {view === "route" ? <RouteView dashboard={directory.data} /> : null}
        {view === "today" ? <TodayView dashboard={directory.data} /> : null}
        {view === "stylists" ? (
          <StylistsView dashboard={directory.data} />
        ) : null}
        {view === "history" ? <HistoryView dashboard={directory.data} /> : null}
      </main>
      <nav className="mobile-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(view === item.id && "active")}
            onClick={() => setView(item.id)}
          >
            <item.icon />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isInitializing } = useInternetIdentity();
  if (isInitializing)
    return (
      <main className="loading-screen">
        <LoaderCircle className="animate-spin" />
        <p>Preparing secure sign-in…</p>
      </main>
    );
  return isAuthenticated ? <Workspace /> : <LoginScreen />;
}
