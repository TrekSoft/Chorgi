/// <reference types="@types/google.accounts" />
/// <reference types="@types/gapi" />
/// <reference types="@types/gapi.calendar" />

declare global {
  interface Window {
    gapi: typeof gapi;
  }
}

declare namespace gapi.client {
  export const calendar: {
    calendarList: {
      list(params?: object): Promise<{
        result: {
          items: Array<{
            id: string;
            summary: string;
            description?: string;
          }>;
        };
      }>;
    };
    events: {
      list(params: {
        calendarId: string;
        timeMin: string;
        timeMax: string;
        singleEvents?: boolean;
        orderBy?: string;
      }): Promise<{
        result: {
          items: Array<{
            id: string;
            summary: string;
            description?: string;
            start?: {
              dateTime?: string;
              date?: string;
            };
            end?: {
              dateTime?: string;
              date?: string;
            };
          }>;
        };
      }>;
    };
  };
}

export {};
