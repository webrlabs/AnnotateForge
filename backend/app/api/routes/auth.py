"""Authentication routes"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
import httpx

from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user
)
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token

router = APIRouter(prefix="/auth", tags=["authentication"])

# Configure OAuth
oauth = OAuth()

# Only register OAuth providers if credentials are configured
if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
    oauth.register(
        name='google',
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )

if settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET:
    oauth.register(
        name='github',
        client_id=settings.GITHUB_CLIENT_ID,
        client_secret=settings.GITHUB_CLIENT_SECRET,
        authorize_url='https://github.com/login/oauth/authorize',
        authorize_params=None,
        access_token_url='https://github.com/login/oauth/access_token',
        access_token_params=None,
        client_kwargs={'scope': 'user:email'}
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user

    Args:
        user_data: User registration data
        db: Database session

    Returns:
        Created user

    Raises:
        HTTPException: If username or email already exists
    """
    # Check if username exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Check if email exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Login user and return JWT token

    Args:
        credentials: Login credentials
        db: Database session

    Returns:
        JWT access token

    Raises:
        HTTPException: If credentials are invalid
    """
    # Find user
    user = db.query(User).filter(User.username == credentials.username).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/guest-login", response_model=Token)
def guest_login(db: Session = Depends(get_db)):
    """
    Login as a guest user (auto-creates temporary account)

    Args:
        db: Database session

    Returns:
        JWT access token for guest user

    Note:
        Guest users have limited permissions and data may be temporary
    """
    import uuid
    import secrets

    # Generate unique guest username
    guest_username = f"guest_{secrets.token_hex(4)}"
    guest_email = f"{guest_username}@guest.annotateforge.com"
    guest_password = secrets.token_urlsafe(32)

    # Create guest user
    hashed_password = get_password_hash(guest_password)
    guest_user = User(
        username=guest_username,
        email=guest_email,
        hashed_password=hashed_password,
        is_active=True,
        is_admin=False
    )

    db.add(guest_user)
    db.commit()
    db.refresh(guest_user)

    # Create access token
    access_token = create_access_token(data={"sub": str(guest_user.id)})

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current user information

    Args:
        current_user: Current authenticated user

    Returns:
        User information
    """
    return current_user


@router.get("/me/api-key")
def get_api_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's API key (generates one if it doesn't exist)

    Args:
        current_user: Current authenticated user
        db: Database session

    Returns:
        API key
    """
    # Generate API key if user doesn't have one
    if not current_user.api_key:
        current_user.api_key = User.generate_api_key()
        db.commit()
        db.refresh(current_user)

    return {"api_key": current_user.api_key}


@router.post("/me/api-key/regenerate")
def regenerate_api_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Regenerate user's API key

    Args:
        current_user: Current authenticated user
        db: Database session

    Returns:
        New API key
    """
    current_user.api_key = User.generate_api_key()
    db.commit()
    db.refresh(current_user)

    return {"api_key": current_user.api_key}


# Google OAuth Routes
@router.get("/google/login")
async def google_login(request: Request):
    """
    Initiate Google OAuth login flow

    Redirects user to Google's authorization page
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured"
        )

    redirect_uri = f"{request.base_url}api/v1/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    """
    Handle Google OAuth callback

    Exchanges authorization code for access token, retrieves user info,
    and creates or updates user account
    """
    try:
        # Get access token from Google
        token = await oauth.google.authorize_access_token(request)

        # Get user info from Google
        user_info = token.get('userinfo')
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to retrieve user information from Google"
            )

        email = user_info.get('email')
        oauth_id = user_info.get('sub')
        name = user_info.get('name', email.split('@')[0])

        if not email or not oauth_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email or user ID not provided by Google"
            )

        # Find or create user
        user = db.query(User).filter(User.email == email).first()

        if user:
            # Update OAuth info if user exists
            if not user.oauth_provider:
                user.oauth_provider = "google"
                user.oauth_id = oauth_id
                db.commit()
                db.refresh(user)
        else:
            # Create new user
            username = email.split('@')[0]
            # Ensure username is unique
            base_username = username
            counter = 1
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}{counter}"
                counter += 1

            user = User(
                username=username,
                email=email,
                hashed_password=None,  # No password for OAuth users
                oauth_provider="google",
                oauth_id=oauth_id,
                is_active=True,
                is_admin=False
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Create JWT token for our app
        access_token = create_access_token(data={"sub": str(user.id)})

        # Redirect to frontend with token
        return RedirectResponse(
            url=f"{settings.OAUTH_REDIRECT_URL}?token={access_token}&token_type=bearer"
        )

    except Exception as e:
        # Redirect to frontend with error
        return RedirectResponse(
            url=f"{settings.OAUTH_REDIRECT_URL}?error={str(e)}"
        )


# GitHub OAuth Routes
@router.get("/github/login")
async def github_login(request: Request):
    """
    Initiate GitHub OAuth login flow

    Redirects user to GitHub's authorization page
    """
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth is not configured"
        )

    redirect_uri = f"{request.base_url}api/v1/auth/github/callback"
    return await oauth.github.authorize_redirect(request, redirect_uri)


@router.get("/github/callback")
async def github_callback(request: Request, db: Session = Depends(get_db)):
    """
    Handle GitHub OAuth callback

    Exchanges authorization code for access token, retrieves user info,
    and creates or updates user account
    """
    try:
        # Get access token from GitHub
        token = await oauth.github.authorize_access_token(request)

        # GitHub doesn't return user info in token, need to fetch it
        access_token = token.get('access_token')
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to retrieve access token from GitHub"
            )

        # Fetch user info from GitHub API
        async with httpx.AsyncClient() as client:
            # Get basic user info
            user_response = await client.get(
                'https://api.github.com/user',
                headers={'Authorization': f'Bearer {access_token}'}
            )
            user_info = user_response.json()

            # Get user's primary email (if not public)
            email = user_info.get('email')
            if not email:
                emails_response = await client.get(
                    'https://api.github.com/user/emails',
                    headers={'Authorization': f'Bearer {access_token}'}
                )
                emails = emails_response.json()
                # Find primary email
                for email_obj in emails:
                    if email_obj.get('primary'):
                        email = email_obj.get('email')
                        break
                if not email and emails:
                    email = emails[0].get('email')

        oauth_id = str(user_info.get('id'))
        username = user_info.get('login')

        if not email or not oauth_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email or user ID not provided by GitHub"
            )

        # Find or create user
        user = db.query(User).filter(User.email == email).first()

        if user:
            # Update OAuth info if user exists
            if not user.oauth_provider:
                user.oauth_provider = "github"
                user.oauth_id = oauth_id
                db.commit()
                db.refresh(user)
        else:
            # Create new user
            # Ensure username is unique
            base_username = username
            counter = 1
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}{counter}"
                counter += 1

            user = User(
                username=username,
                email=email,
                hashed_password=None,  # No password for OAuth users
                oauth_provider="github",
                oauth_id=oauth_id,
                is_active=True,
                is_admin=False
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Create JWT token for our app
        access_token_jwt = create_access_token(data={"sub": str(user.id)})

        # Redirect to frontend with token
        return RedirectResponse(
            url=f"{settings.OAUTH_REDIRECT_URL}?token={access_token_jwt}&token_type=bearer"
        )

    except Exception as e:
        # Redirect to frontend with error
        return RedirectResponse(
            url=f"{settings.OAUTH_REDIRECT_URL}?error={str(e)}"
        )
