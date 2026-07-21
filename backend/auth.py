from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from database.crud import get_user_by_username
from database.models import User, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

ALGORITHM = "HS256"


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        username: str = payload.get("sub", "")
        if not username:
            return None
    except JWTError:
        return None
    return get_user_by_username(db, username)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    user = get_current_user_optional(token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_roles(*roles: UserRole):
    allowed = set(roles) | {UserRole.ADMIN}

    def _resolve_role(raw) -> UserRole:
        if isinstance(raw, UserRole):
            return raw
        if isinstance(raw, str):
            # DB may store enum name ("ADMIN") or value ("admin")
            try:
                return UserRole[raw]
            except KeyError:
                pass
            try:
                return UserRole(raw)
            except ValueError:
                pass
            try:
                return UserRole(raw.lower())
            except ValueError:
                raise HTTPException(status_code=403, detail="Invalid role")
        return UserRole.INVESTIGATOR

    def _dep(user: User = Depends(get_current_user)) -> User:
        role = _resolve_role(user.role or UserRole.INVESTIGATOR)
        if role not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return _dep
