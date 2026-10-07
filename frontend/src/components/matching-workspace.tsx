"use client";

/*
THESIS: Patient case blocks replace one overwhelming spreadsheet; only the chosen case expands.
OWN-WORLD: Soft daylight paper, graphite text, one muted-teal action voice, thin rules and practical Windows-native type.
STORY: Rose scans a few self-contained patient modules, opens one, reviews explainable matches and confirms one escort herself.
FIRST VIEWPORT: A quiet header and two-column shelf of patient modules; name, appointment and destination are the only front-facing facts.
FORM: Modular case shelf with a wide right-side details drawer; mobile makes the drawer full-screen.
*/

import Link from "next/link";
import { Logo } from "@/components/logo";
import {
  AlertCircle,
  Accessibility,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Languages,
  MapPin,
  Pencil,
  RefreshCw,
  Search,
  UserRound,
  Weight,
  X,
} from "lucide-react";
import {
  FormEvent,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ApiError,
  EscortOption,
  EscortSuggestion,
  GenderPreference,
  MatchingQueueItem,
  ScheduledTrip,
  cancelAssignment,
  confirmEscort,
  getEscortOptions,
  getEscortSuggestions,
  getMatchingQueue,
  getScheduledTrips,
  updateMatchingProfile,
} from "@/lib/api";

type LoadState = "idle" | "loading" | "success" | "error";
type WorkspaceView = "unmatched" | "matched";

type CaseTrip = MatchingQueueItem & {
  escort_id?: string;
  escort_name?: string;
};

interface ConfirmationResult {
  trip: CaseTrip;
  escortId: string;
  escortName: string;
  override: boolean;
}

function toQueueItem(trip: CaseTrip): MatchingQueueItem {
  const {
    trip_id,
    elderly_id,
    elderly_name,
    appt_date,
    appt_time,
    destination,
    dialect,
    weight_kg,
    gender_preference,
    wheelchair_required,
  } = trip;
  return {
    trip_id,
    elderly_id,
    elderly_name,
    appt_date,
    appt_time,
    destination,
    dialect,
    weight_kg,
    gender_preference,
    wheelchair_required,
  };
}

function formatDate(value: string) {
  return value.slice(0, 10);
}

function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-SG", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hour, minute));
}

function friendlyError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "We could not reach the matching service. Check that it is running, then try again.";
}

function isOverdue(trip: MatchingQueueItem) {
  return new Date(`${trip.appt_date}T${trip.appt_time}`) < new Date();
}

export function MatchingWorkspace() {
  const [queue, setQueue] = useState<MatchingQueueItem[]>([]);
  const [queueState, setQueueState] = useState<LoadState>("loading");
  const [queueError, setQueueError] = useState("");
  const [scheduledTrips, setScheduledTrips] = useState<ScheduledTrip[]>([]);
  const [scheduleState, setScheduleState] = useState<LoadState>("idle");
  const [scheduleError, setScheduleError] = useState("");
  const [activeView, setActiveView] = useState<WorkspaceView>("unmatched");
  const [search, setSearch] = useState("");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null,
  );
  const openerRef = useRef<HTMLElement | null>(null);

  const loadQueue = useCallback(async () => {
    setQueueState("loading");
    setQueueError("");
    try {
      setQueue(await getMatchingQueue());
      setQueueState("success");
    } catch (error) {
      setQueueError(friendlyError(error));
      setQueueState("error");
    }
  }, []);

  useEffect(() => {
    // Fetching the external queue is the synchronization this effect owns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadQueue();
  }, [loadQueue]);

  const loadSchedule = useCallback(async () => {
    setScheduleState("loading");
    setScheduleError("");
    try {
      setScheduledTrips(await getScheduledTrips());
      setScheduleState("success");
    } catch (error) {
      setScheduleError(friendlyError(error));
      setScheduleState("error");
    }
  }, []);

  const selectedTrip: CaseTrip | null =
    queue.find((trip) => trip.trip_id === selectedTripId) ??
    scheduledTrips.find((trip) => trip.trip_id === selectedTripId) ??
    null;
  const activeTrip = selectedTrip ?? confirmation?.trip ?? null;
  const filteredQueue = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return queue;
    return queue.filter(
      (trip) =>
        trip.elderly_name.toLocaleLowerCase().includes(query) ||
        trip.destination.toLocaleLowerCase().includes(query),
    );
  }, [queue, search]);
  const filteredSchedule = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return scheduledTrips;
    return scheduledTrips.filter(
      (trip) =>
        trip.elderly_name.toLocaleLowerCase().includes(query) ||
        trip.escort_name.toLocaleLowerCase().includes(query) ||
        trip.destination.toLocaleLowerCase().includes(query),
    );
  }, [scheduledTrips, search]);

  function changeView(view: WorkspaceView) {
    setActiveView(view);
    setSearch("");
    if (view === "matched" && scheduleState === "idle") void loadSchedule();
  }

  function openTrip(tripId: string) {
    openerRef.current = document.activeElement as HTMLElement;
    setConfirmation(null);
    setSelectedTripId(tripId);
  }

  const closeDrawer = useCallback(() => {
    setSelectedTripId(null);
    setConfirmation(null);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }, []);

  function updateTrip(updated: CaseTrip) {
    setQueue((current) =>
      current.map((trip) =>
        trip.trip_id === updated.trip_id ? toQueueItem(updated) : trip,
      ),
    );
    setScheduledTrips((current) =>
      current.map((trip) =>
        trip.trip_id === updated.trip_id
          ? { ...trip, ...toQueueItem(updated) }
          : trip,
      ),
    );
  }

  function completeMatch(result: ConfirmationResult) {
    setQueue((current) =>
      current.filter((trip) => trip.trip_id !== result.trip.trip_id),
    );
    setScheduledTrips((current) => [
      {
        ...toQueueItem(result.trip),
        escort_id: result.escortId,
        escort_name: result.escortName,
      },
      ...current.filter((trip) => trip.trip_id !== result.trip.trip_id),
    ]);
    setScheduleState("success");
    setConfirmation(result);
  }

  function cancelMatch(trip: CaseTrip) {
    setScheduledTrips((current) =>
      current.filter((item) => item.trip_id !== trip.trip_id),
    );
    setQueue((current) => [
      toQueueItem(trip),
      ...current.filter((item) => item.trip_id !== trip.trip_id),
    ]);
    closeDrawer();
  }

  return (
    <div className="app-shell">
      <header className="product-header">
        <Link href="/" className="header-logo">
          <Logo />
        </Link>
        <nav className="header-nav" aria-label="KakiMETch sections">
          <Link href="/app/schedule">Daily schedule</Link>
          <Link href="/app/matching" aria-current="page">
            Escort matching
          </Link>
          <Link href="/app/registry">Patient registry</Link>
        </nav>
        <span className="demo-label">Demo workspace</span>
      </header>

      <main className="overview" inert={Boolean(activeTrip)}>
        <div
          className="workspace-tabs"
          role="tablist"
          aria-label="Escort matching views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "unmatched"}
            aria-controls="unmatched-panel"
            id="unmatched-tab"
            onClick={() => changeView("unmatched")}
          >
            Needs matching <span>{queue.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "matched"}
            aria-controls="matched-panel"
            id="matched-tab"
            onClick={() => changeView("matched")}
          >
            Existing matches <span>{scheduledTrips.length}</span>
          </button>
        </div>

        <div className="overview-heading">
          <div>
            <p className="eyebrow">
              {activeView === "unmatched"
                ? "Accepted appointments"
                : "Confirmed assignments"}
            </p>
            <h1>
              {activeView === "unmatched"
                ? "Patients needing an escort"
                : "Existing patient–escort matches"}
            </h1>
            <p>
              {activeView === "unmatched"
                ? "Open one patient to review their needs and choose an escort."
                : "Review appointments that already have a confirmed escort."}
            </p>
          </div>
          <span
            className="patient-count"
            aria-label={
              activeView === "unmatched"
                ? `${queue.length} patients waiting`
                : `${scheduledTrips.length} existing matches`
            }
          >
            {activeView === "unmatched"
              ? `${queue.length} waiting`
              : `${scheduledTrips.length} matched`}
          </span>
        </div>

        <label className="search-field">
          <Search size={20} aria-hidden="true" />
          <span className="sr-only">
            {activeView === "unmatched"
              ? "Search patients or destinations"
              : "Search patients, escorts or destinations"}
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              activeView === "unmatched"
                ? "Search by patient or destination"
                : "Search by patient, escort or destination"
            }
          />
        </label>

        {activeView === "unmatched" ? (
          <div
            className="patient-area"
            id="unmatched-panel"
            role="tabpanel"
            aria-labelledby="unmatched-tab"
            aria-live="polite"
          >
            {queueState === "loading" && <PatientSkeleton />}
            {queueState === "error" && (
              <MessageState
                kind="error"
                title="Patients could not load"
                message={queueError}
                actionLabel="Try again"
                onAction={() => void loadQueue()}
              />
            )}
            {queueState === "success" && queue.length === 0 && (
              <MessageState
                kind="success"
                title="All caught up"
                message="There are no accepted appointments waiting for an escort."
              />
            )}
            {queueState === "success" &&
              queue.length > 0 &&
              filteredQueue.length === 0 && (
                <MessageState
                  kind="neutral"
                  title="No patient found"
                  message="Try a different name or destination."
                />
              )}
            {filteredQueue.length > 0 && (
              <div className="patient-grid">
                {filteredQueue.map((trip) => (
                  <button
                    type="button"
                    className="patient-module"
                    key={trip.trip_id}
                    onClick={() => openTrip(trip.trip_id)}
                    aria-haspopup="dialog"
                  >
                    <span className="module-topline">
                      <strong>{trip.elderly_name}</strong>
                      {isOverdue(trip) && (
                        <span className="quiet-status overdue">Overdue</span>
                      )}
                    </span>
                    <span className="module-detail">
                      <CalendarDays size={19} aria-hidden="true" />
                      <span>
                        {formatDate(trip.appt_date)} at{" "}
                        {formatTime(trip.appt_time)}
                      </span>
                    </span>
                    <span className="module-detail">
                      <MapPin size={19} aria-hidden="true" />
                      <span>{trip.destination}</span>
                    </span>
                    <span className="module-open">
                      View matching details{" "}
                      <ChevronRight size={19} aria-hidden="true" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="patient-area"
            id="matched-panel"
            role="tabpanel"
            aria-labelledby="matched-tab"
            aria-live="polite"
          >
            {scheduleState === "loading" && <PatientSkeleton />}
            {scheduleState === "error" && (
              <MessageState
                kind="error"
                title="Existing matches could not load"
                message={scheduleError}
                actionLabel="Try again"
                onAction={() => void loadSchedule()}
              />
            )}
            {scheduleState === "success" && scheduledTrips.length === 0 && (
              <MessageState
                kind="neutral"
                title="No existing matches yet"
                message="Confirmed patient–escort assignments will appear here."
              />
            )}
            {scheduleState === "success" &&
              scheduledTrips.length > 0 &&
              filteredSchedule.length === 0 && (
                <MessageState
                  kind="neutral"
                  title="No match found"
                  message="Try a different patient, escort or destination."
                />
              )}
            {filteredSchedule.length > 0 && (
              <div className="patient-grid">
                {filteredSchedule.map((trip) => (
                  <button
                    type="button"
                    className="existing-module patient-module"
                    key={trip.trip_id}
                    onClick={() => openTrip(trip.trip_id)}
                    aria-haspopup="dialog"
                  >
                    <span className="module-topline">
                      <strong>{trip.elderly_name}</strong>
                      <span className="quiet-status matched">Matched</span>
                    </span>
                    <span className="escort-assignment">
                      <UserRound size={19} aria-hidden="true" />
                      <span>
                        <small>Escort</small>
                        <strong>{trip.escort_name}</strong>
                      </span>
                    </span>
                    <span className="module-detail">
                      <CalendarDays size={19} aria-hidden="true" />
                      <span>
                        {formatDate(trip.appt_date)} at{" "}
                        {formatTime(trip.appt_time)}
                      </span>
                    </span>
                    <span className="module-detail">
                      <MapPin size={19} aria-hidden="true" />
                      <span>{trip.destination}</span>
                    </span>
                    <span className="module-open">
                      View matching details{" "}
                      <ChevronRight size={19} aria-hidden="true" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {activeTrip && (
        <>
          <button
            className="drawer-scrim"
            type="button"
            tabIndex={-1}
            onClick={closeDrawer}
            aria-label="Close patient details"
          />
          <PatientDrawer
            trip={activeTrip}
            confirmation={confirmation}
            onClose={closeDrawer}
            onUpdate={updateTrip}
            onComplete={completeMatch}
            onCancel={cancelMatch}
          />
        </>
      )}
    </div>
  );
}

function PatientDrawer({
  trip,
  confirmation,
  onClose,
  onUpdate,
  onComplete,
  onCancel,
}: {
  trip: CaseTrip;
  confirmation: ConfirmationResult | null;
  onClose: () => void;
  onUpdate: (trip: CaseTrip) => void;
  onComplete: (result: ConfirmationResult) => void;
  onCancel: (trip: CaseTrip) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <aside
      ref={drawerRef}
      className="patient-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <header className="drawer-header">
        <button
          ref={closeRef}
          type="button"
          className="back-button"
          onClick={onClose}
        >
          <ArrowLeft size={20} aria-hidden="true" /> All patients
        </button>
        <button
          type="button"
          className="close-button"
          onClick={onClose}
          aria-label="Close patient details"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      {confirmation ? (
        <ConfirmationView result={confirmation} onClose={onClose} />
      ) : (
        <MatchingCase
          trip={trip}
          onUpdate={onUpdate}
          onComplete={onComplete}
          onCancel={onCancel}
        />
      )}
    </aside>
  );
}

function MatchingCase({
  trip,
  onUpdate,
  onComplete,
  onCancel,
}: {
  trip: CaseTrip;
  onUpdate: (trip: CaseTrip) => void;
  onComplete: (result: ConfirmationResult) => void;
  onCancel: (trip: CaseTrip) => void;
}) {
  const [suggestions, setSuggestions] = useState<EscortSuggestion[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [suggestionState, setSuggestionState] = useState<LoadState>("loading");
  const [suggestionError, setSuggestionError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedEscortId, setSelectedEscortId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<LoadState>("idle");
  const [confirmError, setConfirmError] = useState("");
  const [lateIssues, setLateIssues] = useState<string[]>([]);
  const [overrideMode, setOverrideMode] = useState(false);
  const [options, setOptions] = useState<EscortOption[]>([]);
  const [optionsState, setOptionsState] = useState<LoadState>("idle");
  const [optionsError, setOptionsError] = useState("");
  const [selectedOverrideId, setSelectedOverrideId] = useState<string | null>(
    null,
  );
  const [overrideReason, setOverrideReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [cancelState, setCancelState] = useState<LoadState>("idle");
  const [cancelError, setCancelError] = useState("");
  const [profileState, setProfileState] = useState<LoadState>("idle");
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [dialect, setDialect] = useState(trip.dialect ?? "");
  const [weight, setWeight] = useState(trip.weight_kg?.toString() ?? "");
  const [genderPreference, setGenderPreference] = useState<
    GenderPreference | ""
  >(trip.gender_preference ?? "");

  const loadSuggestions = useCallback(async () => {
    setSuggestionState("loading");
    setSuggestionError("");
    setWarning(null);
    setSelectedEscortId(null);
    setConfirmError("");
    setLateIssues([]);
    setOverrideMode(false);
    setSelectedOverrideId(null);
    setOverrideReason("");
    try {
      const result = await getEscortSuggestions(trip.trip_id);
      setSuggestions(result.suggestions);
      setWarning(result.warning);
      setSuggestionState("success");
      if (result.suggestions.length === 0 && result.warning)
        setOverrideMode(true);
    } catch (error) {
      setSuggestionError(friendlyError(error));
      setSuggestionState("error");
    }
  }, [trip.trip_id]);

  useEffect(() => {
    // Fetching suggestions is the synchronization this effect owns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSuggestions();
  }, [loadSuggestions, refreshKey]);

  const loadOptions = useCallback(async () => {
    setOptionsState("loading");
    setOptionsError("");
    try {
      setOptions(await getEscortOptions(trip.trip_id));
      setOptionsState("success");
    } catch (error) {
      setOptionsError(friendlyError(error));
      setOptionsState("error");
    }
  }, [trip.trip_id]);

  useEffect(() => {
    // The override roster is fetched only after the exceptional path opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (overrideMode) void loadOptions();
  }, [loadOptions, overrideMode]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    const parsedWeight = weight.trim() ? Number(weight) : null;
    if (
      parsedWeight !== null &&
      (!Number.isFinite(parsedWeight) ||
        parsedWeight <= 0 ||
        parsedWeight > 999.99)
    ) {
      setProfileError(
        "Enter a weight between 0.01 kg and 999.99 kg, or leave it blank.",
      );
      return;
    }
    setProfileState("loading");
    try {
      const profile = await updateMatchingProfile(trip.elderly_id, {
        dialect: dialect.trim() || null,
        weight_kg: parsedWeight,
        gender_preference: genderPreference || null,
      });
      onUpdate({
        ...trip,
        dialect: profile.dialect,
        weight_kg: profile.weight_kg,
        gender_preference: profile.gender_preference,
      });
      setProfileState("success");
      setEditing(false);
      setProfileNotice("Details saved. Suggestions have been refreshed.");
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setProfileState("error");
      setProfileError(friendlyError(error));
    }
  }

  async function confirmStandard() {
    const selected = suggestions.find(
      (item) => item.escort_id === selectedEscortId,
    );
    if (!selected) return;
    setConfirmState("loading");
    setConfirmError("");
    try {
      await confirmEscort(trip.trip_id, selected.escort_id);
      onComplete({
        trip,
        escortId: selected.escort_id,
        escortName: selected.name,
        override: false,
      });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.issues.length > 0
      ) {
        setLateIssues(error.issues);
        setSelectedOverrideId(selected.escort_id);
        setOverrideMode(true);
        setConfirmError(
          "This escort's availability changed. Review the issue before overriding.",
        );
      } else {
        setConfirmError(friendlyError(error));
      }
      setConfirmState("error");
    }
  }

  async function confirmOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = options.find(
      (item) => item.escort_id === selectedOverrideId,
    );
    if (!selected || !overrideReason.trim()) return;
    setConfirmState("loading");
    setConfirmError("");
    try {
      await confirmEscort(
        trip.trip_id,
        selected.escort_id,
        overrideReason.trim(),
      );
      onComplete({
        trip,
        escortId: selected.escort_id,
        escortName: selected.name,
        override: true,
      });
    } catch (error) {
      setConfirmState("error");
      setConfirmError(friendlyError(error));
    }
  }

  async function cancelCurrentAssignment() {
    setCancelState("loading");
    setCancelError("");
    try {
      await cancelAssignment(trip.trip_id);
      onCancel(trip);
    } catch (error) {
      setCancelState("error");
      setCancelError(friendlyError(error));
    }
  }

  const selectedSuggestion = suggestions.find(
    (item) => item.escort_id === selectedEscortId,
  );

  return (
    <div className="drawer-content">
      <section className="patient-identity">
        <span className="accepted-label">
          <Check size={15} aria-hidden="true" /> Accepted referral
        </span>
        <h2 id="drawer-title">{trip.elderly_name}</h2>
        <dl className="appointment-summary">
          <div>
            <dt>
              <CalendarDays size={18} aria-hidden="true" /> Appointment
            </dt>
            <dd>
              {formatDate(trip.appt_date)} at {formatTime(trip.appt_time)}
            </dd>
          </div>
          <div>
            <dt>
              <MapPin size={18} aria-hidden="true" /> Destination
            </dt>
            <dd>{trip.destination}</dd>
          </div>
        </dl>
      </section>

      <section className="drawer-section" aria-labelledby="needs-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Patient details</p>
            <h3 id="needs-heading">Matching needs</h3>
          </div>
          {!editing && (
            <button
              type="button"
              className="text-button"
              onClick={() => setEditing(true)}
            >
              <Pencil size={17} aria-hidden="true" /> Edit
            </button>
          )}
        </div>
        {editing ? (
          <form className="profile-form" onSubmit={saveProfile}>
            <label>
              <span>Dialect</span>
              <input
                value={dialect}
                onChange={(event) => setDialect(event.target.value)}
                maxLength={100}
                placeholder="e.g. Hokkien"
              />
            </label>
            <label>
              <span>Weight (kg)</span>
              <input
                type="number"
                min="0.01"
                max="999.99"
                step="0.01"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              <span>Escort gender preference</span>
              <select
                value={genderPreference}
                onChange={(event) =>
                  setGenderPreference(
                    event.target.value as GenderPreference | "",
                  )
                }
              >
                <option value="">No preference</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
              </select>
            </label>
            {profileError && (
              <p className="inline-message error" role="alert">
                {profileError}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={profileState === "loading"}
              >
                {profileState === "loading" ? "Saving…" : "Save and refresh"}
              </button>
            </div>
          </form>
        ) : (
          <div className="needs-list">
            <NeedRow
              icon={<Languages />}
              label="Dialect"
              value={trip.dialect || "Not recorded"}
            />
            <NeedRow
              icon={<Accessibility />}
              label="Wheelchair handling"
              value={trip.wheelchair_required ? "Required" : "Not required"}
            />
            <NeedRow
              icon={<UserRound />}
              label="Escort preference"
              value={
                trip.gender_preference === "F"
                  ? "Female"
                  : trip.gender_preference === "M"
                    ? "Male"
                    : "No preference"
              }
            />
            <NeedRow
              icon={<Weight />}
              label="Weight"
              value={trip.weight_kg ? `${trip.weight_kg} kg` : "Not recorded"}
              note="Reference only; not used in ranking"
            />
          </div>
        )}
        {profileNotice && (
          <p className="inline-message success" role="status">
            {profileNotice}
          </p>
        )}
      </section>

      {trip.escort_id && (
        <section className="drawer-section" aria-labelledby="assigned-heading">
          <div className="assigned-card">
            <span className="escort-assignment">
              <UserRound size={19} aria-hidden="true" />
              <span>
                <small>Currently assigned</small>
                <strong id="assigned-heading">{trip.escort_name}</strong>
              </span>
            </span>
            {cancelError && (
              <p className="inline-message error" role="alert">
                {cancelError}
              </p>
            )}
            <button
              type="button"
              className="secondary-button danger-button"
              onClick={() => void cancelCurrentAssignment()}
              disabled={cancelState === "loading"}
            >
              {cancelState === "loading" ? "Cancelling…" : "Cancel Assignment"}
            </button>
          </div>
        </section>
      )}

      <section className="drawer-section" aria-labelledby="suggestions-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">System suggests, you decide</p>
            <h3 id="suggestions-heading">Escort suggestions</h3>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => void loadSuggestions()}
            disabled={suggestionState === "loading"}
          >
            <RefreshCw size={17} aria-hidden="true" /> Refresh
          </button>
        </div>
        <p className="section-copy">
          Select one escort, then confirm the assignment separately.
        </p>
        {suggestionState === "loading" && <SuggestionSkeleton />}
        {suggestionState === "error" && (
          <MessageState
            kind="error"
            title="Suggestions could not load"
            message={suggestionError}
            actionLabel="Try again"
            onAction={() => void loadSuggestions()}
          />
        )}
        {suggestionState === "success" && suggestions.length > 0 && (
          <fieldset className="suggestion-list">
            <legend className="sr-only">Choose an escort</legend>
            {suggestions.map((suggestion, index) => (
              <label
                className={`suggestion-row ${selectedEscortId === suggestion.escort_id ? "selected" : ""}`}
                key={suggestion.escort_id}
              >
                <input
                  type="radio"
                  name="escort"
                  checked={selectedEscortId === suggestion.escort_id}
                  onChange={() => {
                    setSelectedEscortId(suggestion.escort_id);
                    setConfirmError("");
                  }}
                />
                <span className="escort-copy">
                  <span className="escort-name">
                    <strong>{suggestion.name}</strong>
                    <span>{suggestion.gender === "F" ? "Female" : "Male"}</span>
                    {index === 0 && (
                      <span className="top-choice">Top suggestion</span>
                    )}
                  </span>
                  <span className="reason-lines">
                    {suggestion.flairs.length ? (
                      suggestion.flairs.map((flair) => (
                        <span key={flair}>
                          <Check size={15} aria-hidden="true" />
                          {flair}
                        </span>
                      ))
                    ) : (
                      <span>
                        <Check size={15} aria-hidden="true" />
                        Available at this time
                      </span>
                    )}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {suggestions.length > 0 && !overrideMode && (
          <div className="confirm-area">
            <div>
              <span>Your selection</span>
              <strong>
                {selectedSuggestion?.name ?? "Choose an escort above"}
              </strong>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={!selectedSuggestion || confirmState === "loading"}
              onClick={() => void confirmStandard()}
            >
              {confirmState === "loading"
                ? "Confirming…"
                : selectedSuggestion
                  ? `Confirm ${selectedSuggestion.name}`
                  : "Select an escort first"}
            </button>
          </div>
        )}
        {confirmError && !overrideMode && (
          <p className="inline-message error" role="alert">
            {confirmError}
          </p>
        )}
        {overrideMode && (
          <OverrideSection
            warning={
              lateIssues.length
                ? "This escort now has a conflict."
                : (warning ?? "No escort meets every requirement.")
            }
            lateIssues={lateIssues}
            options={options}
            state={optionsState}
            error={optionsError}
            selectedId={selectedOverrideId}
            reason={overrideReason}
            confirmError={confirmError}
            confirming={confirmState === "loading"}
            onSelect={setSelectedOverrideId}
            onReason={setOverrideReason}
            onRetry={() => void loadOptions()}
            onSubmit={confirmOverride}
          />
        )}
      </section>
    </div>
  );
}

function NeedRow({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactElement;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="need-row">
      <span className="need-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <span className="need-label">{label}</span>
        <span className="need-value">{value}</span>
        {note && <small>{note}</small>}
      </div>
    </div>
  );
}

function OverrideSection({
  warning,
  lateIssues,
  options,
  state,
  error,
  selectedId,
  reason,
  confirmError,
  confirming,
  onSelect,
  onReason,
  onRetry,
  onSubmit,
}: {
  warning: string;
  lateIssues: string[];
  options: EscortOption[];
  state: LoadState;
  error: string;
  selectedId: string | null;
  reason: string;
  confirmError: string;
  confirming: boolean;
  onSelect: (id: string) => void;
  onReason: (value: string) => void;
  onRetry: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const selected = options.find((item) => item.escort_id === selectedId);
  return (
    <div className="override-section">
      <div className="warning-message" role="alert">
        <AlertCircle size={21} aria-hidden="true" />
        <div>
          <strong>Manual review needed</strong>
          <p>{warning} You may continue only with a recorded reason.</p>
          {lateIssues.length > 0 && (
            <ul>
              {lateIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <h4>Review all escorts</h4>
      {state === "loading" && <SuggestionSkeleton />}
      {state === "error" && (
        <MessageState
          kind="error"
          title="Escort list could not load"
          message={error}
          actionLabel="Try again"
          onAction={onRetry}
        />
      )}
      {state === "success" && (
        <form onSubmit={onSubmit}>
          <fieldset className="override-list">
            <legend className="sr-only">
              Choose an escort with an override
            </legend>
            {options.map((option) => (
              <label
                className={`override-row ${selectedId === option.escort_id ? "selected" : ""}`}
                key={option.escort_id}
              >
                <input
                  type="radio"
                  name="override-escort"
                  checked={selectedId === option.escort_id}
                  onChange={() => onSelect(option.escort_id)}
                />
                <span>
                  <strong>{option.name}</strong>
                  <small>
                    {option.gender === "F" ? "Female" : "Male"} ·{" "}
                    {option.available_timeslot}
                  </small>
                  {option.issues.map((issue) => (
                    <span className="issue-line" key={issue}>
                      {issue}
                    </span>
                  ))}
                </span>
              </label>
            ))}
          </fieldset>
          <label className="reason-field">
            <span>Reason for overriding</span>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => onReason(event.target.value)}
              disabled={!selected}
              required
              placeholder="Explain why this escort can safely cover the appointment"
            />
          </label>
          {confirmError && (
            <p className="inline-message error" role="alert">
              {confirmError}
            </p>
          )}
          <button
            type="submit"
            className="warning-button"
            disabled={!selected || !reason.trim() || confirming}
          >
            {confirming
              ? "Confirming…"
              : selected
                ? `Confirm ${selected.name} with override`
                : "Select an escort first"}
          </button>
        </form>
      )}
    </div>
  );
}

function ConfirmationView({
  result,
  onClose,
}: {
  result: ConfirmationResult;
  onClose: () => void;
}) {
  return (
    <div className="confirmation-view" role="status">
      <span className="confirmation-icon">
        <CheckCircle2 size={34} aria-hidden="true" />
      </span>
      <p className="eyebrow">Escort confirmed</p>
      <h2>{result.escortName} is assigned</h2>
      <p>
        {result.trip.elderly_name} · {formatDate(result.trip.appt_date)} at{" "}
        {formatTime(result.trip.appt_time)}
      </p>
      <dl>
        <div>
          <dt>Destination</dt>
          <dd>{result.trip.destination}</dd>
        </div>
        <div>
          <dt>Assignment</dt>
          <dd>
            {result.override
              ? "Confirmed with recorded override"
              : "Confirmed from suggestions"}
          </dd>
        </div>
      </dl>
      <button type="button" className="primary-button" onClick={onClose}>
        Match next appointment
      </button>
    </div>
  );
}

function MessageState({
  kind,
  title,
  message,
  actionLabel,
  onAction,
}: {
  kind: "error" | "success" | "neutral";
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className={`message-state ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {kind === "success" ? (
        <CheckCircle2 size={28} aria-hidden="true" />
      ) : kind === "error" ? (
        <AlertCircle size={28} aria-hidden="true" />
      ) : (
        <Search size={28} aria-hidden="true" />
      )}
      <strong>{title}</strong>
      <p>{message}</p>
      {actionLabel && onAction && (
        <button type="button" className="secondary-button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function PatientSkeleton() {
  return (
    <div className="patient-grid" aria-label="Loading patients">
      {[1, 2, 3, 4].map((item) => (
        <span className="skeleton patient-skeleton" key={item} />
      ))}
    </div>
  );
}

function SuggestionSkeleton() {
  return (
    <div className="skeleton-stack" aria-label="Loading escort suggestions">
      {[1, 2, 3].map((item) => (
        <span className="skeleton suggestion-skeleton" key={item} />
      ))}
    </div>
  );
}
