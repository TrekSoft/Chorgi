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
  CircularProgress,
  Avatar
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Child, TodoItem } from '../types';
import { isAfter, startOfDay, endOfDay, format } from 'date-fns';
import { getEventsFromCalendar, initializeGoogleCalendar } from '../services/googleCalendar';
import CalendarSettings from '../components/CalendarSettings';

const ChildPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [child, setChild] = useState<Child | null>(null);
  const [personalTodos, setPersonalTodos] = useState<TodoItem[]>([]);
  const [sharedTodos, setSharedTodos] = useState<TodoItem[]>([]);
  const [personalCalendars, setPersonalCalendars] = useState<string[]>([]);
  const [sharedCalendars, setSharedCalendars] = useState<string[]>([]);
  const [isCalendarInitialized, setIsCalendarInitialized] = useState(false);
  const [isLoadingTodos, setIsLoadingTodos] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const isBeforeToday = startOfDay(selectedDate).getTime() < startOfDay(new Date()).getTime();

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

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
    const init = async () => {
      await initializeGoogleCalendar();
      setIsCalendarInitialized(true);
    };
    init();
  }, []);

  // Load todos from Google Calendar
  const fetchTodos = async () => {
    if (!child || !isCalendarInitialized) return;

    setIsLoadingTodos(true);
    try {
      const selectedEndOfDay = endOfDay(selectedDate);
      const selectedStartOfDay = startOfDay(selectedDate);
      
      // For past dates, use end of day. For today, use current time
      const referenceTime = startOfDay(selectedDate).getTime() < startOfDay(new Date()).getTime()
        ? selectedEndOfDay
        : new Date();

      // Fetch personal todos
      if (personalCalendars.length > 0) {
        const personalEvents = await Promise.all(
          personalCalendars.map(calendarId =>
            getEventsFromCalendar(calendarId, selectedStartOfDay, selectedEndOfDay)
          )
        );
        const filteredPersonalTodos = personalEvents.flat().filter(todo => 
          todo.attendees?.some(attendee => attendee.email === child.calendarId) &&
          (!todo.startTime || isAfter(referenceTime, new Date(todo.startTime)))
        );
        setPersonalTodos(filteredPersonalTodos);
      } else {
        setPersonalTodos([]);
      }

      // Fetch shared todos
      if (sharedCalendars.length > 0) {
        const sharedEvents = await Promise.all(
          sharedCalendars.map(calendarId =>
            getEventsFromCalendar(calendarId, selectedStartOfDay, selectedEndOfDay)
          )
        );
        const filteredSharedTodos = sharedEvents.flat().filter(todo => 
          !todo.attendees?.length &&
          (!todo.startTime || isAfter(referenceTime, new Date(todo.startTime)))
        );
        setSharedTodos(filteredSharedTodos);
      } else {
        setSharedTodos([]);
      }
    } catch (error) {
      console.error('Error fetching todos:', error);
    } finally {
      setIsLoadingTodos(false);
    }
  };

  // Refetch todos when selectedDate changes
  useEffect(() => {
    fetchTodos();
  }, [selectedDate, personalCalendars, sharedCalendars, child, isCalendarInitialized]);

  const loadCompletionStatus = (todos: TodoItem[], isShared: boolean) => {
    if (!id) return todos;
    
    return todos.map(todo => {
      const eventStartDate = startOfDay(new Date(todo.startTime)).toISOString();
      const storageKey = isShared 
        ? `shared-completion-${eventStartDate}`
        : `${id}-personal-completion-${eventStartDate}`;
      const savedStatus = localStorage.getItem(storageKey);
      
      if (!savedStatus) return todo;
      
      const completionStatus: Record<string, { 
        isDone: boolean; 
        completedAt?: string;
        completedBy?: {
          id: string;
          name: string;
          avatarUrl: string;
        };
      }> = JSON.parse(savedStatus);

      // Only show completion if it happened before or on the selected date
      const completedAt = completionStatus[todo.id]?.completedAt;
      const wasCompletedBySelectedDate = completedAt && new Date(completedAt) <= endOfDay(selectedDate);
      
      return {
        ...todo,
        isDone: wasCompletedBySelectedDate ? completionStatus[todo.id]?.isDone ?? false : false,
        completedAt: wasCompletedBySelectedDate ? completionStatus[todo.id]?.completedAt : undefined,
        completedBy: wasCompletedBySelectedDate ? completionStatus[todo.id]?.completedBy : undefined
      };
    });
  };

  const saveCompletionStatus = (todos: TodoItem[], isShared: boolean) => {
    if (!id) return;

    // Group todos by their start date
    const todosByStartDate = todos.reduce((acc, todo) => {
      const eventStartDate = startOfDay(new Date(todo.startTime)).toISOString();
      if (!acc[eventStartDate]) {
        acc[eventStartDate] = [];
      }
      acc[eventStartDate].push(todo);
      return acc;
    }, {} as Record<string, TodoItem[]>);

    // Save completion status for each start date
    Object.entries(todosByStartDate).forEach(([startDate, todosForDate]) => {
      const storageKey = isShared 
        ? `shared-completion-${startDate}`
        : `${id}-personal-completion-${startDate}`;
      
      const completionStatus = todosForDate.reduce((acc, todo) => {
        if (todo.isDone) {
          acc[todo.id] = {
            isDone: true,
            completedAt: todo.completedAt,
            completedBy: todo.completedBy
          };
        }
        return acc;
      }, {} as Record<string, any>);

      localStorage.setItem(storageKey, JSON.stringify(completionStatus));
    });
  };

  const toggleTodoStatus = (todo: TodoItem, isShared: boolean) => {
    const updateTodos = (todos: TodoItem[]) => {
      const updatedTodos = todos.map(t => {
        if (t.id === todo.id) {
          const newIsDone = !t.isDone;
          return { 
            ...t, 
            isDone: newIsDone,
            completedAt: newIsDone ? new Date().toISOString() : undefined,
            completedBy: newIsDone && child ? {
              id: child.id,
              name: child.name,
              avatarUrl: child.avatarUrl
            } : undefined
          };
        }
        return t;
      });
      saveCompletionStatus(updatedTodos, isShared);
      return updatedTodos;
    };

    if (isShared) {
      setSharedTodos(updateTodos(sharedTodos));
    } else {
      setPersonalTodos(updateTodos(personalTodos));
    }
  };

  const isOverdueChore = (todo: TodoItem) => {
    return !isAfter(new Date(todo.endTime), new Date()) && !todo.isDone;
  };

  const sortTodos = (todos: TodoItem[], isShared: boolean) => {
    const now = new Date();
    
    // Sort all todos by completion status and overdue status
    const incomplete = todos.filter(
      todo => !todo.isDone && isAfter(new Date(todo.endTime), now)
    );
    const completed = todos
      .filter(todo => todo.isDone)
      .sort((a, b) => {
        const aTime = new Date(a.completedAt || a.endTime).getTime();
        const bTime = new Date(b.completedAt || b.endTime).getTime();
        return bTime - aTime;  // Most recent first
      });
    const overdue = todos.filter(
      todo => !todo.isDone && !isAfter(new Date(todo.endTime), now)
    );

    return [...incomplete, ...completed, ...overdue];
  };

  const renderTodoList = (todos: TodoItem[], isShared: boolean) => {
    if (isLoadingTodos) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography>Loading chores...</Typography>
        </Box>
      );
    }

    if (todos.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Typography>No chores here!</Typography>
        </Box>
      );
    }

    return (
      <List>
        {sortTodos(loadCompletionStatus(todos, isShared), isShared).map((todo) => {
          return (
            <ListItem
              key={todo.id}
              onClick={() => !isOverdueChore(todo) ? toggleTodoStatus(todo, isShared) : undefined}
              sx={{
                bgcolor: todo.backgroundColor 
                  ? (theme) => `color-mix(in srgb, ${todo.backgroundColor}, ${theme.palette.background.paper} 50%)`
                  : ((theme) => theme.palette.background.paper === '#121212' 
                    ? 'rgba(255, 255, 255, 0.12)' 
                    : 'rgba(0, 0, 0, 0.12)'),
                my: 1,
                borderRadius: 1,
                height: 72,
                cursor: !isOverdueChore(todo) ? 'pointer' : 'default',
                '&:hover': !isOverdueChore(todo) ? {
                  bgcolor: todo.backgroundColor 
                    ? (theme) => `color-mix(in srgb, ${todo.backgroundColor}, ${theme.palette.background.paper} 40%)`
                    : (theme) => theme.palette.background.paper === '#121212'
                      ? 'rgba(255, 255, 255, 0.16)'
                      : 'rgba(0, 0, 0, 0.16)',
                } : {},
              }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  border: 2,
                  borderColor: todo.isDone 
                    ? 'primary.main' 
                    : isOverdueChore(todo)
                      ? 'error.main' 
                      : 'text.primary',
                  borderRadius: '50%',
                  mr: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isOverdueChore(todo) ? 0 : 1,
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
                secondary={
                  isShared && todo.completedBy 
                    ? `Completed by ${todo.completedBy.name}` 
                    :  isOverdueChore(todo)
                        ? "Chore not completed on time"
                        : todo.endTime.includes('T') 
                          ? (() => {
                              const endDate = new Date(todo.endTime);
                              const today = new Date();
                              return endDate.toDateString() === today.toDateString()
                                ? `Complete by ${format(endDate, 'h:mm a')}`
                                : `Complete by ${format(endDate, 'MMM d')} at ${format(endDate, 'h:mm a')}`;
                            })()
                          : (() => {
                              const endDate = new Date(todo.endTime);
                              const today = new Date();
                              return endDate.toDateString() === today.toDateString()
                                ? 'Complete by end of day'
                                : `Complete by end of ${format(endDate, 'MMM d')}`;
                            })()
                }
                sx={{
                  '.MuiListItemText-primary': {
                    textDecoration: todo.isDone 
                      ? 'line-through' 
                      : isOverdueChore(todo)
                        ? 'line-through' 
                        : 'none',
                    color: isOverdueChore(todo)
                      ? 'error.main'
                      : 'text.primary',
                  },
                  '.MuiListItemText-secondary': {
                    color: isOverdueChore(todo)
                      ? 'error.main'
                      : 'text.secondary',
                  }
                }}
              />
              {isShared && todo.completedBy && (
                <Avatar
                  src={todo.completedBy.avatarUrl}
                  alt={todo.completedBy.name}
                  sx={{ 
                    width: 32, 
                    height: 32,
                    ml: 2
                  }}
                />
              )}
            </ListItem>
          );
        })}
      </List>
    );
  };

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

  if (!child) {
    return <Typography>Child not found</Typography>;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bgcolor: 'background.default',
        zIndex: 1000,
        py: 2,
        px: 3
      }}>
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <IconButton
            onClick={() => navigate('/')}
            sx={{
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

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <IconButton 
                onClick={() => setSelectedDate(date => {
                  const newDate = new Date(date);
                  newDate.setDate(date.getDate() - 1);
                  return newDate;
                })}
                sx={{
                  bgcolor: (theme) => theme.palette.background.paper === '#121212'
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(100, 100, 100, .85)',
                  '&:hover': {
                    bgcolor: (theme) => theme.palette.background.paper === '#121212'
                      ? 'rgba(255, 255, 255, 0.16)'
                      : 'rgba(100, 100, 100, .5)',
                  },
                }}
              >
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h4" sx={{ textAlign: 'center' }}>
                {format(selectedDate, 'MMMM d, yyyy')}
              </Typography>
              {isBeforeToday && (
                <IconButton 
                  onClick={() => setSelectedDate(date => {
                    const newDate = new Date(date);
                    newDate.setDate(date.getDate() + 1);
                    return startOfDay(newDate).getTime() <= startOfDay(new Date()).getTime() 
                      ? newDate 
                      : new Date();
                  })}
                  sx={{
                    bgcolor: (theme) => theme.palette.background.paper === '#121212'
                      ? 'rgba(255, 255, 255, 0.12)'
                      : 'rgba(100, 100, 100, .85)',
                    '&:hover': {
                      bgcolor: (theme) => theme.palette.background.paper === '#121212'
                        ? 'rgba(255, 255, 255, 0.16)'
                        : 'rgba(100, 100, 100, .5)',
                    },
                  }}
                >
                  <ArrowForwardIcon />
                </IconButton>
              )}
            </Box>
            {child && (
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 2,
                  mt: 1 
                }}
              >
                <Avatar 
                  src={child.avatarUrl} 
                  alt={`${child.name}'s avatar`}
                  sx={{ width: 48, height: 48 }}
                />
                <Typography variant="h5" color="textSecondary">
                  {child.name}
                </Typography>
              </Box>
            )}
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 500 }}>
            {format(currentTime, 'h:mm a')}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ pt: 20, px: 4, pb: 4 }}>
        <Grid container spacing={2}>
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
    </Box>
  );
};

export default ChildPage;
