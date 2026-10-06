import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MatchingWorkspace } from "./matching-workspace";

const apiMocks = vi.hoisted(() => ({
  getMatchingQueue: vi.fn(),
  getScheduledTrips: vi.fn(),
  getEscortSuggestions: vi.fn(),
  getEscortOptions: vi.fn(),
  updateMatchingProfile: vi.fn(),
  confirmEscort: vi.fn(),
}));

vi.mock("@/lib/api", async () => ({
  ...(await vi.importActual<typeof import("@/lib/api")>("@/lib/api")),
  ...apiMocks,
}));

const trip = {
  trip_id: "trip-1",
  elderly_id: "elderly-1",
  elderly_name: "Mdm Lim Siew Hoon",
  appt_date: "2026-09-08",
  appt_time: "10:00:00",
  destination: "Jurong Community Hospital",
  dialect: "Hokkien",
  weight_kg: 62.5,
  gender_preference: "F" as const,
  wheelchair_required: true,
};

const suggestion = {
  escort_id: "escort-1",
  name: "Mei Ling",
  gender: "F" as const,
  score: 3,
  flairs: ["Wheelchair capable", "Speaks Hokkien", "Gender preference met"],
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.getMatchingQueue.mockResolvedValue([trip]);
  apiMocks.getScheduledTrips.mockResolvedValue([
    {
      trip_id: "trip-scheduled",
      elderly_name: "Mr Tan Ah Kow",
      escort_name: "Siti Aishah",
      appt_date: "2026-09-09",
      appt_time: "13:30:00",
      destination: "Ng Teng Fong General Hospital",
    },
  ]);
  apiMocks.getEscortSuggestions.mockResolvedValue({
    suggestions: [suggestion],
    warning: null,
  });
  apiMocks.getEscortOptions.mockResolvedValue([]);
  apiMocks.confirmEscort.mockResolvedValue({
    trip_id: trip.trip_id,
    escort_id: suggestion.escort_id,
    status: "scheduled",
    assignment_override: false,
  });
});

describe("MatchingWorkspace", () => {
  it("shows quiet patient modules before revealing matching details", async () => {
    const user = userEvent.setup();
    render(<MatchingWorkspace />);

    const patientCard = await screen.findByRole("button", {
      name: /Mdm Lim Siew Hoon/i,
    });
    expect(patientCard).toHaveTextContent("2026-09-08 at 10:00 am");
    expect(patientCard).toHaveTextContent("Jurong Community Hospital");
    expect(screen.queryByText("Hokkien")).not.toBeInTheDocument();

    await user.click(patientCard);

    const drawer = await screen.findByRole("dialog", {
      name: "Mdm Lim Siew Hoon",
    });
    expect(within(drawer).getByText("Hokkien")).toBeInTheDocument();
    expect(
      await within(drawer).findByText("Speaks Hokkien"),
    ).toBeInTheDocument();
    expect(
      within(drawer).queryByText(/3 points|match score/i),
    ).not.toBeInTheDocument();
  });

  it("keeps selection and confirmation as separate actions", async () => {
    const user = userEvent.setup();
    render(<MatchingWorkspace />);
    await user.click(
      await screen.findByRole("button", { name: /Mdm Lim Siew Hoon/i }),
    );

    const radio = await screen.findByRole("radio", { name: /Mei Ling/i });
    const confirmButton = screen.getByRole("button", {
      name: "Select an escort first",
    });
    expect(confirmButton).toBeDisabled();

    await user.click(radio);
    await user.click(screen.getByRole("button", { name: "Confirm Mei Ling" }));

    expect(apiMocks.confirmEscort).toHaveBeenCalledWith("trip-1", "escort-1");
    expect(await screen.findByText("Mei Ling is assigned")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Match next appointment" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Mdm Lim Siew Hoon/i }),
      ).not.toBeInTheDocument(),
    );
  });

  it("requires a written reason before an unavailable escort can be overridden", async () => {
    const user = userEvent.setup();
    apiMocks.getEscortSuggestions.mockResolvedValue({
      suggestions: [],
      warning: "No viable escort is available.",
    });
    apiMocks.getEscortOptions.mockResolvedValue([
      {
        escort_id: "escort-2",
        name: "Siti Aishah",
        gender: "F",
        dialects: ["Malay"],
        available_days: ["Mon"],
        available_timeslot: "9am-1pm",
        wheelchair_handling_capable: true,
        issues: ["Escort is unavailable at this appointment time."],
      },
    ]);

    render(<MatchingWorkspace />);
    await user.click(
      await screen.findByRole("button", { name: /Mdm Lim Siew Hoon/i }),
    );
    expect(await screen.findByText("Manual review needed")).toBeInTheDocument();
    await user.click(
      await screen.findByRole("radio", { name: /Siti Aishah/i }),
    );

    const overrideButton = screen.getByRole("button", {
      name: "Confirm Siti Aishah with override",
    });
    expect(overrideButton).toBeDisabled();
    await user.type(
      screen.getByLabelText("Reason for overriding"),
      "Escort confirmed availability by phone.",
    );
    expect(overrideButton).toBeEnabled();
    await user.click(overrideButton);

    expect(apiMocks.confirmEscort).toHaveBeenCalledWith(
      "trip-1",
      "escort-2",
      "Escort confirmed availability by phone.",
    );
  });

  it("saves corrected matching details and refreshes suggestions", async () => {
    const user = userEvent.setup();
    apiMocks.updateMatchingProfile.mockResolvedValue({
      elderly_id: "elderly-1",
      dialect: "Cantonese",
      weight_kg: 62.5,
      gender_preference: "F",
    });
    render(<MatchingWorkspace />);
    await user.click(
      await screen.findByRole("button", { name: /Mdm Lim Siew Hoon/i }),
    );
    await screen.findByText("Speaks Hokkien");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const dialect = screen.getByLabelText("Dialect");
    await user.clear(dialect);
    await user.type(dialect, "Cantonese");
    await user.click(screen.getByRole("button", { name: "Save and refresh" }));

    await waitFor(() =>
      expect(apiMocks.updateMatchingProfile).toHaveBeenCalledWith("elderly-1", {
        dialect: "Cantonese",
        weight_kg: 62.5,
        gender_preference: "F",
      }),
    );
    expect(
      await screen.findByText(
        "Details saved. Suggestions have been refreshed.",
      ),
    ).toBeInTheDocument();
    expect(apiMocks.getEscortSuggestions).toHaveBeenCalledTimes(2);
  });

  it("shows confirmed patient and escort assignments in a separate tab", async () => {
    const user = userEvent.setup();
    render(<MatchingWorkspace />);

    await user.click(screen.getByRole("tab", { name: /Existing matches/ }));

    expect(await screen.findByText("Mr Tan Ah Kow")).toBeInTheDocument();
    expect(screen.getByText("Siti Aishah")).toBeInTheDocument();
    expect(
      screen.getByText("Ng Teng Fong General Hospital"),
    ).toBeInTheDocument();
    expect(apiMocks.getScheduledTrips).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Hokkien")).not.toBeInTheDocument();
  });
});
