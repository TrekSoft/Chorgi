import { TodoItem } from '../types';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// Google Calendar color IDs mapped to CSS variables
const COLOR_MAP: { [key: string]: string } = {
  '1': 'var(--calendar-blue)',
  '2': 'var(--calendar-green)',
  '3': 'var(--calendar-purple)',
  '4': 'var(--calendar-red)',
  '5': 'var(--calendar-yellow)',
  '6': 'var(--calendar-orange)',
  '7': 'var(--calendar-turquoise)',
  '8': 'var(--calendar-gray)',
  '9': 'var(--calendar-bold-blue)',
  '10': 'var(--calendar-bold-green)',
  '11': 'var(--calendar-bold-red)',
};

let gapiInited = false;
let gisInited = false;
let tokenClient: google.accounts.oauth2.TokenClient;

export const initializeGoogleCalendar = async () => {
  await new Promise<void>(resolve => {
    gapi.load('client', async () => {
      await gapi.client.init({
        apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      });
      gapiInited = true;
      resolve();
    });
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID!,
    scope: SCOPES.join(' '),
    callback: tokenResponse => {
      // Handle the token response here
      gapi.client.setToken(tokenResponse);
    },
  });
  gisInited = true;
};

export const setStoredToken = (token: any) => {
  gapi.client.setToken(token);
};

export const listCalendars = async () => {
  try {
    const response = await gapi.client.calendar.calendarList.list();
    return response.result.items || [];
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return [];
  }
};

export const getEventsFromCalendar = async (
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<TodoItem[]> => {
  try {
    // Extend timeMin to the start of the day and timeMax to the end of the day
    // This ensures we get events that might have started before but are still ongoing
    const extendedTimeMin = startOfDay(timeMin);
    const extendedTimeMax = endOfDay(timeMax);

    const response = await gapi.client.calendar.events.list({
      calendarId,
      // Use extended time range for fetching
      timeMin: extendedTimeMin.toISOString(),
      timeMax: extendedTimeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      fields: 'items(id,summary,start,end,attendees,colorId)',
    } as gapi.client.calendar.EventsListParameters);

    return (response.result.items || [])
      .filter(event => {
        const eventStart = new Date(event.start?.dateTime || event.start?.date || '');
        const eventEnd = new Date(event.end?.dateTime || event.end?.date || '');

        // Include events that:
        // 1. Start during the day
        // 2. End during the day
        // 3. Span across the day (start before and end after)
        return (
          (eventStart >= extendedTimeMin && eventStart <= extendedTimeMax) || // Starts during the day
          (eventEnd >= extendedTimeMin && eventEnd <= extendedTimeMax) || // Ends during the day
          (eventStart <= extendedTimeMin && eventEnd >= extendedTimeMax) // Spans across the day
        );
      })
      .map(event => ({
        id: event.id,
        title: event.summary || 'Untitled Event',
        startTime: event.start?.dateTime || event.start?.date || '',
        endTime: event.end?.dateTime || event.end?.date || '',
        isDone: false,
        isShared: !event.attendees?.length,
        backgroundColor: event.colorId ? COLOR_MAP[event.colorId] : undefined,
        attendees: event.attendees?.map(attendee => ({
          email: attendee.email || '',
          responseStatus: attendee.responseStatus,
        })),
      }));
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
};

export const handleAuthClick = () => {
  return new Promise<void>((resolve, reject) => {
    if (!gapiInited || !gisInited) {
      reject(new Error('Google API not initialized'));
      return;
    }

    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

export const isSignedIn = () => {
  return gapi.client.getToken() !== null;
};

// Helper functions to get the start and end of a day
const startOfDay = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const endOfDay = (date: Date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};
