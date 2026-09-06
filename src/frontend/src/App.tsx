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
  useRouteAppointment,
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
  { id: "route", label: "Rotation", icon: Sparkles },
  { id: "today", label: "Booked", icon: CalendarClock },
  { id: "stylists", label: "Stylists", icon: UsersRound },
  { id: "history", label: "History", icon: History },
];

const STATUS_LABELS: Record<string, string> = {
  suggested: "Ready to assign",
  confirmed: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  unmatched: "Needs attention",
};

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

function currentRotation(stylists: Stylist[]) {
  return stylists
    .filter((stylist) => stylist.active && stylist.acceptsNewClients)
    .sort((left, right) => {
      if (left.lastAssignedAt !== right.lastAssignedAt) {
        return left.lastAssignedAt < right.lastAssignedAt ? -1 : 1;
      }
      return left.id < right.id ? -1 : 1;
    });
}

function performsService(stylist: Stylist, service: string) {
  const requested = service.trim().toLocaleLowerCase();
  return stylist.services.some(
    (item) =>
      item.name.trim().toLocaleLowerCase() === requested &&
      item.level !== "avoid",
  );
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
        <h1 id="login-title">Know who’s up next.</h1>
        <p className="login-copy">
          A private stylist rotation for your salon team—based on
          Booksy-confirmed availability, service fit, and fairness.
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
          For salon staff only. Clients do not book through this app.
        </p>
      </section>
    </main>
  );
}

function RouteView({ dashboard }: { dashboard: Dashboard }) {
  const route = useRouteAppointment();
  const assign = useAssignRequest();
  const useBackup = useBackupRecommendation();
  const [clientName, setClientName] = useState("");
  const [service, setService] = useState("");
  const [timing, setTiming] = useState("now");
  const [requestedTime, setRequestedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [availableStylistIds, setAvailableStylistIds] = useState<bigint[]>([]);
  const [result, setResult] = useState<RoutingResult | null>(null);
  const [notice, setNotice] = useState("");
  const [overrideId, setOverrideId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const services = useMemo(
    () => serviceNames(dashboard.stylists),
    [dashboard.stylists],
  );
  const rotation = useMemo(
    () => currentRotation(dashboard.stylists),
    [dashboard.stylists],
  );
  const capableStylists = useMemo(
    () => rotation.filter((stylist) => performsService(stylist, service)),
    [rotation, service],
  );

  function toggleAvailable(stylistId: bigint) {
    setAvailableStylistIds((current) =>
      current.includes(stylistId)
        ? current.filter((id) => id !== stylistId)
        : [...current, stylistId],
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !service.trim() ||
      availableStylistIds.length === 0 ||
      (timing === "later" && !requestedTime)
    )
      return;
    setNotice("");
    route.mutate(
      {
        idempotencyKey: crypto.randomUUID(),
        clientName: clientName.trim() || "New client",
        service: service.trim(),
        requestedTime:
          timing === "now" ? "As soon as possible" : requestedTime.trim(),
        availableStylistIds,
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
          setNotice(`${result.recommended?.name} is marked booked.`);
          setResult(null);
          setClientName("");
          setService("");
          setRequestedTime("");
          setNotes("");
          setAvailableStylistIds([]);
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
        reason: "Busy or unavailable — turn preserved",
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
            <span className="pulse-dot" /> Up next for this service
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
                  Mark booked with {result.recommended.name}
                </Button>
                {result.backup ? (
                  <Button
                    variant="outline"
                    className="h-12"
                    onClick={chooseBackup}
                    disabled={useBackup.isPending}
                  >
                    <RotateCcw /> Can’t take it — keep place, show{" "}
                    {result.backup.name}
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
        <p className="eyebrow">Stylist rotation</p>
        <h1 id="route-heading">Who’s up next?</h1>
        <p>
          See the live order, then check the service before marking someone
          booked.
        </p>
      </div>
      <section
        className="rotation-board"
        aria-labelledby="rotation-board-heading"
      >
        <div className="rotation-board-header">
          <div>
            <p className="eyebrow">General rotation</p>
            <h2 id="rotation-board-heading">
              {rotation[0]
                ? `${rotation[0].name} is first in line`
                : "No stylists in rotation"}
            </h2>
          </div>
          <span className="availability-chip">
            {rotation[0] ? "Saved order" : "Check team"}
          </span>
        </div>
        {rotation[0] ? (
          <>
            <div className="rotation-lead">
              <div className="avatar avatar-large">
                {initials(rotation[0].name)}
              </div>
              <div>
                <strong>{rotation[0].name}</strong>
                <span>
                  Front of the rotation · keeps this place until booked
                </span>
              </div>
              <small>{rotation[0].assignments.toString()} booked</small>
            </div>
            {rotation.length > 1 ? (
              <ol
                className="rotation-queue"
                aria-label="Next stylists in rotation"
              >
                {rotation.slice(1, 4).map((stylist, index) => (
                  <li key={stylist.id.toString()}>
                    <span>{index + 2}</span>
                    <strong>{stylist.name}</strong>
                    <small>{stylist.assignments.toString()} booked</small>
                  </li>
                ))}
              </ol>
            ) : null}
            <p className="rotation-caveat">
              Booksy determines who is free. FairChair preserves this order and
              filters it for each opportunity.
            </p>
          </>
        ) : (
          <p className="rotation-empty">
            Add an active stylist who accepts new clients to start the rotation.
          </p>
        )}
      </section>
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
        <div className="form-heading">
          <p className="eyebrow">Specific opportunity</p>
          <h2>Check the service fit</h2>
          <p>
            The client never sees this form. It helps staff confirm the fair
            next stylist.
          </p>
        </div>
        <div className="field">
          <Label htmlFor="service">What service do they want?</Label>
          <select
            id="service"
            value={service}
            onChange={(event) => {
              setService(event.target.value);
              setAvailableStylistIds([]);
            }}
            required
          >
            <option value="">
              {services.length
                ? "Choose a service"
                : "Add stylist services first"}
            </option>
            {services.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <p className="field-help">
            Only stylists who perform this service will be considered.
          </p>
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
        <fieldset className="field availability-picker">
          <legend>Who does Booksy show as free?</legend>
          <p className="field-help">
            Check Booksy for this time, then select every stylist who can take
            the client. Busy people keep their place in the rotation.
          </p>
          {!service ? (
            <div className="selection-empty">Choose a service first.</div>
          ) : capableStylists.length === 0 ? (
            <div className="selection-empty">
              No active stylist is set up to perform this service.
            </div>
          ) : (
            <div className="stylist-choices">
              {capableStylists.map((stylist) => {
                const checked = availableStylistIds.includes(stylist.id);
                const position = rotation.findIndex(
                  (candidate) => candidate.id === stylist.id,
                );
                return (
                  <button
                    key={stylist.id.toString()}
                    type="button"
                    className={cn("stylist-choice", checked && "selected")}
                    aria-pressed={checked}
                    onClick={() => toggleAvailable(stylist.id)}
                  >
                    <span className="choice-check" aria-hidden="true">
                      {checked ? <Check /> : null}
                    </span>
                    <span>
                      <strong>{stylist.name}</strong>
                      <small>#{position + 1} in the saved rotation</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
        <div className="field-grid">
          <div className="field">
            <Label htmlFor="client-name">
              Client reference <span>Optional</span>
            </Label>
            <Input
              id="client-name"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              placeholder="e.g. Maria"
              autoComplete="off"
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
        </div>
        <Button
          className="h-14 w-full text-base"
          type="submit"
          disabled={
            !service.trim() ||
            availableStylistIds.length === 0 ||
            (timing === "later" && !requestedTime) ||
            route.isPending
          }
        >
          {route.isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          {route.isPending ? "Checking the rotation…" : "Check who’s up next"}
        </Button>
        {notice ? (
          <p className="form-error" role="alert">
            {notice}
          </p>
        ) : null}
      </form>
      <div className="trust-strip" aria-label="How recommendations work">
        <span>
          <strong>1</strong> Free in Booksy
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
          <p className="eyebrow">Stylist status</p>
          <h1 id="today-heading">Booked</h1>
          <p>See who received a client and what still needs attention.</p>
        </div>
        <div className="count-card">
          <strong>{confirmed}</strong>
          <span>booked</span>
        </div>
      </div>
      {active.length === 0 ? (
        <div className="empty-panel bordered">
          <div className="empty-icon">
            <ClipboardList />
          </div>
          <h2>No bookings recorded</h2>
          <p>Once a stylist is marked booked, the assignment appears here.</p>
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
                      <span>{assigned ? "Booked with" : "Up next"}</span>
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
      availabilityStatus: "later",
      availabilityNote: "Check Booksy for live availability",
      acceptsNewClients,
      availabilityExpiresAt: 0n,
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
          Record what they love and every service they can perform. Live
          availability stays in Booksy.
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
        <div className="booksy-note">
          <CalendarClock />
          <p>
            <strong>Schedule managed in Booksy</strong>
            <br />
            Staff will select this stylist only when Booksy shows them free for
            a specific client and time.
          </p>
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
  const setActive = useSetStylistActive();
  const [editing, setEditing] = useState<Stylist | "new" | null>(null);
  const rotation = currentRotation(dashboard.stylists);
  const rotationIds = new Set(rotation.map((stylist) => stylist.id));
  const outsideRotation = dashboard.stylists
    .filter((stylist) => !rotationIds.has(stylist.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const stylists = [...rotation, ...outsideRotation];

  if (editing)
    return (
      <StylistForm
        stylist={editing === "new" ? undefined : editing}
        onDone={() => setEditing(null)}
      />
    );

  return (
    <section className="page-section" aria-labelledby="stylists-heading">
      <div className="page-intro intro-row">
        <div>
          <p className="eyebrow">Your team</p>
          <h1 id="stylists-heading">Stylists</h1>
          <p>Manage service eligibility and the saved rotation.</p>
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
          <p>Add each stylist and the services they can perform.</p>
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
            const rotationPosition = rotation.findIndex(
              (candidate) => candidate.id === stylist.id,
            );
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
                <div className="stylist-details">
                  <span>
                    <strong>
                      {rotationPosition >= 0 ? `#${rotationPosition + 1}` : "—"}
                    </strong>{" "}
                    in rotation
                  </span>
                  <span>
                    <strong>{stylist.assignments.toString()}</strong> bookings
                  </span>
                  <span>
                    <strong>
                      {
                        stylist.services.filter(
                          (item) => item.level !== "avoid",
                        ).length
                      }
                    </strong>{" "}
                    services
                  </span>
                </div>
                <div className="stylist-footer">
                  <span>
                    {stylist.acceptsNewClients
                      ? "Availability checked in Booksy"
                      : "Not accepting new clients"}
                  </span>
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
    if (
      !initialized &&
      initialize.isActorReady &&
      !initialize.isPending &&
      !initialize.isError
    ) {
      initialize.mutate(undefined, {
        onSuccess: () => setInitialized(true),
      });
    }
  }, [
    initialize.isActorReady,
    initialize.isError,
    initialize.isPending,
    initialize.mutate,
    initialized,
  ]);

  if (initialize.isError || (initialized && directory.isError)) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-mark">
            <ShieldCheck />
          </div>
          <p className="eyebrow">Access protected</p>
          <h1>This workspace is private.</h1>
          <p className="login-copy">
            We couldn’t finish opening this workspace. Sign out and try again;
            your saved records have not been changed.
          </p>
          <Button
            className="mb-2 h-12 w-full"
            onClick={() => initialize.reset()}
          >
            <RotateCcw /> Try again
          </Button>
          <Button variant="outline" className="h-12 w-full" onClick={clear}>
            <LogOut /> Sign out
          </Button>
        </section>
      </main>
    );
  }

  if (!initialized || directory.isLoading || !directory.data) {
    return (
      <main className="loading-screen">
        <LoaderCircle className="animate-spin" />
        <p>Opening your secure workspace…</p>
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
            <small>Stylist rotation</small>
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
