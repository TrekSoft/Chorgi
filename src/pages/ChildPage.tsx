import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import { Child, TodoItem } from '../types';
import { isAfter, startOfDay, endOfDay } from 'date-fns';
import { getEventsFromCalendar, initializeGoogleCalendar } from '../services/googleCalendar';
import CalendarSettings from '../components/CalendarSettings';

const ChildPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [child, setChild] = useState<Child | null>(null);
  const [personalTodos, setPersonalTodos] = useState<TodoItem[]>([]);
  const [sharedTodos, setSharedTodos] = useState<TodoItem[]>([]);
  const [idleTimer, setIdleTimer] = useState<NodeJS.Timeout>();
  const [personalCalendars, setPersonalCalendars] = useState<string[]>([]);
  const [sharedCalendars, setSharedCalendars] = useState<string[]>([]);

  // Load child data and saved calendars
  useEffect(() => {
    const savedChildren = localStorage.getItem('children');
    if (savedChildren && id) {
      const children: Child[] = JSON.parse(savedChildren);
      const foundChild = children.find(c => c.id === id);
      if (foundChild) {
        setChild(foundChild);
      }
    }
  }, [id]);

  // Load saved calendar selections
  useEffect(() => {
    if (id) {
      const savedPersonalCalendars = localStorage.getItem(`${id}-personal-calendars`);
      const savedSharedCalendars = localStorage.getItem(`${id}-shared-calendars`);
      
      if (savedPersonalCalendars) {
        setPersonalCalendars(JSON.parse(savedPersonalCalendars));
      }
      if (savedSharedCalendars) {
        setSharedCalendars(JSON.parse(savedSharedCalendars));
      }
    }
  }, [id]);

  // Idle timer setup
  useEffect(() => {
    let currentTimer: NodeJS.Timeout;
    
    const resetTimer = () => {
      if (currentTimer) clearTimeout(currentTimer);
      currentTimer = setTimeout(() => navigate('/'), 60000); // 1 minute
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      if (currentTimer) clearTimeout(currentTimer);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [navigate]);

  // Initialize Google Calendar
  useEffect(() => {
    initializeGoogleCalendar();
  }, []);

  // Load todos from Google Calendar
  useEffect(() => {
    const fetchTodos = async () => {
      if (!child?.googleToken) return;

      try {
        const now = new Date();
        const start = startOfDay(now);
        const end = endOfDay(now);

        if (personalCalendars.length > 0) {
          // Fetch personal todos
          const personalEvents = await Promise.all(
            personalCalendars.map(calendarId =>
              getEventsFromCalendar(calendarId, start, end)
            )
          );
          setPersonalTodos(personalEvents.flat());
        }

        if (sharedCalendars.length > 0) {
          // Fetch shared todos
          const sharedEvents = await Promise.all(
            sharedCalendars.map(calendarId =>
              getEventsFromCalendar(calendarId, start, end)
            )
          );
          setSharedTodos(sharedEvents.flat());
        }
      } catch (error) {
        console.error('Error fetching todos:', error);
      }
    };

    fetchTodos();
  }, [child?.googleToken, personalCalendars, sharedCalendars]);

  const handlePersonalCalendarsChange = (calendars: string[]) => {
    setPersonalCalendars(calendars);
    if (id) {
      localStorage.setItem(`${id}-personal-calendars`, JSON.stringify(calendars));
    }
  };

  const handleSharedCalendarsChange = (calendars: string[]) => {
    setSharedCalendars(calendars);
    if (id) {
      localStorage.setItem(`${id}-shared-calendars`, JSON.stringify(calendars));
    }
  };

  const toggleTodoStatus = (todo: TodoItem, isShared: boolean) => {
    const updateTodos = (todos: TodoItem[]) => {
      return todos.map(t => {
        if (t.id === todo.id) {
          return { 
            ...t, 
            isDone: !t.isDone,
            completedAt: !t.isDone ? new Date().toISOString() : undefined 
          };
        }
        return t;
      });
    };

    if (isShared) {
      setSharedTodos(updateTodos(sharedTodos));
    } else {
      setPersonalTodos(updateTodos(personalTodos));
    }
  };

  const sortTodos = (todos: TodoItem[]) => {
    const now = new Date();
    const incomplete = todos.filter(
      todo => !todo.isDone && isAfter(new Date(todo.endTime), now)
    );
    const missed = todos.filter(
      todo => !todo.isDone && !isAfter(new Date(todo.endTime), now)
    );
    // Sort completed items by completion time, most recent first
    const completed = todos
      .filter(todo => todo.isDone)
      .sort((a, b) => {
        const aTime = new Date(a.completedAt || a.endTime).getTime();
        const bTime = new Date(b.completedAt || b.endTime).getTime();
        return bTime - aTime;  // Most recent first
      });

    return [...incomplete, ...missed, ...completed];
  };

  const renderTodoList = (todos: TodoItem[], isShared: boolean) => (
    <List>
      {sortTodos(todos).map((todo) => {
        return (
          <ListItem
            key={todo.id}
            onClick={() => toggleTodoStatus(todo, isShared)}
            sx={{
              bgcolor: (theme) => theme.palette.background.paper === '#121212' 
                ? 'rgba(255, 255, 255, 0.12)' 
                : 'rgba(0, 0, 0, 0.12)',
              my: 1,
              borderRadius: 1,
              height: 72,
              cursor: 'pointer',
              '&:hover': {
                bgcolor: (theme) => theme.palette.background.paper === '#121212'
                  ? 'rgba(255, 255, 255, 0.16)'
                  : 'rgba(0, 0, 0, 0.16)',
              },
            }}
          >
            <Box
              sx={{
                width: 24,
                height: 24,
                border: 2,
                borderColor: todo.isDone ? 'primary.main' : 'text.primary',
                borderRadius: '50%',
                mr: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {todo.isDone && (
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    bgcolor: 'primary.main',
                    borderRadius: '50%',
                  }}
                />
              )}
            </Box>
            <ListItemText
              primary={todo.title}
              sx={{
                textDecoration: todo.isDone ? 'line-through' : 'none',
                '.MuiListItemText-primary': {
                  color: 'text.primary',
                },
              }}
            />
          </ListItem>
        );
      })}
    </List>
  );

  if (!child) {
    return <Typography>Child not found</Typography>;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, py: 14 }}>
      <IconButton
        onClick={() => navigate('/')}
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          bgcolor: (theme) => theme.palette.background.paper === '#121212'
            ? 'rgba(255, 255, 255, 0.12)'
            : 'rgba(100, 100, 100, .85)',
          '&:hover': {
            bgcolor: (theme) => theme.palette.background.paper === '#121212'
              ? 'rgba(255, 255, 255, 0.16)'
              : 'rgba(100, 100, 100, .5)',
          },
          padding: 2,
        }}
      >
        <HomeIcon sx={{ fontSize: 48 }} />
      </IconButton>

      <Grid container spacing={2} sx={{ p: 4 }}>
        <Grid item xs={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Your Chores</Typography>
              <CalendarSettings
                selectedCalendars={personalCalendars}
                onCalendarsChange={handlePersonalCalendarsChange}
                googleToken={child.googleToken}
              />
            </Box>
            {renderTodoList(personalTodos, false)}
          </Paper>
        </Grid>

        <Grid item xs={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Shared Chores</Typography>
              <CalendarSettings
                selectedCalendars={sharedCalendars}
                onCalendarsChange={handleSharedCalendarsChange}
                googleToken={child.googleToken}
              />
            </Box>
            {renderTodoList(sharedTodos, true)}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ChildPage;
