import type { TimetableExtractionResult } from "@/types/timetable.types";
import { authedRequest } from "./authedRequest";

export const timetableService = {
  extract: (input: { fileBase64: string; filename: string }) =>
    authedRequest<TimetableExtractionResult>("/timetables/extract", {
      method: "POST",
      body: input,
    }),
};
