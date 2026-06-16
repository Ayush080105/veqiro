import { apiFetch } from "./client";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  allDay?: boolean;
  attendees: string[];
  location: string;
  meetLink?: string;
  htmlLink?: string;
  status: string;
  recurring?: boolean;
  organizer?: string;
  colorId?: string;
}

export interface CalendarSlot {
  date: string;
  start: string;
  end: string;
  durationHours: number;
}

export interface CalendarResponse {
  events: CalendarEvent[];
  slots: CalendarSlot[];
}

export interface MeetingPrepResponse {
  summary: string;
  keyPoints: string[];
  attendeeContext: string;
  suggestedAgenda: string[];
}

export interface CreateEventPayload {
  title: string;
  start: string;
  end: string;
  attendees?: string[];
  description?: string;
  addGoogleMeet?: boolean;
}

export function fetchCalendar(params: {
  timeMin: string;
  timeMax: string;
  timeZone?: string;
}): Promise<CalendarResponse> {
  const sp = new URLSearchParams({
    timeMin: params.timeMin,
    timeMax: params.timeMax,
  });
  if (params.timeZone) sp.set("timeZone", params.timeZone);
  return apiFetch<CalendarResponse>(
    `/agents/vega/calendar/events?${sp.toString()}`
  );
}

export function fetchMeetingPrep(payload: {
  eventTitle: string;
  attendeeEmails: string[];
  description: string;
}): Promise<MeetingPrepResponse> {
  return apiFetch<MeetingPrepResponse>("/agents/vega/calendar/prep", {
    method: "POST",
    body: payload,
  });
}

export function createCalendarEvent(
  payload: CreateEventPayload
): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>("/agents/vega/calendar/events", {
    method: "POST",
    body: payload,
  });
}

export interface PostMeetingFollowUp {
  followUp: { to: string; subject: string; body: string }
  actionItems: string[]
}

export function fetchPostMeetingFollowUp(payload: {
  eventTitle: string
  attendeeEmails: string[]
  description: string
  notes?: string
}): Promise<PostMeetingFollowUp> {
  return apiFetch<PostMeetingFollowUp>("/agents/vega/calendar/followup", {
    method: "POST",
    body: payload,
  })
}

export function sendFollowUpEmail(payload: {
  to: string
  subject: string
  body: string
}): Promise<{ messageId: string }> {
  return apiFetch<{ messageId: string }>("/agents/vega/calendar/followup/send", {
    method: "POST",
    body: payload,
  })
}

export interface RescheduleDraft {
  email: { to: string; subject: string; body: string }
}

export function fetchRescheduleDraft(payload: {
  eventTitle: string
  attendeeEmails: string[]
  originalStart: string
  newStart: string
  newEnd: string
}): Promise<RescheduleDraft> {
  return apiFetch<RescheduleDraft>("/agents/vega/calendar/reschedule-draft", {
    method: "POST",
    body: payload,
  })
}

export function patchCalendarEvent(
  eventId: string,
  payload: { start: string; end: string }
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/agents/vega/calendar/events/${eventId}`, {
    method: "PATCH",
    body: payload,
  })
}
