# OAuth Social Login Setup Guide

AnnotateForge supports social login via Google and GitHub OAuth. This allows users to sign in using their existing Google or GitHub accounts without creating a new password.

## Overview

OAuth integration provides:
- **Simplified onboarding** - Users can sign in with one click
- **Improved security** - No passwords to manage or leak
- **Auto-account creation** - New users are automatically registered
- **Seamless experience** - Works alongside traditional email/password login

---

## Prerequisites

Before setting up OAuth, you'll need:
1. A Google Cloud Platform account (for Google OAuth)
2. A GitHub account (for GitHub OAuth)
3. AnnotateForge backend and frontend running

---

## Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `AnnotateForge` (or any name you prefer)
4. Click "Create"

### Step 2: Enable Google OAuth 2.0

1. In your project, navigate to **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External** (for public access) or **Internal** (for organization)
   - App name: `AnnotateForge`
   - User support email: Your email
   - Developer contact email: Your email
   - Click **"Save and Continue"**
   - Add scopes: `email`, `profile`, `openid` (already included by default)
   - Click **"Save and Continue"**
   - Add test users (if External and in testing mode)
   - Click **"Save and Continue"**

### Step 3: Create OAuth 2.0 Credentials

1. Return to **Credentials** → **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
2. Application type: **Web application**
3. Name: `AnnotateForge Web Client`
4. **Authorized JavaScript origins:**
   - `http://localhost:8000`
   - `http://localhost:3000` (your frontend URL)
5. **Authorized redirect URIs:**
   - `http://localhost:8000/api/v1/auth/google/callback`
   - Add your production URL when deploying: `https://yourdomain.com/api/v1/auth/google/callback`
6. Click **"Create"**
7. **Copy the Client ID and Client Secret** - you'll need these for your `.env` file

### Step 4: Configure Environment Variables

Add to your `.env` file:

```bash
GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

---

## GitHub OAuth Setup

### Step 1: Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"OAuth Apps"** → **"New OAuth App"**
3. Fill in the details:
   - **Application name:** `AnnotateForge`
   - **Homepage URL:** `http://localhost:3000` (or your production URL)
   - **Authorization callback URL:** `http://localhost:8000/api/v1/auth/github/callback`
     - For production: `https://yourdomain.com/api/v1/auth/github/callback`
   - **Application description:** (optional) `Image annotation platform with AI-assisted labeling`
4. Click **"Register application"**

### Step 2: Generate Client Secret

1. After creating the app, you'll see the **Client ID** on the app page
2. Click **"Generate a new client secret"**
3. **Copy both the Client ID and Client Secret** immediately - you won't be able to see the secret again

### Step 3: Configure Environment Variables

Add to your `.env` file:

```bash
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

---

## Complete Environment Configuration

Your `.env` file should now include:

```bash
# OAuth Configuration
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123xyz789
GITHUB_CLIENT_ID=Iv1.a1b2c3d4e5f6g7h8
GITHUB_CLIENT_SECRET=abc123def456ghi789jkl012mno345pqr678stu
OAUTH_REDIRECT_URL=http://localhost:3000/auth/callback
```

---

## Testing OAuth Login

### Step 1: Restart Backend

After updating `.env`, rebuild and restart your backend:

```bash
docker-compose up -d --build backend
```

### Step 2: Test Google Login

1. Navigate to `http://localhost:3000/login`
2. Click **"Continue with Google"**
3. You should be redirected to Google's sign-in page
4. Select your Google account
5. Grant permissions to AnnotateForge
6. You should be redirected back and logged in automatically

### Step 3: Test GitHub Login

1. Navigate to `http://localhost:3000/login`
2. Click **"Continue with GitHub"**
3. You should be redirected to GitHub's authorization page
4. Click **"Authorize [your-app-name]"**
5. You should be redirected back and logged in automatically

---

## Troubleshooting

### "OAuth is not configured" Error

**Problem:** Backend returns 503 error when clicking OAuth login button.

**Solution:**
- Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`
- Restart the backend: `docker-compose restart backend`
- Check backend logs: `docker-compose logs backend`

### "Redirect URI mismatch" Error

**Problem:** Google/GitHub shows redirect URI error.

**Solution:**
- Verify the redirect URI in your OAuth app matches exactly:
  - Google: `http://localhost:8000/api/v1/auth/google/callback`
  - GitHub: `http://localhost:8000/api/v1/auth/github/callback`
- Check for trailing slashes (should not have one)
- Ensure protocol matches (http vs https)

### "Failed to fetch user info" Error

**Problem:** After OAuth callback, user info cannot be retrieved.

**Solution:**
- Check that the OAuth scopes include `email` and `profile`
- For GitHub, ensure email is public or the app has `user:email` scope
- Check backend logs for detailed error messages

### Can't Access GitHub Email

**Problem:** GitHub OAuth works but email is not retrieved.

**Solution:**
- Go to [GitHub Email Settings](https://github.com/settings/emails)
- Either:
  1. Make your email public, OR
  2. Ensure the OAuth app requests the `user:email` scope (it should by default)

---

## Production Deployment

When deploying to production:

### Update OAuth App URLs

**Google Cloud Console:**
1. Add production domain to **Authorized JavaScript origins:**
   - `https://yourdomain.com`
2. Add production callback to **Authorized redirect URIs:**
   - `https://yourdomain.com/api/v1/auth/google/callback`

**GitHub OAuth App:**
1. Update **Homepage URL:** `https://yourdomain.com`
2. Update **Authorization callback URL:** `https://yourdomain.com/api/v1/auth/google/callback`

### Update Environment Variables

```bash
# Production .env
OAUTH_REDIRECT_URL=https://yourdomain.com/auth/callback
GOOGLE_CLIENT_ID=your_production_google_client_id
GOOGLE_CLIENT_SECRET=your_production_google_client_secret
GITHUB_CLIENT_ID=your_production_github_client_id
GITHUB_CLIENT_SECRET=your_production_github_client_secret
```

### Security Best Practices

1. **Use HTTPS in production** - OAuth requires secure connections
2. **Keep secrets secure** - Never commit `.env` to version control
3. **Rotate secrets regularly** - Regenerate client secrets periodically
4. **Monitor OAuth usage** - Check for unusual login patterns
5. **Verify email domains** - Optionally restrict sign-ups to specific domains

---

## How It Works

### Authentication Flow

1. **User clicks "Continue with Google/GitHub"**
   - Frontend redirects to backend OAuth endpoint
   - Example: `GET http://localhost:8000/api/v1/auth/google/login`

2. **Backend redirects to OAuth provider**
   - Backend initiates OAuth flow with Google/GitHub
   - User sees Google/GitHub login page

3. **User authorizes AnnotateForge**
   - User signs in and grants permissions
   - OAuth provider redirects back to callback URL

4. **Backend processes OAuth callback**
   - Backend endpoint: `/api/v1/auth/google/callback`
   - Exchanges authorization code for access token
   - Retrieves user profile (email, name, etc.)

5. **User account creation/lookup**
   - If email exists: Log in existing user
   - If email doesn't exist: Create new user account
   - User model stores: `oauth_provider` and `oauth_id`

6. **JWT token generation**
   - Backend creates JWT token for the user
   - Redirects to frontend: `http://localhost:3000/auth/callback?token=<jwt_token>`

7. **Frontend completes authentication**
   - Frontend extracts token from URL
   - Stores token and fetches user info
   - Redirects user to dashboard

### Database Schema

OAuth users are stored with these additional fields:

```python
class User:
    # Standard fields
    id: UUID
    username: str
    email: str
    hashed_password: str | None  # NULL for OAuth users

    # OAuth fields
    oauth_provider: str | None  # 'google' or 'github'
    oauth_id: str | None       # Provider's unique user ID
```

**Note:** OAuth users have `hashed_password = NULL` since they don't use passwords.

---

## Optional Features

### Linking Multiple OAuth Providers

Users can link both Google and GitHub accounts to the same email:

1. User signs in with Google → Account created with Google OAuth
2. User signs in with GitHub (same email) → Logs into existing account, updates `oauth_provider` and `oauth_id`

### Converting OAuth Users to Password Users

Not supported by default. If needed, implement a "Set Password" feature allowing OAuth users to add a password.

### Disabling OAuth

To disable OAuth social login:

1. Remove `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` from `.env`
2. Restart backend
3. OAuth buttons will still appear but return "OAuth is not configured" error
4. To hide buttons: Remove OAuth button code from `frontend/src/components/Auth/Login.tsx`

---

## Support

For issues or questions:
- **GitHub Issues:** [https://github.com/webrlabs/annotateforge/issues](https://github.com/webrlabs/annotateforge/issues)
- **Documentation:** Check the main README.md and CONTRIBUTING.md

---

## Summary Checklist

- [ ] Created Google Cloud project and OAuth credentials
- [ ] Created GitHub OAuth app
- [ ] Added `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`
- [ ] Added `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to `.env`
- [ ] Set `OAUTH_REDIRECT_URL` in `.env`
- [ ] Restarted backend with `docker-compose up -d --build backend`
- [ ] Tested Google login successfully
- [ ] Tested GitHub login successfully
- [ ] Updated OAuth URLs for production (if deploying)

Your OAuth social login should now be fully functional!
