"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BusFront,
  CalendarDays,
  Clock3,
  GripVertical,
  MapPin,
  Plus,
  RefreshCw,
  Route,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Logo } from "@/components/logo";
import {
  ApiError,
  PatientSummary,
  RouteAssignment,
  RoutePlan,
  ScheduleAppointment,
  assessAppointment,
  createAppointment,
  getDaySchedule,
  getPatients,
  optimiseDaySchedule,
  removeScheduleAppointment,
  saveManualPlan,
  updateReturnReadyTime,
} from "@/lib/api";

type LoadState = "loading" | "success" | "error";

function todayInSingapore() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return value.slice(0, 5);
}

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    return [error.message, ...error.issues].filter(Boolean).join(" · ");
  }
  return "The scheduling service could not be reached. Please try again.";
}

export function VehicleSchedule() {
  const [serviceDate, setServiceDate] = useState(todayInSingapore);
  const [appointments, setAppointments] = useState<ScheduleAppointment[]>([]);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [optimising, setOptimising] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draggedTripId, setDraggedTripId] = useState<string | null>(null);

  const appointmentById = useMemo(
    () =>
      new Map(
        appointments.map((appointment) => [appointment.trip_id, appointment]),
      ),
    [appointments],
  );

  const loadDay = useCallback(async () => {
    setState("loading");
    setError("");
    setNotice("");
    try {
      const day = await getDaySchedule(serviceDate);
      setAppointments(day.appointments);
      setPlan(day.plan);
      setState("success");
    } catch (loadError) {
      setError(friendlyError(loadError));
      setState("error");
    }
  }, [serviceDate]);

  useEffect(() => {
    // Fetching the selected day's schedule is the synchronization this effect owns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDay();
  }, [loadDay]);

  const assignedIds = new Set(
    plan?.lanes.flatMap((lane) =>
      lane.assignments.map((item) => item.trip_id),
    ) ?? [],
  );
  const awaitingAllocation = appointments.filter(
    (appointment) => !assignedIds.has(appointment.trip_id),
  );

  async function runOptimisation() {
    setOptimising(true);
    setError("");
    setNotice("");
    try {
      setPlan(await optimiseDaySchedule(serviceDate));
    } catch (optimiseError) {
      setError(friendlyError(optimiseError));
    } finally {
      setOptimising(false);
    }
  }

  async function persistLanes(nextPlan: RoutePlan) {
    setPlan(nextPlan);
    setSaving(true);
    setError("");
    try {
      const saved = await saveManualPlan(
        nextPlan.id,
        nextPlan.lanes.map((lane) => ({
          vehicle_id: lane.vehicle.id,
          trip_ids: lane.assignments.map((assignment) => assignment.trip_id),
        })),
      );
      setPlan(saved);
    } catch (saveError) {
      setError(friendlyError(saveError));
      await loadDay();
    } finally {
      setSaving(false);
    }
  }

  function moveAppointment(
    tripId: string,
    targetVehicleId: string,
    targetIndex: number,
  ) {
    if (!plan) return;
    let moved: RouteAssignment | undefined;
    const lanes = plan.lanes.map((lane) => {
      const match = lane.assignments.find((item) => item.trip_id === tripId);
      if (match) moved = match;
      return {
        ...lane,
        assignments: lane.assignments.filter((item) => item.trip_id !== tripId),
      };
    });
    if (!moved) return;
    const target = lanes.find((lane) => lane.vehicle.id === targetVehicleId);
    if (!target) return;
    target.assignments.splice(
      Math.min(targetIndex, target.assignments.length),
      0,
      moved,
    );
    const normalized = lanes.map((lane) => ({
      ...lane,
      assignments: lane.assignments.map((assignment, sequence) => ({
        ...assignment,
        sequence,
      })),
    }));
    void persistLanes({
      ...plan,
      status: "manually_adjusted",
      lanes: normalized,
    });
  }

  async function removeAppointment(appointment: ScheduleAppointment) {
    const confirmed = window.confirm(
      `Remove ${appointment.elderly_name}'s ${appointment.appt_time.slice(0, 5)} appointment from ${serviceDate}? This will remove it from the route plan too.`,
    );
    if (!confirmed) return;
    try {
      await removeScheduleAppointment(appointment.trip_id);
      await loadDay();
    } catch (deleteError) {
      setError(friendlyError(deleteError));
    }
  }

  async function changeReturnReadyTime(
    appointment: ScheduleAppointment,
    returnReadyTime: string,
  ) {
    try {
      await updateReturnReadyTime(appointment.trip_id, returnReadyTime);
      setAppointments((current) =>
        current.map((item) =>
          item.trip_id === appointment.trip_id
            ? { ...item, return_ready_time: returnReadyTime }
            : item,
        ),
      );
      setNotice(
        `${appointment.elderly_name}'s return-ready time was updated. Run the allocation again to refresh the route.`,
      );
    } catch (updateError) {
      setError(friendlyError(updateError));
    }
  }

  return (
    <div className="app-shell">
      <header className="product-header">
        <Link href="/" className="header-logo">
          <Logo />
        </Link>
        <nav className="header-nav" aria-label="KakiMETch sections">
          <Link href="/app/schedule" aria-current="page">
            Daily schedule
          </Link>
          <Link href="/app/matching">Escort matching</Link>
          <Link href="/app/registry">Patient registry</Link>
        </nav>
        <span className="demo-label">Demo workspace</span>
      </header>

      <main className="schedule-overview">
        <div className="schedule-title-row">
          <div>
            <p className="eyebrow">Vehicle and time availability</p>
            <h1>Daily MET schedule</h1>
            <p>
              Optimise travel time, then adjust the final allocation yourself.
            </p>
          </div>
          <div className="schedule-actions">
            <label className="date-control">
              <span>Schedule date</span>
              <input
                type="date"
                value={serviceDate}
                onChange={(event) => setServiceDate(event.target.value)}
              />
            </label>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setAddOpen(true)}
            >
              <Plus size={18} aria-hidden="true" /> Add appointment
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => void runOptimisation()}
              disabled={optimising || appointments.length === 0}
            >
              <Route size={18} aria-hidden="true" />
              {optimising
                ? "Optimising…"
                : plan
                  ? "Run again"
                  : "See allocation"}
            </button>
          </div>
        </div>

        {error && (
          <p className="schedule-alert error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="schedule-alert info" role="status">
            {notice}
          </p>
        )}
        {plan && (
          <div className="plan-summary" aria-live="polite">
            <span>
              <Route size={17} aria-hidden="true" /> {plan.total_travel_minutes}{" "}
              estimated travel minutes
            </span>
            <span>{plan.matrix_source}</span>
            <span>
              {plan.status === "manually_adjusted"
                ? "Adjusted by admin"
                : "Optimised plan"}
            </span>
            {saving && <span>Saving changes…</span>}
          </div>
        )}
        {plan?.matrix_source.startsWith("Local estimate") && (
          <p className="schedule-alert warning">
            <AlertTriangle size={18} aria-hidden="true" /> Travel times are
            prototype estimates. Add a Mapbox token before operational use.
          </p>
        )}

        {state === "loading" && (
          <div className="schedule-loading">Loading {serviceDate}…</div>
        )}
        {state === "error" && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadDay()}
          >
            <RefreshCw size={18} aria-hidden="true" /> Try again
          </button>
        )}
        {state === "success" && appointments.length === 0 && (
          <div className="schedule-empty">
            <CalendarDays size={30} aria-hidden="true" />
            <h2>No accepted appointments for {serviceDate}</h2>
            <p>Add an appointment to start the day’s vehicle plan.</p>
          </div>
        )}

        {state === "success" && awaitingAllocation.length > 0 && (
          <section
            className="unallocated-strip"
            aria-labelledby="unallocated-heading"
          >
            <div>
              <p className="eyebrow">Before optimisation</p>
              <h2 id="unallocated-heading">Awaiting allocation</h2>
            </div>
            <div className="unallocated-list">
              {awaitingAllocation.map((appointment) => (
                <AppointmentCard
                  key={appointment.trip_id}
                  appointment={appointment}
                  assignment={null}
                  onRemove={removeAppointment}
                  onReturnReadyChange={changeReturnReadyTime}
                />
              ))}
            </div>
          </section>
        )}

        {plan && (
          <div className="vehicle-swimlanes">
            {plan.lanes.map((lane) => (
              <section
                className="vehicle-lane"
                key={lane.vehicle.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedTripId)
                    moveAppointment(
                      draggedTripId,
                      lane.vehicle.id,
                      lane.assignments.length,
                    );
                  setDraggedTripId(null);
                }}
              >
                <header className="vehicle-lane-header">
                  <div className="vehicle-identity">
                    <BusFront size={24} aria-hidden="true" />
                    <div>
                      <h2>{lane.vehicle.plate_number}</h2>
                      <p>{lane.vehicle.driver_name}</p>
                    </div>
                  </div>
                  <div className="vehicle-availability">
                    <span>
                      {formatTime(lane.vehicle.available_from)}–
                      {formatTime(lane.vehicle.available_until)}
                    </span>
                    <span>
                      Up to {lane.vehicle.passenger_pair_capacity}{" "}
                      patient–escort pairs
                    </span>
                  </div>
                </header>
                <div className="lane-appointments">
                  {lane.assignments.length === 0 && (
                    <p className="lane-empty">Drop an appointment here</p>
                  )}
                  {lane.assignments.map((assignment, index) => {
                    const appointment = appointmentById.get(assignment.trip_id);
                    if (!appointment) return null;
                    return (
                      <div
                        key={assignment.trip_id}
                        draggable
                        onDragStart={() => setDraggedTripId(assignment.trip_id)}
                        onDragEnd={() => setDraggedTripId(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (draggedTripId)
                            moveAppointment(
                              draggedTripId,
                              lane.vehicle.id,
                              index,
                            );
                          setDraggedTripId(null);
                        }}
                      >
                        <AppointmentCard
                          appointment={appointment}
                          assignment={assignment}
                          onRemove={removeAppointment}
                          onReturnReadyChange={changeReturnReadyTime}
                          dragHandle
                          onMoveUp={
                            index > 0
                              ? () =>
                                  moveAppointment(
                                    assignment.trip_id,
                                    lane.vehicle.id,
                                    index - 1,
                                  )
                              : undefined
                          }
                          onMoveDown={
                            index < lane.assignments.length - 1
                              ? () =>
                                  moveAppointment(
                                    assignment.trip_id,
                                    lane.vehicle.id,
                                    index + 1,
                                  )
                              : undefined
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        {plan && plan.unallocated_returns.length > 0 && (
          <p className="schedule-alert warning">
            <AlertTriangle size={18} aria-hidden="true" />{" "}
            {plan.unallocated_returns.length} return journey
            {plan.unallocated_returns.length === 1 ? "" : "s"} could not fit
            without risking an outbound arrival.
          </p>
        )}
      </main>

      {addOpen && (
        <AddAppointmentDialog
          serviceDate={serviceDate}
          onClose={() => setAddOpen(false)}
          onCreated={async () => {
            setAddOpen(false);
            await loadDay();
          }}
        />
      )}
    </div>
  );
}

function AppointmentCard({
  appointment,
  assignment,
  onRemove,
  onReturnReadyChange,
  dragHandle = false,
  onMoveUp,
  onMoveDown,
}: {
  appointment: ScheduleAppointment;
  assignment: RouteAssignment | null;
  onRemove: (appointment: ScheduleAppointment) => void;
  onReturnReadyChange: (
    appointment: ScheduleAppointment,
    returnReadyTime: string,
  ) => void;
  dragHandle?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <article className="route-card">
      <div className="route-card-heading">
        {dragHandle && (
          <GripVertical
            className="drag-grip"
            size={20}
            aria-label="Drag appointment"
          />
        )}
        <div>
          <h3>{appointment.elderly_name}</h3>
          <span>{appointment.appt_date}</span>
        </div>
        <button
          className="remove-appointment"
          type="button"
          onClick={() => void onRemove(appointment)}
          aria-label={`Remove ${appointment.elderly_name}'s appointment`}
        >
          <X size={17} />
        </button>
      </div>
      <div className="route-card-route">
        <p>
          <Clock3 size={16} /> Pickup{" "}
          <strong>{formatTime(assignment?.outbound_pickup_at ?? null)}</strong>
        </p>
        <p>
          <MapPin size={16} /> {appointment.pickup_address ?? "Pickup missing"}
        </p>
        <p>
          <Clock3 size={16} /> Hospital by{" "}
          <strong>{formatTime(assignment?.outbound_dropoff_at ?? null)}</strong>{" "}
          · appointment {formatTime(appointment.appt_time)}
        </p>
        <p>
          <MapPin size={16} /> {appointment.destination}
        </p>
        <label className="return-ready-control">
          <Clock3 size={16} />
          <span>Return ready</span>
          <input
            type="time"
            aria-label={`${appointment.elderly_name} return-ready time`}
            value={(appointment.return_ready_time ?? "").slice(0, 5)}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) =>
              onReturnReadyChange(appointment, event.target.value)
            }
          />
          <small>
            Planned {formatTime(assignment?.return_pickup_at ?? null)}
          </small>
        </label>
      </div>
      <div className="route-card-footer">
        <span
          className={appointment.escort_name ? "escort-ready" : "escort-needed"}
        >
          <UserRound size={15} />{" "}
          {appointment.escort_name ??
            (appointment.escort_required
              ? "Escort needs matching"
              : "No escort required")}
        </span>
        {appointment.escort_required && !appointment.escort_name && (
          <Link href="/app/matching">Match escort</Link>
        )}
        {dragHandle && (
          <span className="order-buttons">
            <button
              type="button"
              disabled={!onMoveUp}
              onClick={onMoveUp}
              aria-label={`Move ${appointment.elderly_name} earlier`}
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              disabled={!onMoveDown}
              onClick={onMoveDown}
              aria-label={`Move ${appointment.elderly_name} later`}
            >
              <ArrowDown size={15} />
            </button>
          </span>
        )}
      </div>
    </article>
  );
}

function AddAppointmentDialog({
  serviceDate,
  onClose,
  onCreated,
}: {
  serviceDate: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [patientId, setPatientId] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [destination, setDestination] = useState("");
  const [returnReadyTime, setReturnReadyTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getPatients()
      .then(setPatients)
      .catch((loadError) => setError(friendlyError(loadError)));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const created = await createAppointment({
        elderly_id: patientId,
        appt_date: serviceDate,
        appt_time: appointmentTime,
        pickup_address: pickupAddress.trim(),
        destination: destination.trim(),
        return_ready_time: returnReadyTime,
      });
      const assessment = await assessAppointment(created.trip_id);
      if (assessment.decision !== "accepted") {
        setError(`Appointment rejected: ${assessment.reasons.join(" · ")}`);
        return;
      }
      await onCreated();
    } catch (submitError) {
      setError(friendlyError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="presentation">
      <form
        className="modal-dialog schedule-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-appointment-title"
        onSubmit={submit}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">{serviceDate}</p>
            <h2 id="add-appointment-title">Add appointment</h2>
          </div>
          <button
            className="close-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X />
          </button>
        </div>
        <div className="schedule-form-grid">
          <label>
            <span>Patient</span>
            <select
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
              required
            >
              <option value="">Select patient</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Appointment time</span>
            <input
              type="time"
              value={appointmentTime}
              onChange={(event) => setAppointmentTime(event.target.value)}
              required
            />
          </label>
          <label className="wide-field">
            <span>Pickup address for this appointment</span>
            <input
              value={pickupAddress}
              onChange={(event) => setPickupAddress(event.target.value)}
              placeholder="Do not assume the patient’s home address"
              required
            />
          </label>
          <label className="wide-field">
            <span>Hospital / destination</span>
            <input
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
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
        <p className="form-help">
          The vehicle will target arrival 15–60 minutes before the appointment.
          Return pickup may wait up to one hour and never takes priority over an
          outbound trip.
        </p>
        {error && (
          <p className="inline-message error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Assessing…" : "Add and assess"}
          </button>
        </div>
      </form>
    </div>
  );
}
