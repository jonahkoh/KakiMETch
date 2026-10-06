import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VehicleSchedule } from "./vehicle-schedule";

const apiMocks = vi.hoisted(() => ({
  getDaySchedule: vi.fn(),
  optimiseDaySchedule: vi.fn(),
  removeScheduleAppointment: vi.fn(),
  saveManualPlan: vi.fn(),
  getPatients: vi.fn(),
}));

vi.mock("@/lib/api", async () => ({
  ...(await vi.importActual<typeof import("@/lib/api")>("@/lib/api")),
  ...apiMocks,
}));

const appointment = {
  trip_id: "trip-1",
  elderly_id: "patient-1",
  elderly_name: "Alice Tan",
  appt_date: "2026-10-07",
  appt_time: "08:30:00",
  pickup_address: "320 Bukit Batok Street 33",
  destination: "National University Hospital",
  return_ready_time: "11:00:00",
  escort_required: true,
  escort_name: "Mei Ling",
};

const vehicles = [
  {
    id: "vehicle-1",
    plate_number: "PC2345L",
    driver_name: "Driver A",
    available_from: "06:30:00",
    available_until: "15:00:00",
    passenger_pair_capacity: 3,
    max_daily_services: 8,
  },
  {
    id: "vehicle-2",
    plate_number: "PC8213U",
    driver_name: "Driver B",
    available_from: "06:30:00",
    available_until: "15:00:00",
    passenger_pair_capacity: 3,
    max_daily_services: 8,
  },
];

const plan = {
  id: "plan-1",
  service_date: "2026-10-07",
  status: "optimised" as const,
  matrix_source: "Local estimate — add Mapbox token",
  total_travel_minutes: 42,
  unallocated_returns: [],
  lanes: [
    {
      vehicle: vehicles[0],
      assignments: [
        {
          trip_id: "trip-1",
          sequence: 0,
          outbound_pickup_at: "07:45:00",
          outbound_dropoff_at: "08:15:00",
          return_pickup_at: "11:00:00",
          return_dropoff_at: "11:30:00",
          stops: [],
        },
      ],
    },
    { vehicle: vehicles[1], assignments: [] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.getDaySchedule.mockResolvedValue({
    service_date: "2026-10-07",
    vehicles,
    appointments: [appointment],
    plan: null,
  });
  apiMocks.optimiseDaySchedule.mockResolvedValue(plan);
  apiMocks.removeScheduleAppointment.mockResolvedValue(undefined);
  apiMocks.getPatients.mockResolvedValue([]);
});

describe("VehicleSchedule", () => {
  it("runs allocation and shows both vehicle swim lanes", async () => {
    const user = userEvent.setup();
    render(<VehicleSchedule />);

    expect(await screen.findByText("Awaiting allocation")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "See allocation" }));

    expect(await screen.findByText("PC2345L")).toBeInTheDocument();
    expect(screen.getByText("PC8213U")).toBeInTheDocument();
    expect(screen.getByText("07:45")).toBeInTheDocument();
    expect(screen.getByText("Mei Ling")).toBeInTheDocument();
  });

  it("warns before removing an appointment", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<VehicleSchedule />);

    await user.click(
      await screen.findByRole("button", {
        name: "Remove Alice Tan's appointment",
      }),
    );

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("Remove Alice Tan"),
    );
    await waitFor(() =>
      expect(apiMocks.removeScheduleAppointment).toHaveBeenCalledWith("trip-1"),
    );
    confirm.mockRestore();
  });
});
