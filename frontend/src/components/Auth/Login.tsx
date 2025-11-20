import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { useAuthStore } from '@/store/authStore';
import { authAPI } from '@/services/authService';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = await authAPI.login({ username, password });
      // Set the token first so the next API call has authorization
      setAuth({ id: '', username: '', email: '', is_active: true, is_admin: false, created_at: '' }, token.access_token);
      const user = await authAPI.me();
      setAuth(user, token.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const token = await authAPI.guestLogin();
      // Set the token first so the next API call has authorization
      setAuth({ id: '', username: '', email: '', is_active: true, is_admin: false, created_at: '' }, token.access_token);
      const user = await authAPI.me();
      setAuth(user, token.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Guest login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography variant="h4" align="center" gutterBottom>
            LabelFlow
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            Image Annotation Platform
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              margin="normal"
              required
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 3 }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <Button
            fullWidth
            variant="outlined"
            size="large"
            disabled={loading}
            onClick={handleGuestLogin}
            sx={{ mt: 2 }}
          >
            Continue as Guest
          </Button>

          <Typography variant="body2" align="center" sx={{ mt: 2 }}>
            Default credentials: admin / admin
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
