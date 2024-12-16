import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { listCalendars, initializeGoogleCalendar, setStoredToken } from '../services/googleCalendar';

interface CalendarSettingsProps {
  selectedCalendars: string[];
  onCalendarsChange: (calendars: string[]) => void;
  googleToken: any; // Token from the child's stored credentials
}

const CalendarSettings: React.FC<CalendarSettingsProps> = ({
  selectedCalendars,
  onCalendarsChange,
  googleToken,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [calendars, setCalendars] = useState<gapi.client.calendar.CalendarListEntry[]>([]);

  useEffect(() => {
    const init = async () => {
      await initializeGoogleCalendar();
      if (googleToken) {
        setStoredToken(googleToken);
        loadCalendars();
      }
    };
    init();
  }, [googleToken]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const loadCalendars = async () => {
    const calendarList = await listCalendars();
    setCalendars(calendarList);
  };

  const handleToggleCalendar = (calendarId: string) => {
    const newSelectedCalendars = selectedCalendars.includes(calendarId)
      ? selectedCalendars.filter(id => id !== calendarId)
      : [...selectedCalendars, calendarId];
    onCalendarsChange(newSelectedCalendars);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'calendar-settings-popover' : undefined;

  return (
    <>
      <IconButton onClick={handleClick} aria-describedby={id}>
        <SettingsIcon />
      </IconButton>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <List sx={{ width: 300 }}>
          {calendars.length > 0 ? (
            calendars.map((calendar) => (
              <ListItemButton
                key={calendar.id}
                onClick={() => calendar.id && handleToggleCalendar(calendar.id)}
              >
                <Checkbox
                  checked={calendar.id ? selectedCalendars.includes(calendar.id) : false}
                  tabIndex={-1}
                  disableRipple
                />
                <ListItemText primary={calendar.summary} />
              </ListItemButton>
            ))
          ) : (
            <ListItem>
              <ListItemText primary="No calendars found" />
            </ListItem>
          )}
        </List>
      </Popover>
    </>
  );
};

export default CalendarSettings;
