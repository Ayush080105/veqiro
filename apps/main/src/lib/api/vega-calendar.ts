import { apiFetch } from "./client";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  attendees: string[];
  location: string;
  meetLink?: string;
  status: string;
  recurring?: boolean;
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

export function fetchCalendar(daysAhead = 14): Promise<CalendarResponse> {
  return apiFetch<CalendarResponse>(
    `/agents/vega/calendar/events?daysAhead=${daysAhead}`
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
