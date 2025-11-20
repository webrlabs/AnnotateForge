/**
 * User Profile page - displays user info and API key management
 */
import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Alert,
  Divider,
  Stack,
  Paper,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  ContentCopy,
  Refresh,
  Person,
  Email,
  Key,
} from '@mui/icons-material';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';

export const UserProfile = () => {
  const { user } = useAuthStore();
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch API key on component mount
  useEffect(() => {
    fetchApiKey();
  }, []);

  const fetchApiKey = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/auth/me/api-key');
      setApiKey(response.data.api_key);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch API key');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!confirm('Are you sure you want to regenerate your API key? The old key will stop working immediately.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.post('/auth/me/api-key/regenerate');
      setApiKey(response.data.api_key);
      setShowApiKey(true); // Show the new key
      alert('API key regenerated successfully!');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to regenerate API key');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const maskedKey = apiKey ? '*'.repeat(40) + apiKey.slice(-8) : '';

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        User Profile
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* User Information Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person /> User Information
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Username
              </Typography>
              <Typography variant="body1">{user?.username}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Email
              </Typography>
              <Typography variant="body1">{user?.email}</Typography>
            </Box>

            {user?.is_admin && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Role
                </Typography>
                <Typography variant="body1" color="primary">
                  Administrator
                </Typography>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* API Key Management Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Key /> API Key
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary" paragraph>
            Use this API key to authenticate programmatic access to the AnnotateForge API.
            Keep it secure and never share it publicly.
          </Typography>

          <TextField
            fullWidth
            value={showApiKey ? apiKey : maskedKey}
            disabled={loading}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowApiKey(!showApiKey)}
                    edge="end"
                    disabled={loading || !apiKey}
                  >
                    {showApiKey ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                  <IconButton
                    onClick={handleCopyKey}
                    edge="end"
                    disabled={loading || !apiKey}
                    color={copySuccess ? 'success' : 'default'}
                  >
                    <ContentCopy />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          {copySuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              API key copied to clipboard!
            </Alert>
          )}

          <Button
            variant="outlined"
            color="warning"
            startIcon={<Refresh />}
            onClick={handleRegenerateKey}
            disabled={loading}
          >
            Regenerate API Key
          </Button>
        </CardContent>
      </Card>

      {/* Usage Instructions Card */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Using Your API Key
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" paragraph>
            Include your API key in the request headers when making API calls:
          </Typography>

          <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'grey.100', fontFamily: 'monospace', fontSize: '0.875rem', overflow: 'auto' }}>
            <pre style={{ margin: 0 }}>
{`# Using cURL
curl -H "X-API-Key: YOUR_API_KEY" \\
  http://localhost:8000/api/v1/inference/yolo/detect

# Using Python requests
import requests

headers = {"X-API-Key": "YOUR_API_KEY"}
response = requests.post(
    "http://localhost:8000/api/v1/inference/yolo/detect",
    headers=headers,
    files={"file": open("image.jpg", "rb")}
)

# Using JavaScript fetch
fetch("http://localhost:8000/api/v1/inference/yolo/detect", {
  method: "POST",
  headers: {
    "X-API-Key": "YOUR_API_KEY"
  },
  body: formData
});`}
            </pre>
          </Paper>

          <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
            For complete API documentation and examples, visit the{' '}
            <a href="/docs/api" style={{ color: '#1976d2' }}>API Docs</a> page.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};
