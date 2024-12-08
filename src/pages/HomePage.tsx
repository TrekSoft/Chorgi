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
} from '@mui/material';
import { useGoogleLogin } from '@react-oauth/google';
import { Child } from '../types';

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

  const login = useGoogleLogin({
    onSuccess: async (response) => {
      setIsLoading(true);
      setError(null);
      try {
        const userInfoResponse = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: {
              Authorization: `Bearer ${response.access_token}`,
            },
          }
        );
        
        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user info');
        }
        
        const userInfo = await userInfoResponse.json();
        
        const newChild: Child = {
          id: crypto.randomUUID(),
          name: userInfo.name,
          avatarUrl: userInfo.picture,
          googleId: userInfo.sub,
          calendarId: userInfo.email,
          googleToken: {
            access_token: response.access_token,
            token_type: 'Bearer',
          },
        };

        const updatedChildren = [...children, newChild];
        setChildren(updatedChildren);
        localStorage.setItem('children', JSON.stringify(updatedChildren));
      } catch (error) {
        console.error('Error fetching user info:', error);
        setError('Failed to connect Google account. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google OAuth Error:', error);
      setError('Failed to connect Google account. Please try again.');
    },
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.readonly profile email',
  });

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
      {/* Logo */}
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

      {/* Title */}
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

      {/* Children Grid */}
      <Grid container spacing={3} sx={{ maxWidth: 1200, mx: 'auto' }}>
        {children.map((child) => (
          <Grid item xs={12} sm={6} md={4} key={child.id}>
            <Card>
              <CardActionArea
                onClick={() => navigate(`/child/${child.id}`)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  p: 3,
                }}
              >
                <Avatar
                  src={child.avatarUrl}
                  alt={child.name}
                  sx={{ width: 80, height: 80, mb: 2 }}
                />
                <Typography variant="h6" component="div">
                  {child.name}
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Add Child Button */}
      <Button
        variant="contained"
        onClick={() => login()}
        disabled={isLoading}
        sx={{ mb: 4, my: 8 }}
      >
        {isLoading ? 'Connecting...' : 'Add Child'}
      </Button>
    </Box>
  );
};

export default HomePage;
