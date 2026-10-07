"use client";

/*
THESIS: The whole client roster becomes scannable case blocks; one opens into a full biodata sheet.
OWN-WORLD: Soft daylight paper, graphite text, one muted-teal action voice, thin rules and practical Windows-native type.
STORY: Rose searches or scans patient modules, opens one to review or correct biodata, or adds/imports new clients.
FIRST VIEWPORT: A quiet header, a search bar with Add/Import actions, and a two-column shelf of patient modules.
FORM: Modular case shelf with a wide right-side details drawer; mobile makes the drawer full-screen.
*/

import Link from "next/link";
import { Logo } from "@/components/logo";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  IdCard,
  MapPin,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ApiError,
  ImportSummary,
  MobilityStatus,
  PatientDetail,
  PatientSummary,
  PatientWrite,
  ServiceAgreementStatus,
  createPatient,
  deletePatient,
  getDeletedPatients,
  getPatient,
  getPatients,
  importPatients,
  restorePatient,
  updatePatient,
  createAppointment,
  assessAppointment,
  type AppointmentCreated,
  type AssessmentResult,
} from "@/lib/api";

type LoadState = "idle" | "loading" | "success" | "error";
type RegistryView = "active" | "deleted";
type DrawerMode =
  { kind: "add" } | { kind: "edit"; patientId: string; view: RegistryView };

const MOBILITY_OPTIONS: { value: MobilityStatus; label: string }[] = [
  { value: "unknown", label: "Not yet assessed" },
  { value: "ambulant", label: "Ambulant" },
  { value: "wheelchair_user", label: "Wheelchair user" },
  { value: "walking_frame_user", label: "Walking frame user" },
  { value: "bed_bound", label: "Bed-bound" },
];

const AGREEMENT_OPTIONS: { value: ServiceAgreementStatus; label: string }[] = [
  { value: "Y", label: "Signed" },
  { value: "Pending", label: "Pending" },
  { value: "N", label: "Not signed" },
];

function friendlyError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "We could not reach the registry service. Check that it is running, then try again.";
}

function formatDate(value: string | null) {
  if (!value) return "No visits recorded";
  return value.slice(0, 10);
}

function formatSubsidy(value: number | null) {
  if (value === null) return "Subsidy not recorded";
  return `${Math.round(value * 100)}% NMTS subsidy`;
}

export function patientDeletePhrase(name: string) {
  const slug = name
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-delete`;
}

export function PatientRegistry() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [listState, setListState] = useState<LoadState>("loading");
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [registryView, setRegistryView] = useState<RegistryView>("active");
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);

  const loadPatients = useCallback(async () => {
    setListState("loading");
    setListError("");
    try {
      setPatients(
        registryView === "deleted"
          ? await getDeletedPatients()
          : await getPatients(),
      );
      setListState("success");
    } catch (error) {
      setListError(friendlyError(error));
      setListState("error");
    }
  }, [registryView]);

  useEffect(() => {
    // Fetching the roster is the synchronization this effect owns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPatients();
  }, [loadPatients]);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return patients;
    return patients.filter(
      (patient) =>
        patient.name.toLocaleLowerCase().includes(query) ||
        (patient.nric?.toLocaleLowerCase().includes(query) ?? false) ||
        (patient.postal_code?.includes(query) ?? false),
    );
  }, [patients, search]);

  function openPatient(patientId: string) {
    openerRef.current = document.activeElement as HTMLElement;
    setDrawerMode({ kind: "edit", patientId, view: registryView });
  }

  function openAdd() {
    openerRef.current = document.activeElement as HTMLElement;
    setDrawerMode({ kind: "add" });
  }

  const closeDrawer = useCallback(() => {
    setDrawerMode(null);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }, []);

  function handleSaved() {
    closeDrawer();
    void loadPatients();
  }

  return (
    <div className="app-shell">
      <header className="product-header">
        <Link href="/" className="header-logo">
          <Logo />
        </Link>
        <nav className="header-nav" aria-label="KakiMETch sections">
          <Link href="/app/schedule">Daily schedule</Link>
          <Link href="/app/matching">Escort matching</Link>
          <Link href="/app/registry" aria-current="page">
            Patient registry
          </Link>
        </nav>
        <span className="demo-label">Demo workspace</span>
      </header>

      <main className="overview" inert={Boolean(drawerMode) || importOpen}>
        <div className="overview-heading">
          <div>
            <p className="eyebrow">Loving Heart client database</p>
            <h1>Patient registry</h1>
            <p>
              Search the client roster, review or correct a client&apos;s
              biodata, or add new clients one at a time or in bulk.
            </p>
          </div>
          <span
            className="patient-count"
            aria-label={`${patients.length} patients in the registry`}
          >
            {patients.length}{" "}
            {registryView === "deleted" ? "deleted" : "active"} patients
          </span>
        </div>

        <div className="registry-toolbar">
          <label className="search-field">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">
              Search by patient name, NRIC or postal code
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, NRIC or postal code"
            />
          </label>
          <div className="registry-actions">
            <div
              className="registry-view-toggle"
              role="tablist"
              aria-label="Registry view"
            >
              <button
                type="button"
                role="tab"
                aria-selected={registryView === "active"}
                onClick={() => setRegistryView("active")}
              >
                Active
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={registryView === "deleted"}
                onClick={() => setRegistryView("deleted")}
              >
                Deleted
              </button>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setImportOpen(true)}
            >
              <FileSpreadsheet size={18} aria-hidden="true" /> Import Excel
            </button>
            <button type="button" className="primary-button" onClick={openAdd}>
              <UserPlus size={18} aria-hidden="true" /> Add patient
            </button>
          </div>
        </div>

        <div className="patient-area" aria-live="polite">
          {listState === "loading" && <RegistrySkeleton />}
          {listState === "error" && (
            <MessageState
              kind="error"
              title="Patients could not load"
              message={listError}
              actionLabel="Try again"
              onAction={() => void loadPatients()}
            />
          )}
          {listState === "success" && patients.length === 0 && (
            <MessageState
              kind="neutral"
              title="No patients yet"
              message={
                registryView === "deleted"
                  ? "Soft-deleted patients will appear here."
                  : "Add a patient manually or import the LH master data Excel file to get started."
              }
            />
          )}
          {listState === "success" &&
            patients.length > 0 &&
            filteredPatients.length === 0 && (
              <MessageState
                kind="neutral"
                title="No patient found"
                message="Try a different name, NRIC or postal code."
              />
            )}
          {filteredPatients.length > 0 && (
            <div className="patient-grid">
              {filteredPatients.map((patient) => (
                <button
                  type="button"
                  className="patient-module"
                  key={patient.id}
                  onClick={() => openPatient(patient.id)}
                  aria-haspopup="dialog"
                >
                  <span className="module-topline">
                    <strong>{patient.name}</strong>
                  </span>
                  <div className="registry-module-body">
                    <span className="module-detail">
                      <IdCard size={19} aria-hidden="true" />
                      <span className="registry-identifier">
                        {patient.nric ?? "NRIC not recorded"}
                      </span>
                    </span>
                    <span className="module-detail">
                      <MapPin size={19} aria-hidden="true" />
                      <span>
                        {patient.postal_code ?? "Postal code not recorded"}
                      </span>
                    </span>
                    <span className="module-detail">
                      <CalendarDays size={19} aria-hidden="true" />
                      <span>
                        {registryView === "deleted"
                          ? `Deleted: ${formatDate(patient.deleted_at)}`
                          : `Last visit: ${formatDate(patient.last_visit)}`}
                      </span>
                    </span>
                  </div>
                  <span className="registry-badges">
                    <span className="registry-badge">
                      {formatSubsidy(patient.nmtr_percentage)}
                    </span>
                    {registryView === "deleted" ? (
                      <span className="registry-badge deleted">
                        Soft deleted
                      </span>
                    ) : (
                      patient.escort_required && (
                        <span className="registry-badge escort">
                          Escort required
                        </span>
                      )
                    )}
                  </span>
                  <span className="module-open">
                    {registryView === "deleted"
                      ? "View deleted record"
                      : "View biodata"}{" "}
                    <ChevronRight size={19} aria-hidden="true" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {drawerMode && (
        <>
          <button
            className="drawer-scrim"
            type="button"
            tabIndex={-1}
            onClick={closeDrawer}
            aria-label="Close patient details"
          />
          <PatientDrawer
            mode={drawerMode}
            onClose={closeDrawer}
            onSaved={handleSaved}
          />
        </>
      )}

      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImported={() => void loadPatients()}
        />
      )}
    </div>
  );
}

function PatientDrawer({
  mode,
  onClose,
  onSaved,
}: {
  mode: DrawerMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(
    mode.kind === "edit" ? "loading" : "success",
  );
  const [loadError, setLoadError] = useState("");
  const [appointmentOpen, setAppointmentOpen] = useState(false);

  const loadDetail = useCallback((patientId: string) => {
    let cancelled = false;
    setLoadState("loading");
    setLoadError("");
    getPatient(patientId)
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        setLoadState("success");
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(friendlyError(error));
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode.kind !== "edit") return;
    // Fetching the patient's full biodata is the synchronization this effect owns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    return loadDetail(mode.patientId);
  }, [mode, loadDetail]);

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
        <h2 id="drawer-title" style={{ fontSize: "1.1rem" }}>
          {mode.kind === "add"
            ? "Add new patient"
            : (detail?.name ?? "Patient")}
        </h2>
        <button
          ref={closeRef}
          type="button"
          className="close-button"
          onClick={onClose}
          aria-label="Close patient details"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      {mode.kind === "edit" && loadState === "loading" && (
        <div className="drawer-content">
          <div
            className="skeleton-stack"
            style={{ padding: 36 }}
            aria-label="Loading patient details"
          >
            {[1, 2, 3].map((item) => (
              <span className="skeleton suggestion-skeleton" key={item} />
            ))}
          </div>
        </div>
      )}

      {mode.kind === "edit" && loadState === "error" && (
        <div className="drawer-content" style={{ padding: 36 }}>
          <MessageState
            kind="error"
            title="Patient could not load"
            message={loadError}
          />
        </div>
      )}

      {mode.kind === "add" && (
        <PatientForm patientId={null} initial={null} onSaved={onSaved} />
      )}

      {mode.kind === "edit" && loadState === "success" && detail && (
        <>
          {mode.view === "deleted" ? (
            <DeletedPatientView patient={detail} onRestored={onSaved} />
          ) : !appointmentOpen ? (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setAppointmentOpen(true)}
              >
                <CalendarDays size={18} aria-hidden="true" />
                Create appointment
              </button>

              <PatientForm
                patientId={mode.patientId}
                initial={detail}
                onSaved={onSaved}
              />
            </>
          ) : (
            <CreateAppointmentForm
              patient={detail}
              onCancel={() => setAppointmentOpen(false)}
              onCreated={() => {
                setAppointmentOpen(false);
              }}
            />
          )}
        </>
      )}
    </aside>
  );
}

function DeletedPatientView({
  patient,
  onRestored,
}: {
  patient: PatientDetail;
  onRestored: () => void;
}) {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");

  async function handleRestore() {
    setState("loading");
    setError("");
    try {
      await restorePatient(patient.id);
      onRestored();
    } catch (restoreError) {
      setState("error");
      setError(friendlyError(restoreError));
    }
  }

  return (
    <div className="drawer-content">
      <section className="drawer-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Deleted record</p>
            <h3>{patient.name}</h3>
          </div>
        </div>
        <dl className="deleted-detail-list">
          <div>
            <dt>Deleted</dt>
            <dd>{formatDate(patient.deleted_at)}</dd>
          </div>
          <div>
            <dt>NRIC</dt>
            <dd>{patient.nric ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Postal code</dt>
            <dd>{patient.postal_code ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{patient.contact_no ?? "Not recorded"}</dd>
          </div>
        </dl>
      </section>
      <section className="drawer-section restore-zone">
        <div>
          <p className="eyebrow">Recover patient</p>
          <h3>Restore to active registry</h3>
          <p>
            This makes the patient visible again in registry, matching and
            scheduling workflows.
          </p>
        </div>
        {error && (
          <p className="inline-message error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="primary-button"
          onClick={handleRestore}
          disabled={state === "loading"}
        >
          <RotateCcw size={18} aria-hidden="true" />
          {state === "loading" ? "Restoring..." : "Restore patient"}
        </button>
      </section>
    </div>
  );
}

function CreateAppointmentForm({
  patient,
  onCancel,
  onCreated,
}: {
  patient: PatientDetail;
  onCancel: () => void;
  onCreated: (appointment: AppointmentCreated) => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [destination, setDestination] = useState("");
  const [returnReadyTime, setReturnReadyTime] = useState("");

  const [saveState, setSaveState] = useState<LoadState>("idle");
  const [saveError, setSaveError] = useState("");
  const [createdAppointment, setCreatedAppointment] =
    useState<AppointmentCreated | null>(null);

  const [assessmentResult, setAssessmentResult] =
    useState<AssessmentResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!date) {
      setSaveError("Appointment date is required.");
      setSaveState("error");
      return;
    }

    if (!time) {
      setSaveError("Appointment time is required.");
      setSaveState("error");
      return;
    }

    if (!destination.trim()) {
      setSaveError("Destination is required.");
      setSaveState("error");
      return;
    }

    if (!pickupAddress.trim()) {
      setSaveError("Pickup address is required for vehicle scheduling.");
      setSaveState("error");
      return;
    }

    if (!returnReadyTime) {
      setSaveError("Estimated return-ready time is required.");
      setSaveState("error");
      return;
    }

    setSaveState("loading");
    setSaveError("");

    try {
      const appointment = await createAppointment({
        elderly_id: patient.id,
        appt_date: date,
        appt_time: time,
        pickup_address: pickupAddress.trim(),
        destination: destination.trim(),
        return_ready_time: returnReadyTime,
      });

      setCreatedAppointment(appointment);

      const assessment = await assessAppointment(appointment.trip_id);

      setAssessmentResult(assessment);
      setSaveState("success");
    } catch (error) {
      setSaveState("error");
      setSaveError(friendlyError(error));
    }
  }
  if (assessmentResult && createdAppointment) {
    const accepted = assessmentResult.decision === "accepted";

    return (
      <div className="drawer-content">
        <section className="drawer-section" aria-live="polite">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Assessment complete</p>

              <h3>
                {accepted ? "Appointment accepted" : "Appointment rejected"}
              </h3>
            </div>
          </div>

          <p>
            {accepted
              ? "This appointment is eligible and ready for escort matching."
              : "This appointment cannot proceed to escort matching."}
          </p>

          <div style={{ marginTop: 20 }}>
            <p>
              <strong>Patient:</strong> {patient.name}
            </p>

            <p>
              <strong>Date:</strong> {date}
            </p>

            <p>
              <strong>Time:</strong> {time}
            </p>

            <p>
              <strong>Pickup:</strong> {pickupAddress}
            </p>

            <p>
              <strong>Destination:</strong> {destination}
            </p>

            <p>
              <strong>Estimated return-ready:</strong> {returnReadyTime}
            </p>
          </div>

          {assessmentResult.reasons.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <strong>Reasons</strong>

              <ul>
                {assessmentResult.reasons.map((reason, index) => (
                  <li key={`${reason}-${index}`}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {assessmentResult.warnings.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <strong>Warnings</strong>

              <ul>
                {assessmentResult.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-actions" style={{ marginTop: 28 }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => onCreated(createdAppointment)}
            >
              Done
            </button>
          </div>
        </section>
      </div>
    );
  }
  return (
    <form className="drawer-content" onSubmit={handleSubmit}>
      <section className="drawer-section" aria-labelledby="appointment-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">New appointment</p>
            <h3 id="appointment-heading">Appointment details</h3>
          </div>
        </div>

        <p>
          Create an appointment for <strong>{patient.name}</strong>.
        </p>

        <div className="registry-form-grid">
          <label>
            <span>Appointment date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>

          <label>
            <span>Appointment time</span>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
            />
          </label>

          <label>
            <span>Pickup address</span>
            <input
              type="text"
              value={pickupAddress}
              onChange={(event) => setPickupAddress(event.target.value)}
              placeholder="Use this appointment’s actual pickup point"
              required
            />
          </label>

          <label>
            <span>Destination</span>
            <input
              type="text"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="e.g. Ng Teng Fong General Hospital"
              required
            />
          </label>

          <label>
            <span>Estimated ready for return</span>
            <input
              type="time"
              value={returnReadyTime}
              onChange={(event) => setReturnReadyTime(event.target.value)}
              required
            />
          </label>
        </div>
      </section>

      <section className="drawer-section" style={{ borderBottom: 0 }}>
        {saveError && (
          <p className="inline-message error" role="alert">
            {saveError}
          </p>
        )}

        <div className="form-actions" style={{ marginTop: saveError ? 16 : 0 }}>
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={saveState === "loading"}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={saveState === "loading"}
          >
            {saveState === "loading" ? "Creating…" : "Create appointment"}
          </button>
        </div>
      </section>
    </form>
  );
}

interface FormState {
  name: string;
  nric: string;
  gender: "" | "M" | "F";
  date_of_birth: string;
  aic_registration_no: string;
  postal_code: string;
  block: string;
  unit: string;
  street_name: string;
  address_source: string;
  contact_no: string;
  caregiver_name: string;
  caregiver_or_maid_available: "" | "yes" | "no";
  wheelchair_required: boolean;
  walking_frame_required: boolean;
  aic_mobility_status: MobilityStatus;
  lh_mobility_status: MobilityStatus;
  escort_required: boolean;
  gender_preference: "" | "M" | "F";
  dialect: string;
  weight_kg: string;
  nmts_effective_date: string;
  nmts_expired_date: string;
  lh_service_agreement: "" | ServiceAgreementStatus;
  sw_service_agreement: "" | ServiceAgreementStatus;
  co_payment: string;
  nmtr_percentage: string;
  date_of_entry: string;
  action_updated_date: string;
}

const BLANK_FORM: FormState = {
  name: "",
  nric: "",
  gender: "",
  date_of_birth: "",
  aic_registration_no: "",
  postal_code: "",
  block: "",
  unit: "",
  street_name: "",
  address_source: "",
  contact_no: "",
  caregiver_name: "",
  caregiver_or_maid_available: "",
  wheelchair_required: false,
  walking_frame_required: false,
  aic_mobility_status: "unknown",
  lh_mobility_status: "unknown",
  escort_required: false,
  gender_preference: "",
  dialect: "",
  weight_kg: "",
  nmts_effective_date: "",
  nmts_expired_date: "",
  lh_service_agreement: "",
  sw_service_agreement: "",
  co_payment: "",
  nmtr_percentage: "",
  date_of_entry: "",
  action_updated_date: "",
};

function toFormState(detail: PatientDetail): FormState {
  return {
    name: detail.name,
    nric: detail.nric ?? "",
    gender: detail.gender ?? "",
    date_of_birth: detail.date_of_birth ?? "",
    aic_registration_no: detail.aic_registration_no ?? "",
    postal_code: detail.postal_code ?? "",
    block: detail.block ?? "",
    unit: detail.unit ?? "",
    street_name: detail.street_name ?? "",
    address_source: detail.address_source ?? "",
    contact_no: detail.contact_no ?? "",
    caregiver_name: detail.caregiver_name ?? "",
    caregiver_or_maid_available:
      detail.caregiver_or_maid_available === null
        ? ""
        : detail.caregiver_or_maid_available
          ? "yes"
          : "no",
    wheelchair_required: detail.wheelchair_required,
    walking_frame_required: detail.walking_frame_required,
    aic_mobility_status: detail.aic_mobility_status,
    lh_mobility_status: detail.lh_mobility_status,
    escort_required: detail.escort_required,
    gender_preference: detail.gender_preference ?? "",
    dialect: detail.dialect ?? "",
    weight_kg: detail.weight_kg?.toString() ?? "",
    nmts_effective_date: detail.nmts_effective_date ?? "",
    nmts_expired_date: detail.nmts_expired_date ?? "",
    lh_service_agreement: detail.lh_service_agreement ?? "",
    sw_service_agreement: detail.sw_service_agreement ?? "",
    co_payment: detail.co_payment?.toString() ?? "",
    nmtr_percentage:
      detail.nmtr_percentage !== null
        ? Math.round(detail.nmtr_percentage * 100).toString()
        : "",
    date_of_entry: detail.date_of_entry ?? "",
    action_updated_date: detail.action_updated_date ?? "",
  };
}

function toPatientWrite(form: FormState): PatientWrite {
  return {
    name: form.name.trim(),
    nric: form.nric.trim() || null,
    gender: form.gender || null,
    date_of_birth: form.date_of_birth || null,
    aic_registration_no: form.aic_registration_no.trim() || null,
    postal_code: form.postal_code.trim() || null,
    block: form.block.trim() || null,
    unit: form.unit.trim() || null,
    street_name: form.street_name.trim() || null,
    address_source: form.address_source.trim() || null,
    contact_no: form.contact_no.trim() || null,
    caregiver_name: form.caregiver_name.trim() || null,
    caregiver_or_maid_available:
      form.caregiver_or_maid_available === ""
        ? null
        : form.caregiver_or_maid_available === "yes",
    wheelchair_required: form.wheelchair_required,
    walking_frame_required: form.walking_frame_required,
    aic_mobility_status: form.aic_mobility_status,
    lh_mobility_status: form.lh_mobility_status,
    escort_required: form.escort_required,
    gender_preference: form.gender_preference || null,
    dialect: form.dialect.trim() || null,
    weight_kg: form.weight_kg.trim() ? Number(form.weight_kg) : null,
    nmts_effective_date: form.nmts_effective_date || null,
    nmts_expired_date: form.nmts_expired_date || null,
    lh_service_agreement: form.lh_service_agreement || null,
    sw_service_agreement: form.sw_service_agreement || null,
    co_payment: form.co_payment.trim() ? Number(form.co_payment) : null,
    nmtr_percentage: form.nmtr_percentage.trim()
      ? Number(form.nmtr_percentage) / 100
      : null,
    date_of_entry: form.date_of_entry || null,
    action_updated_date: form.action_updated_date.trim() || null,
  };
}

function validate(form: FormState): string | null {
  if (!form.name.trim()) return "Patient name is required.";
  if (form.weight_kg.trim()) {
    const weight = Number(form.weight_kg);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 999.99) {
      return "Enter a weight between 0.01 kg and 999.99 kg, or leave it blank.";
    }
  }
  if (form.nmtr_percentage.trim()) {
    const subsidy = Number(form.nmtr_percentage);
    if (!Number.isFinite(subsidy) || subsidy < 0 || subsidy > 100) {
      return "Enter an NMTS subsidy between 0 and 100, or leave it blank.";
    }
  }
  if (form.co_payment.trim()) {
    const coPayment = Number(form.co_payment);
    if (!Number.isFinite(coPayment) || coPayment < 0) {
      return "Enter a co-payment of 0 or more, or leave it blank.";
    }
  }
  return null;
}

function PatientForm({
  patientId,
  initial,
  onSaved,
}: {
  patientId: string | null;
  initial: PatientDetail | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    initial ? toFormState(initial) : BLANK_FORM,
  );
  const [saveState, setSaveState] = useState<LoadState>("idle");
  const [saveError, setSaveError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate(form);
    if (validationError) {
      setSaveError(validationError);
      setSaveState("error");
      return;
    }
    setSaveState("loading");
    setSaveError("");
    try {
      const payload = toPatientWrite(form);
      if (patientId) {
        await updatePatient(patientId, payload);
      } else {
        await createPatient(payload);
      }
      setSaveState("success");
      onSaved();
    } catch (error) {
      setSaveState("error");
      setSaveError(friendlyError(error));
    }
  }

  return (
    <>
      <form className="drawer-content" onSubmit={handleSubmit}>
        <section className="drawer-section" aria-labelledby="identity-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Identity</p>
              <h3 id="identity-heading">Name and identification</h3>
            </div>
          </div>
          <div className="registry-form-grid">
            <label>
              <span>Full name</span>
              <input
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label>
              <span>NRIC / IC number</span>
              <input
                value={form.nric}
                onChange={(event) => setField("nric", event.target.value)}
                maxLength={20}
              />
            </label>
            <label>
              <span>Gender</span>
              <select
                value={form.gender}
                onChange={(event) =>
                  setField("gender", event.target.value as FormState["gender"])
                }
              >
                <option value="">Not recorded</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
              </select>
            </label>
            <label>
              <span>Date of birth</span>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(event) =>
                  setField("date_of_birth", event.target.value)
                }
              />
            </label>
            <label>
              <span>AIC registration no.</span>
              <input
                value={form.aic_registration_no}
                onChange={(event) =>
                  setField("aic_registration_no", event.target.value)
                }
                maxLength={50}
              />
            </label>
          </div>
        </section>

        <section className="drawer-section" aria-labelledby="address-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Where they live</p>
              <h3 id="address-heading">Address</h3>
            </div>
          </div>
          <div className="registry-form-grid">
            <label>
              <span>Postal code</span>
              <input
                value={form.postal_code}
                onChange={(event) =>
                  setField("postal_code", event.target.value)
                }
                maxLength={6}
                inputMode="numeric"
              />
            </label>
            <label>
              <span>Block</span>
              <input
                value={form.block}
                onChange={(event) => setField("block", event.target.value)}
                maxLength={20}
              />
            </label>
            <label>
              <span>Unit</span>
              <input
                value={form.unit}
                onChange={(event) => setField("unit", event.target.value)}
                maxLength={20}
              />
            </label>
            <label>
              <span>Street name</span>
              <input
                value={form.street_name}
                onChange={(event) =>
                  setField("street_name", event.target.value)
                }
                maxLength={200}
              />
            </label>
            <label>
              <span>Address source</span>
              <input
                value={form.address_source}
                onChange={(event) =>
                  setField("address_source", event.target.value)
                }
                maxLength={200}
              />
            </label>
          </div>
        </section>

        <section className="drawer-section" aria-labelledby="contact-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Getting in touch</p>
              <h3 id="contact-heading">Contact and caregiver</h3>
            </div>
          </div>
          <div className="registry-form-grid">
            <label>
              <span>Contact number</span>
              <input
                value={form.contact_no}
                onChange={(event) => setField("contact_no", event.target.value)}
                maxLength={30}
              />
            </label>
            <label>
              <span>Caregiver name</span>
              <input
                value={form.caregiver_name}
                onChange={(event) =>
                  setField("caregiver_name", event.target.value)
                }
                maxLength={200}
              />
            </label>
            <label>
              <span>Caregiver or maid available</span>
              <select
                value={form.caregiver_or_maid_available}
                onChange={(event) =>
                  setField(
                    "caregiver_or_maid_available",
                    event.target
                      .value as FormState["caregiver_or_maid_available"],
                  )
                }
              >
                <option value="">Not recorded</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>
        </section>

        <section className="drawer-section" aria-labelledby="mobility-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Care needs</p>
              <h3 id="mobility-heading">Mobility and equipment</h3>
            </div>
          </div>
          <div className="registry-form-grid">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.wheelchair_required}
                onChange={(event) =>
                  setField("wheelchair_required", event.target.checked)
                }
              />
              <span>Wheelchair required</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.walking_frame_required}
                onChange={(event) =>
                  setField("walking_frame_required", event.target.checked)
                }
              />
              <span>Walking frame / stick required</span>
            </label>
            <label>
              <span>AIC-reported mobility status</span>
              <select
                value={form.aic_mobility_status}
                onChange={(event) =>
                  setField(
                    "aic_mobility_status",
                    event.target.value as MobilityStatus,
                  )
                }
              >
                {MOBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>LH-assessed mobility status</span>
              <select
                value={form.lh_mobility_status}
                onChange={(event) =>
                  setField(
                    "lh_mobility_status",
                    event.target.value as MobilityStatus,
                  )
                }
              >
                {MOBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="drawer-section" aria-labelledby="matching-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Escort matching inputs</p>
              <h3 id="matching-heading">Escort and preferences</h3>
            </div>
          </div>
          <div className="registry-form-grid">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.escort_required}
                onChange={(event) =>
                  setField("escort_required", event.target.checked)
                }
              />
              <span>Escort required</span>
            </label>
            <label>
              <span>Escort gender preference</span>
              <select
                value={form.gender_preference}
                onChange={(event) =>
                  setField(
                    "gender_preference",
                    event.target.value as FormState["gender_preference"],
                  )
                }
              >
                <option value="">No preference</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
              </select>
            </label>
            <label>
              <span>Dialect</span>
              <input
                value={form.dialect}
                onChange={(event) => setField("dialect", event.target.value)}
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
                value={form.weight_kg}
                onChange={(event) => setField("weight_kg", event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
        </section>

        <section className="drawer-section" aria-labelledby="agreement-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Certification and funding</p>
              <h3 id="agreement-heading">NMTS and service agreements</h3>
            </div>
          </div>
          <div className="registry-form-grid">
            <label>
              <span>NMTS effective date</span>
              <input
                type="date"
                value={form.nmts_effective_date}
                onChange={(event) =>
                  setField("nmts_effective_date", event.target.value)
                }
              />
            </label>
            <label>
              <span>NMTS expiry date</span>
              <input
                type="date"
                value={form.nmts_expired_date}
                onChange={(event) =>
                  setField("nmts_expired_date", event.target.value)
                }
              />
            </label>
            <label>
              <span>LH service agreement</span>
              <select
                value={form.lh_service_agreement}
                onChange={(event) =>
                  setField(
                    "lh_service_agreement",
                    event.target.value as FormState["lh_service_agreement"],
                  )
                }
              >
                <option value="">Not recorded</option>
                {AGREEMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>SW service agreement</span>
              <select
                value={form.sw_service_agreement}
                onChange={(event) =>
                  setField(
                    "sw_service_agreement",
                    event.target.value as FormState["sw_service_agreement"],
                  )
                }
              >
                <option value="">Not recorded</option>
                {AGREEMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>NMTS subsidy (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.nmtr_percentage}
                onChange={(event) =>
                  setField("nmtr_percentage", event.target.value)
                }
                placeholder="e.g. 95"
              />
            </label>
            <label>
              <span>Co-payment ($)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.co_payment}
                onChange={(event) => setField("co_payment", event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              <span>Date of entry</span>
              <input
                type="date"
                value={form.date_of_entry}
                onChange={(event) =>
                  setField("date_of_entry", event.target.value)
                }
              />
            </label>
            <label>
              <span>Action / updated date note</span>
              <input
                value={form.action_updated_date}
                onChange={(event) =>
                  setField("action_updated_date", event.target.value)
                }
                maxLength={200}
              />
            </label>
          </div>
        </section>

        <section className="drawer-section" style={{ borderBottom: 0 }}>
          {saveError && (
            <p className="inline-message error" role="alert">
              {saveError}
            </p>
          )}
          <div
            className="form-actions"
            style={{ marginTop: saveError ? 16 : 0 }}
          >
            <button
              type="submit"
              className="primary-button"
              disabled={saveState === "loading"}
            >
              {saveState === "loading"
                ? "Saving…"
                : patientId
                  ? "Save changes"
                  : "Add patient"}
            </button>
          </div>
        </section>

        {patientId && initial && (
          <section className="drawer-section danger-zone">
            <div>
              <p className="eyebrow">Remove patient</p>
              <h3>Delete patient record</h3>
              <p>
                This hides the patient from active registry and matching views,
                while keeping the record for audit history.
              </p>
            </div>
            <button
              type="button"
              className="secondary-button danger-button"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
              Delete patient
            </button>
          </section>
        )}
      </form>

      {patientId && initial && deleteOpen && (
        <DeletePatientModal
          patient={initial}
          onClose={() => setDeleteOpen(false)}
          onDeleted={onSaved}
        />
      )}
    </>
  );
}

function DeletePatientModal({
  patient,
  onClose,
  onDeleted,
}: {
  patient: PatientDetail;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const phrase = patientDeletePhrase(patient.name);
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const canDelete = confirmation.trim().toLocaleLowerCase() === phrase;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleDelete() {
    setState("loading");
    setError("");
    try {
      await deletePatient(patient.id);
      onDeleted();
    } catch (deleteError) {
      setState("error");
      setError(friendlyError(deleteError));
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-patient-title"
      >
        <h2 id="delete-patient-title">Delete {patient.name}</h2>
        <p className="delete-warning">
          <strong>WARNING</strong> This action cannot be undone. The patient
          will be removed from active registry and matching views; to use this
          patient again, you will need to add a new patient record.
        </p>
        <label className="delete-confirm-field">
          <span>
            Type <strong>{phrase}</strong> to confirm.
          </span>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoFocus
          />
        </label>
        {state === "error" && (
          <p className="inline-message error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={state === "loading"}
          >
            Cancel
          </button>
          <button
            type="button"
            className="secondary-button danger-button"
            onClick={handleDelete}
            disabled={!canDelete || state === "loading"}
          >
            {state === "loading" ? "Deleting..." : "Delete patient"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a .xlsx file to import.");
      setState("error");
      return;
    }
    setState("loading");
    setError("");
    try {
      const result = await importPatients(file);
      setSummary(result);
      setState("success");
      onImported();
    } catch (importError) {
      setState("error");
      setError(friendlyError(importError));
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="modal-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
      >
        {summary ? (
          <div role="status">
            <span className="confirmation-icon">
              <CheckCircle2 size={30} aria-hidden="true" />
            </span>
            <h2 id="import-title">Import complete</h2>
            <p>
              Imported {summary.imported_count} patient
              {summary.imported_count === 1 ? "" : "s"}
              {summary.skipped_count > 0
                ? ` (${summary.skipped_count} row${summary.skipped_count === 1 ? "" : "s"} skipped for missing a name).`
                : "."}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 id="import-title">Import Excel</h2>
            <p>
              Upload the LH master data workbook (.xlsx) to add or update many
              patients at once.
            </p>
            <label className="file-field">
              <span>Excel file</span>
              <input
                type="file"
                accept=".xlsx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {state === "error" && (
              <p className="inline-message error" role="alert">
                <AlertCircle
                  size={16}
                  aria-hidden="true"
                  style={{ verticalAlign: "-2px", marginRight: 6 }}
                />
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={state === "loading"}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={state === "loading"}
              >
                {state === "loading" ? "Importing…" : "Import"}
              </button>
            </div>
          </form>
        )}
      </div>
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

function RegistrySkeleton() {
  return (
    <div className="patient-grid" aria-label="Loading patients">
      {[1, 2, 3, 4].map((item) => (
        <span className="skeleton patient-skeleton" key={item} />
      ))}
    </div>
  );
}
