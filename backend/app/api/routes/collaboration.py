"""Collaboration WebSocket routes"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from uuid import UUID
import logging
import asyncio

from app.core.database import get_db
from app.models.user import User
from app.services.connection_manager import manager
from app.services.redis_presence import redis_presence

router = APIRouter(prefix="/collaboration", tags=["collaboration"])
logger = logging.getLogger(__name__)


async def cleanup_expired_users_periodically(image_id: str):
    """
    Periodically check for and remove expired users.
    Broadcasts updates only when users are actually removed.

    Args:
        image_id: Image ID
    """
    while True:
        try:
            await asyncio.sleep(10)  # Check every 10 seconds

            # Check for and remove expired users
            removed_users = redis_presence.cleanup_expired_users(image_id)

            if removed_users:
                # Users timed out, broadcast updates
                for user in removed_users:
                    logger.info(f"User {user['username']} timed out on image {image_id}")

                # Broadcast updated active users list
                active_users = redis_presence.get_active_users(image_id)
                await manager.broadcast_to_image(
                    image_id,
                    {
                        "type": "active_users",
                        "users": active_users
                    }
                )

        except asyncio.CancelledError:
            # Task cancelled, exit loop
            break
        except Exception as e:
            logger.error(f"Error in cleanup_expired_users_periodically: {e}")


@router.websocket("/ws/{image_id}")
async def websocket_collaboration(
    websocket: WebSocket,
    image_id: UUID,
    token: str,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time collaboration on an image

    Uses Redis for persistent presence state that survives reconnections.

    Args:
        websocket: WebSocket connection
        image_id: Image ID being viewed/edited
        token: JWT authentication token (passed as query param)
        db: Database session

    Messages:
    - heartbeat: Client sends to maintain presence (doesn't trigger broadcasts)
    - leave: Client explicitly leaving (triggers broadcast)
    - active_users: List of currently active users
    - annotation_created/updated/deleted: Annotation changes
    - cursor_move: User's cursor position
    """
    user = None
    cleanup_task = None
    is_new_join = False

    try:
        # Authenticate user from token
        from app.core.security import decode_access_token
        from jose import JWTError

        try:
            payload = decode_access_token(token)
            user_id = payload.get("sub")
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
        except JWTError:
            await websocket.close(code=1008, reason="Invalid authentication token")
            return

        if not user:
            await websocket.close(code=1008, reason="User not found")
            return

        # Connect WebSocket (for message routing)
        await manager.connect(
            websocket=websocket,
            image_id=str(image_id),
            user_id=str(user.id),
            username=user.username
        )

        # Join image in Redis - this persists across reconnections
        is_new_join = redis_presence.join_image(str(image_id), str(user.id), user.username)

        if is_new_join:
            # This is a REAL join (not a reconnection), broadcast to others
            logger.info(f"User {user.username} JOINED image {image_id}")
            await manager.broadcast_to_image(
                str(image_id),
                {
                    "type": "active_users",
                    "users": redis_presence.get_active_users(str(image_id))
                },
                exclude=websocket
            )
        else:
            # This is a reconnection, don't broadcast
            logger.info(f"User {user.username} RECONNECTED to image {image_id}")

        # Send current active users to this connection
        active_users = redis_presence.get_active_users(str(image_id))
        await websocket.send_json({
            "type": "active_users",
            "users": active_users
        })

        # Start cleanup task (only one per connection)
        cleanup_task = asyncio.create_task(
            cleanup_expired_users_periodically(str(image_id))
        )

        # Listen for messages
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "heartbeat":
                # Update last_seen timestamp - no broadcast
                redis_presence.heartbeat(str(image_id), str(user.id))

            elif message_type == "leave":
                # User explicitly leaving
                was_present, username = redis_presence.leave_image(str(image_id), str(user.id))
                if was_present:
                    logger.info(f"User {username} explicitly LEFT image {image_id}")
                    # Broadcast updated user list
                    await manager.broadcast_to_image(
                        str(image_id),
                        {
                            "type": "active_users",
                            "users": redis_presence.get_active_users(str(image_id))
                        }
                    )

            elif message_type == "cursor_move":
                # Broadcast cursor position to others
                await manager.broadcast_to_image(
                    str(image_id),
                    {
                        "type": "cursor_move",
                        "user_id": str(user.id),
                        "username": user.username,
                        "x": data.get("x"),
                        "y": data.get("y")
                    },
                    exclude=websocket
                )

            elif message_type == "ping":
                # Keep-alive ping (also acts as heartbeat)
                redis_presence.heartbeat(str(image_id), str(user.id))
                await manager.send_personal_message(
                    websocket,
                    {"type": "pong"}
                )

            else:
                logger.warning(f"Unknown message type: {message_type}")

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {user.username if user else 'unknown'}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Cancel cleanup task
        if cleanup_task:
            cleanup_task.cancel()

        # Cleanup WebSocket connection (for message routing)
        manager.disconnect(websocket, db_session=db)

        # NOTE: Do NOT remove from Redis presence here!
        # User presence persists across WebSocket reconnections.
        # Users are only removed when:
        # 1. They explicitly send "leave" message
        # 2. They timeout (no heartbeat for 30 seconds)
