import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Divider,
  Stack,
} from '@mui/material';
import { Google as GoogleIcon, GitHub as GitHubIcon } from '@mui/icons-material';
import { useAuthStore } from '@/store/authStore';
import { authAPI } from '@/services/authService';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const token = searchParams.get('token');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      setError(`OAuth login failed: ${oauthError}`);
      return;
    }

    if (token) {
      // OAuth login successful, set token and fetch user info
      (async () => {
        try {
          setLoading(true);
          setAuth({ id: '', username: '', email: '', is_active: true, is_admin: false, created_at: '' }, token);
          const user = await authAPI.me();
          setAuth(user, token);
          navigate('/');
        } catch (err: any) {
          setError('Failed to fetch user info after OAuth login');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [searchParams, setAuth, navigate]);

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

  const handleGoogleLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    window.location.href = `${apiUrl}/auth/google/login`;
  };

  const handleGitHubLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    window.location.href = `${apiUrl}/auth/github/login`;
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
            AnnotateForge
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            Image Annotation Platform
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* OAuth Login Buttons */}
          <Stack spacing={2} sx={{ mb: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              disabled={loading}
              onClick={handleGoogleLogin}
              startIcon={<GoogleIcon />}
              sx={{
                textTransform: 'none',
                borderColor: '#4285F4',
                color: '#4285F4',
                '&:hover': {
                  borderColor: '#357ae8',
                  backgroundColor: 'rgba(66, 133, 244, 0.04)',
                },
              }}
            >
              Continue with Google
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              disabled={loading}
              onClick={handleGitHubLogin}
              startIcon={<GitHubIcon />}
              sx={{
                textTransform: 'none',
                borderColor: '#24292e',
                color: '#24292e',
                '&:hover': {
                  borderColor: '#1b1f23',
                  backgroundColor: 'rgba(36, 41, 46, 0.04)',
                },
              }}
            >
              Continue with GitHub
            </Button>
          </Stack>

          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Or use email
            </Typography>
          </Divider>

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
