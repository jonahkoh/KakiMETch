import { afterEach, expect, test, vi } from "vitest";

import {
  assessAppointment,
  getMatchingQueue,
  getPatients,
  getScheduledTrips,
} from "./api";

afterEach(() => vi.unstubAllGlobals());

test.each([
  [
    "assessment",
    () => assessAppointment("t1"),
    "http://localhost:8001/trips/t1/assessment",
  ],
  [
    "matching",
    () => getMatchingQueue(),
    "http://localhost:8002/matching-queue",
  ],
  ["registry", () => getPatients(), "http://localhost:8003/registry/patients"],
  ["scheduling", () => getScheduledTrips(), "http://localhost:8004/schedule"],
])("%s calls go to that service's default base URL", async (_, call, url) => {
  const fetchMock = vi.fn(async () => Response.json([]));
  vi.stubGlobal("fetch", fetchMock);

  await call();

  expect(fetchMock).toHaveBeenCalledWith(url, expect.anything());
});
