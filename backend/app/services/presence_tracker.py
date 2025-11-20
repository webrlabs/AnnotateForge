"""Heartbeat-based presence tracking for collaboration"""
from typing import Dict, List, Set
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class PresenceTracker:
    """
    Track user presence based on heartbeats instead of WebSocket connections.

    This is more reliable than connection-based tracking because WebSocket
    connections can be unstable and reconnect frequently.
    """

    def __init__(self, timeout_seconds: int = 15):
        """
        Initialize presence tracker

        Args:
            timeout_seconds: How long to wait before considering a user inactive
        """
        self.timeout_seconds = timeout_seconds

        # Map of image_id -> user_id -> last_heartbeat_time
        self.heartbeats: Dict[str, Dict[str, datetime]] = {}

        # Map of image_id -> user_id -> username
        self.user_info: Dict[str, Dict[str, str]] = {}

    def heartbeat(self, image_id: str, user_id: str, username: str):
        """
        Record a heartbeat from a user

        Args:
            image_id: Image ID the user is viewing
            user_id: User ID
            username: Username for display
        """
        now = datetime.utcnow()

        if image_id not in self.heartbeats:
            self.heartbeats[image_id] = {}
            self.user_info[image_id] = {}

        self.heartbeats[image_id][user_id] = now
        self.user_info[image_id][user_id] = username

        logger.debug(f"Heartbeat from {username} on image {image_id}")

    def remove_user(self, image_id: str, user_id: str):
        """
        Explicitly remove a user's presence

        Args:
            image_id: Image ID
            user_id: User ID to remove
        """
        if image_id in self.heartbeats:
            self.heartbeats[image_id].pop(user_id, None)
            self.user_info[image_id].pop(user_id, None)

            # Clean up empty entries
            if not self.heartbeats[image_id]:
                del self.heartbeats[image_id]
                del self.user_info[image_id]

    def get_active_users(self, image_id: str) -> List[dict]:
        """
        Get list of currently active users for an image

        Users are considered active if they've sent a heartbeat within
        the timeout period.

        Args:
            image_id: Image ID

        Returns:
            List of user dicts with user_id and username
        """
        if image_id not in self.heartbeats:
            return []

        now = datetime.utcnow()
        timeout = timedelta(seconds=self.timeout_seconds)
        active_users = []
        expired_users = []

        for user_id, last_heartbeat in self.heartbeats[image_id].items():
            if now - last_heartbeat < timeout:
                # User is active
                active_users.append({
                    "user_id": user_id,
                    "username": self.user_info[image_id].get(user_id, "Unknown")
                })
            else:
                # User timed out
                expired_users.append(user_id)

        # Clean up expired users
        for user_id in expired_users:
            logger.info(f"User {self.user_info[image_id].get(user_id)} timed out on image {image_id}")
            self.heartbeats[image_id].pop(user_id, None)
            self.user_info[image_id].pop(user_id, None)

        # Clean up empty entries
        if not self.heartbeats[image_id]:
            del self.heartbeats[image_id]
            del self.user_info[image_id]

        return active_users

    def cleanup_image(self, image_id: str):
        """
        Remove all presence data for an image

        Args:
            image_id: Image ID to clean up
        """
        self.heartbeats.pop(image_id, None)
        self.user_info.pop(image_id, None)


# Global presence tracker instance
presence_tracker = PresenceTracker(timeout_seconds=15)
