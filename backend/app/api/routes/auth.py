"""Authentication routes"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user
)
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token

router = APIRouter(prefix="/auth", tags=["authentication"])


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
    guest_email = f"{guest_username}@guest.labelflow.com"
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
