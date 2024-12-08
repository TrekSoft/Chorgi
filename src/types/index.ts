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
  startTime: string;
  endTime: string;
  isDone: boolean;
  completedAt?: string;
  completedBy?: {
    id: string;
    name: string;
    avatarUrl: string;
  };
}
