import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Grid,
  Typography,
  Card,
  CardActionArea,
  Avatar,
  Link,
} from '@mui/material';
import { useGoogleLogin } from '@react-oauth/google';
import { Child } from '../types';
import { differenceInDays, parse, addYears, isAfter } from 'date-fns';

const HomePage: React.FC = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedChildren = localStorage.getItem('children');
    if (savedChildren) {
      setChildren(JSON.parse(savedChildren));
    }
  }, []);

  const getDaysUntilBirthday = (birthdate?: string) => {
    if (!birthdate) return null;
    
    const today = new Date();
    const birthdateObj = parse(birthdate, 'yyyy-MM-dd', new Date());
    let nextBirthday = new Date(today.getFullYear(), birthdateObj.getMonth(), birthdateObj.getDate());
    
    if (isAfter(today, nextBirthday)) {
      nextBirthday = addYears(nextBirthday, 1);
    }
    
    return differenceInDays(nextBirthday, today);
  };

  const login = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (codeResponse) => {
      setIsLoading(true);
      setError(null);
      try {
        // Exchange code for tokens
        const tokensResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code: codeResponse.code,
            client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID!,
            client_secret: process.env.REACT_APP_GOOGLE_CLIENT_SECRET!,
            redirect_uri: window.location.origin,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokensResponse.ok) {
          throw new Error('Failed to exchange code for tokens');
        }

        const tokens = await tokensResponse.json();
        
        // Get user info with access token
        const userInfoResponse = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          }
        );
        
        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user info');
        }
        
        const userInfo = await userInfoResponse.json();

        // Get birthdate from Google People API
        const peopleResponse = await fetch(
          'https://people.googleapis.com/v1/people/me?personFields=birthdays',
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          }
        );

        let birthdate: string | undefined;
        if (peopleResponse.ok) {
          const peopleData = await peopleResponse.json();
          const birthday = peopleData.birthdays?.[0]?.date;
          if (birthday) {
            birthdate = `${birthday.year || '2000'}-${String(birthday.month).padStart(2, '0')}-${String(birthday.day).padStart(2, '0')}`;
          }
        }
        
        const newChild: Child = {
          id: crypto.randomUUID(),
          name: userInfo.name,
          avatarUrl: userInfo.picture,
          googleId: userInfo.sub,
          calendarId: userInfo.email,
          birthdate,
          googleToken: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: 'Bearer',
            expiry_date: Date.now() + (tokens.expires_in * 1000),
          },
        };

        const updatedChildren = [...children, newChild];
        setChildren(updatedChildren);
        localStorage.setItem('children', JSON.stringify(updatedChildren));
      } catch (error) {
        console.error('Error setting up child account:', error);
        setError('Failed to connect Google account. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google OAuth Error:', error);
      setError('Failed to connect Google account. Please try again.');
    },
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/user.birthday.read profile email',
  });

  const refreshAccessToken = async (child: Child): Promise<boolean> => {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID!,
          client_secret: process.env.REACT_APP_GOOGLE_CLIENT_SECRET!,
          refresh_token: child.googleToken.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        return false;
      }

      const tokens = await response.json();
      
      // Update the child's token in state and localStorage
      const updatedChild = {
        ...child,
        googleToken: {
          ...child.googleToken,
          access_token: tokens.access_token,
          expiry_date: Date.now() + (tokens.expires_in * 1000),
        },
      };

      const updatedChildren = children.map(c => 
        c.id === child.id ? updatedChild : c
      );
      setChildren(updatedChildren);
      localStorage.setItem('children', JSON.stringify(updatedChildren));
      
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  };

  const handleChildClick = async (child: Child) => {
    // Check if token is expired (with 5 minute buffer)
    const isExpired = true;
    
    if (isExpired) {
      const success = await refreshAccessToken(child);
      if (!success) {
        // Remove child from state and localStorage
        const updatedChildren = children.filter(c => c.id !== child.id);
        setChildren(updatedChildren);
        localStorage.setItem('children', JSON.stringify(updatedChildren));
        setError('Failed to refresh access token. Please add the child again.');
        return;
      }
    }
    
    navigate(`/child/${child.id}`);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        p: 3,
      }}
    >
      <Box
        component="img"
        src="/chorgi.png"
        alt="Chorgi Logo"
        sx={{
          width: 120,
          height: 120,
          mb: 2,
        }}
      />

      <Typography
        variant="h2"
        component="h1"
        sx={{ color: 'primary.main', mb: 4 }}
      >
        Chorgi
      </Typography>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Grid container spacing={3} sx={{ maxWidth: 1200, mx: 'auto' }}>
        {children.map((child) => (
          <Grid item xs={12} sm={6} md={4} key={child.id}>
            <Card>
              <CardActionArea
                onClick={() => handleChildClick(child)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  p: 2,
                }}
              >
                <Avatar
                  src={child.avatarUrl}
                  alt={child.name}
                  sx={{ width: 80, height: 80, mb: 1 }}
                />
                <Typography variant="h6" component="div">
                  {child.name}
                </Typography>
                {child.birthdate && (
                  <Typography variant="body2" color="text.secondary">
                    {getDaysUntilBirthday(child.birthdate)} days until birthday
                  </Typography>
                )}
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Button
        variant="contained"
        onClick={() => login()}
        disabled={isLoading}
        sx={{ mb: 4, my: 8 }}
      >
        {isLoading ? 'Connecting...' : 'Add Child'}
      </Button>

      <Link
        href="/privacy.html"
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          color: 'text.secondary',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
          mt: 2,
        }}
      >
        Privacy Policy
      </Link>
    </Box>
  );
};

export default HomePage;
