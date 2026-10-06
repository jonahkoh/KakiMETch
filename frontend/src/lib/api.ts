export type GenderPreference = "M" | "F";

export interface MatchingQueueItem {
  trip_id: string;
  elderly_id: string;
  elderly_name: string;
  appt_date: string;
  appt_time: string;
  destination: string;
  dialect: string | null;
  weight_kg: number | null;
  gender_preference: GenderPreference | null;
  wheelchair_required: boolean;
}

export interface EscortSuggestion {
  escort_id: string;
  name: string;
  gender: "M" | "F";
  score: number;
  flairs: string[];
}

export interface MatchResult {
  suggestions: EscortSuggestion[];
  warning: string | null;
}

export interface MatchingProfileUpdate {
  dialect: string | null;
  weight_kg: number | null;
  gender_preference: GenderPreference | null;
}

export interface MatchingProfile extends MatchingProfileUpdate {
  elderly_id: string;
}

export interface EscortOption {
  escort_id: string;
  name: string;
  gender: "M" | "F";
  dialects: string[];
  available_days: string[];
  available_timeslot: string;
  wheelchair_handling_capable: boolean;
  issues: string[];
}

export interface TripConfirmation {
  trip_id: string;
  escort_id: string;
  status: "scheduled";
  assignment_override: boolean;
}

export interface TripCancellation {
  trip_id: string;
  status: "accepted";
}

export interface AppointmentCreate {
  elderly_id: string;
  appt_date: string;
  appt_time: string;
  destination: string;
}

export interface AppointmentCreated extends AppointmentCreate {
  trip_id: string;
  status: "pending";
}

export interface AssessmentResult {
  decision: "accepted" | "rejected";
  reasons: string[];
  warnings: string[];
}

export interface ScheduledTrip extends MatchingQueueItem {
  escort_id: string;
  escort_name: string;
}

interface ApiErrorPayload {
  detail?: string | { message?: string; issues?: string[] };
}

export class ApiError extends Error {
  status: number;
  issues: string[];

  constructor(status: number, payload: ApiErrorPayload | null) {
    const detail = payload?.detail;
    super(
      typeof detail === "string"
        ? detail
        : (detail?.message ?? "Something went wrong. Please try again."),
    );
    this.name = "ApiError";
    this.status = status;
    this.issues = typeof detail === "object" ? (detail.issues ?? []) : [];
  }
}

// Next.js only inlines NEXT_PUBLIC_* variables read by literal name.
const SERVICE_URLS = {
  assessment:
    process.env.NEXT_PUBLIC_ASSESSMENT_API_URL ?? "http://localhost:8001",
  matching: process.env.NEXT_PUBLIC_MATCHING_API_URL ?? "http://localhost:8002",
  registry: process.env.NEXT_PUBLIC_REGISTRY_API_URL ?? "http://localhost:8003",
  scheduling:
    process.env.NEXT_PUBLIC_SCHEDULING_API_URL ?? "http://localhost:8004",
};

type Service = keyof typeof SERVICE_URLS;

async function request<T>(
  service: Service,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const hasJsonBody = Boolean(init?.body) && !(init?.body instanceof FormData);
  const baseUrl = SERVICE_URLS[service].replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = null;
    }
    throw new ApiError(response.status, payload);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const getMatchingQueue = () =>
  request<MatchingQueueItem[]>("matching", "/matching-queue");

export const getScheduledTrips = () =>
  request<ScheduledTrip[]>("scheduling", "/schedule");

export const getEscortSuggestions = (tripId: string) =>
  request<MatchResult>(
    "matching",
    `/trips/${tripId}/escort-suggestions?limit=3`,
  );

export const getEscortOptions = (tripId: string) =>
  request<EscortOption[]>("matching", `/trips/${tripId}/escort-options`);

export const updateMatchingProfile = (
  elderlyId: string,
  update: MatchingProfileUpdate,
) =>
  request<MatchingProfile>(
    "matching",
    `/elderly-clients/${elderlyId}/matching-profile`,
    {
      method: "PATCH",
      body: JSON.stringify(update),
    },
  );

export const createAppointment = (appointment: AppointmentCreate) =>
  request<AppointmentCreated>("scheduling", "/trips", {
    method: "POST",
    body: JSON.stringify(appointment),
  });

export const assessAppointment = (tripId: string) =>
  request<AssessmentResult>("assessment", `/trips/${tripId}/assessment`, {
    method: "POST",
  });

export const confirmEscort = (
  tripId: string,
  escortId: string,
  overrideReason?: string,
) =>
  request<TripConfirmation>("scheduling", `/trips/${tripId}/confirm-escort`, {
    method: "POST",
    body: JSON.stringify({
      escort_id: escortId,
      assignment_override: Boolean(overrideReason),
      assignment_override_reason: overrideReason || null,
    }),
  });

export const cancelAssignment = (tripId: string) =>
  request<TripCancellation>(
    "scheduling",
    `/trips/${tripId}/cancel-assignment`,
    {
      method: "POST",
    },
  );

export type MobilityStatus =
  | "ambulant"
  | "wheelchair_user"
  | "walking_frame_user"
  | "bed_bound"
  | "unknown";

export type ServiceAgreementStatus = "Y" | "N" | "Pending";

export interface PatientSummary {
  id: string;
  name: string;
  nric: string | null;
  postal_code: string | null;
  nmtr_percentage: number | null;
  escort_required: boolean;
  last_visit: string | null;
  deleted_at: string | null;
}

export interface PatientDetail {
  id: string;
  name: string;
  nric: string | null;
  aic_registration_no: string | null;
  postal_code: string | null;
  block: string | null;
  unit: string | null;
  street_name: string | null;
  address: string | null;
  contact_no: string | null;
  caregiver_name: string | null;
  escort_required: boolean;
  co_payment: number | null;
  date_of_birth: string | null;
  nmts_effective_date: string | null;
  nmts_expired_date: string | null;
  date_of_entry: string | null;
  action_updated_date: string | null;
  lh_service_agreement: ServiceAgreementStatus | null;
  sw_service_agreement: ServiceAgreementStatus | null;
  wheelchair_required: boolean;
  walking_frame_required: boolean;
  caregiver_or_maid_available: boolean | null;
  gender: "M" | "F" | null;
  gender_preference: GenderPreference | null;
  address_source: string | null;
  dialect: string | null;
  weight_kg: number | null;
  nmtr_percentage: number | null;
  aic_mobility_status: MobilityStatus;
  lh_mobility_status: MobilityStatus;
  last_visit: string | null;
  deleted_at: string | null;
}

export type PatientWrite = Omit<
  PatientDetail,
  "id" | "address" | "last_visit" | "deleted_at"
>;

export interface ImportSummary {
  imported_count: number;
  skipped_count: number;
}

export const getPatients = () =>
  request<PatientSummary[]>("registry", "/registry/patients");

export const getDeletedPatients = () =>
  request<PatientSummary[]>("registry", "/registry/patients?deleted=true");

export const getPatient = (patientId: string) =>
  request<PatientDetail>("registry", `/registry/patients/${patientId}`);

export const createPatient = (patient: PatientWrite) =>
  request<PatientDetail>("registry", "/registry/patients", {
    method: "POST",
    body: JSON.stringify(patient),
  });

export const updatePatient = (patientId: string, patient: PatientWrite) =>
  request<PatientDetail>("registry", `/registry/patients/${patientId}`, {
    method: "PUT",
    body: JSON.stringify(patient),
  });

export const deletePatient = (patientId: string) =>
  request<void>("registry", `/registry/patients/${patientId}`, {
    method: "DELETE",
  });

export const restorePatient = (patientId: string) =>
  request<PatientDetail>(
    "registry",
    `/registry/patients/${patientId}/restore`,
    {
      method: "POST",
    },
  );

export const importPatients = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return request<ImportSummary>("registry", "/registry/import", {
    method: "POST",
    body: formData,
  });
};
