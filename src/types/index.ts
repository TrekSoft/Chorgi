export interface Child {
  id: string;
  name: string;
  avatarUrl: string;
  googleId: string;
  calendarId: string;
  googleToken?: any; // Store the Google OAuth token
}

export interface TodoItem {
  id: string;
  title: string;
  isDone: boolean;
  endTime: string;
  isShared: boolean;
  eventId: string;
}
