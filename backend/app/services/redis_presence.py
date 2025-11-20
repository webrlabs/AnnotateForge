"""Redis-based persistent presence tracking"""
import redis
import json
import time
from typing import List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class RedisPresenceStore:
    """
    Store user presence in Redis for persistence across WebSocket reconnections.

    State is stored as:
    - Key: presence:image:{image_id}
    - Value: Hash of {user_id: json({username, last_seen})}
    """

    def __init__(self, redis_url: str = "redis://redis:6379/0"):
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        self.timeout_seconds = 30  # Consider user gone after 30 seconds

    def _get_key(self, image_id: str) -> str:
        """Get Redis key for an image"""
        return f"presence:image:{image_id}"

    def join_image(self, image_id: str, user_id: str, username: str) -> bool:
        """
        Mark user as viewing an image.

        Returns:
            True if this is a new join (user wasn't present before)
            False if user was already present (reconnection)
        """
        key = self._get_key(image_id)

        # Check if user already exists
        was_present = self.redis_client.hexists(key, user_id)

        # Update/add user with current timestamp
        user_data = {
            "username": username,
            "last_seen": time.time()
        }
        self.redis_client.hset(key, user_id, json.dumps(user_data))

        # Set expiry on the key (auto-cleanup if no users)
        self.redis_client.expire(key, self.timeout_seconds * 2)

        # Return True only if this is a NEW join
        return not was_present

    def leave_image(self, image_id: str, user_id: str) -> Tuple[bool, Optional[str]]:
        """
        Mark user as leaving an image.

        Returns:
            (was_present, username): True if user was removed, username if found
        """
        key = self._get_key(image_id)

        # Get username before removing
        user_data_str = self.redis_client.hget(key, user_id)
        if not user_data_str:
            return False, None

        user_data = json.loads(user_data_str)
        username = user_data.get("username")

        # Remove user
        self.redis_client.hdel(key, user_id)

        return True, username

    def heartbeat(self, image_id: str, user_id: str) -> bool:
        """
        Update user's last_seen timestamp.

        Returns:
            True if user exists, False if user not found
        """
        key = self._get_key(image_id)

        # Get current user data
        user_data_str = self.redis_client.hget(key, user_id)
        if not user_data_str:
            return False

        # Update timestamp
        user_data = json.loads(user_data_str)
        user_data["last_seen"] = time.time()
        self.redis_client.hset(key, user_id, json.dumps(user_data))

        return True

    def get_active_users(self, image_id: str) -> List[dict]:
        """
        Get list of currently active users.
        Automatically removes timed-out users.

        Returns:
            List of {user_id, username} dicts
        """
        key = self._get_key(image_id)

        # Get all users
        all_users = self.redis_client.hgetall(key)
        if not all_users:
            return []

        current_time = time.time()
        active_users = []
        expired_users = []

        for user_id, user_data_str in all_users.items():
            user_data = json.loads(user_data_str)
            last_seen = user_data.get("last_seen", 0)

            # Check if user timed out
            if current_time - last_seen > self.timeout_seconds:
                expired_users.append(user_id)
                logger.info(f"User {user_data.get('username')} timed out on image {image_id}")
            else:
                active_users.append({
                    "user_id": user_id,
                    "username": user_data.get("username")
                })

        # Remove expired users
        if expired_users:
            self.redis_client.hdel(key, *expired_users)

        return active_users

    def cleanup_expired_users(self, image_id: str) -> List[dict]:
        """
        Remove expired users and return list of who was removed.

        Returns:
            List of {user_id, username} dicts for removed users
        """
        key = self._get_key(image_id)
        all_users = self.redis_client.hgetall(key)

        if not all_users:
            return []

        current_time = time.time()
        removed_users = []

        for user_id, user_data_str in all_users.items():
            user_data = json.loads(user_data_str)
            last_seen = user_data.get("last_seen", 0)

            if current_time - last_seen > self.timeout_seconds:
                removed_users.append({
                    "user_id": user_id,
                    "username": user_data.get("username")
                })
                self.redis_client.hdel(key, user_id)
                logger.info(f"Removed expired user {user_data.get('username')} from image {image_id}")

        return removed_users


# Global instance
redis_presence = RedisPresenceStore()
