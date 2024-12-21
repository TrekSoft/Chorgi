export interface Child {
  id: string;
  name: string;
  avatarUrl: string;
  googleId: string;
  calendarId: string;
  birthdate?: string;  // ISO date string from Google People API
  googleToken: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expiry_date: number;
  };
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
  isShared?: boolean;
}
