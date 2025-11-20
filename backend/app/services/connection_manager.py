"""WebSocket connection manager for multi-user collaboration"""
from fastapi import WebSocket
from typing import Dict, Set, List, Optional
from uuid import UUID
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time collaboration

    Features:
    - Track connections per image
    - Broadcast annotation changes to all viewers of an image
    - Track active users per image
    - Handle connection/disconnection cleanup
    """

    def __init__(self):
        # Map of image_id -> set of websocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

        # Map of websocket -> user info (image_id, user_id, username)
        self.connection_info: Dict[WebSocket, dict] = {}

    async def connect(
        self,
        websocket: WebSocket,
        image_id: str,
        user_id: str,
        username: str
    ):
        """
        Connect a new WebSocket client

        Args:
            websocket: WebSocket connection
            image_id: Image ID the user is viewing
            user_id: User ID
            username: Username for display
        """
        await websocket.accept()

        # Add to active connections for this image
        if image_id not in self.active_connections:
            self.active_connections[image_id] = set()
        self.active_connections[image_id].add(websocket)

        # Store connection info
        self.connection_info[websocket] = {
            "image_id": image_id,
            "user_id": user_id,
            "username": username
        }

        logger.info(f"User {username} connected to image {image_id}")

        # NOTE: Do NOT broadcast presence changes here!
        # Presence is managed by Redis (collaboration.py handles broadcasts)

    def disconnect(self, websocket: WebSocket, db_session=None):
        """
        Disconnect a WebSocket client and cleanup

        Args:
            websocket: WebSocket connection to disconnect
            db_session: Optional database session for lock cleanup
        """
        if websocket not in self.connection_info:
            return

        info = self.connection_info[websocket]
        image_id = info["image_id"]
        user_id = info["user_id"]
        username = info["username"]

        # Get active users BEFORE removing this connection
        users_before = self.get_active_users(image_id)

        # Remove from active connections
        if image_id in self.active_connections:
            self.active_connections[image_id].discard(websocket)

            # Remove empty image entries
            if not self.active_connections[image_id]:
                del self.active_connections[image_id]

        # Remove connection info
        del self.connection_info[websocket]

        # Get active users AFTER removing this connection
        users_after = self.get_active_users(image_id)

        logger.info(f"User {username} disconnected from image {image_id}")

        # NOTE: Do NOT broadcast presence changes here!
        # Presence is now managed by Redis and persists across WebSocket reconnections.
        # User presence is only removed when:
        # 1. User explicitly sends "leave" message
        # 2. User times out (no heartbeat for 30 seconds)

    async def broadcast_to_image(
        self,
        image_id: str,
        message: dict,
        exclude: Optional[WebSocket] = None
    ):
        """
        Broadcast a message to all connections viewing a specific image

        Args:
            image_id: Image ID to broadcast to
            message: Message dict to send (will be JSON serialized)
            exclude: Optional WebSocket to exclude from broadcast
        """
        if image_id not in self.active_connections:
            return

        # Get all connections for this image
        connections = self.active_connections[image_id].copy()

        # Remove dead connections
        dead_connections = set()

        for connection in connections:
            if connection == exclude:
                continue

            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to connection: {e}")
                dead_connections.add(connection)

        # Cleanup dead connections
        for connection in dead_connections:
            self.disconnect(connection)

    async def send_personal_message(
        self,
        websocket: WebSocket,
        message: dict
    ):
        """
        Send a message to a specific WebSocket connection

        Args:
            websocket: WebSocket to send to
            message: Message dict to send
        """
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)

    def get_active_users(self, image_id: str) -> List[dict]:
        """
        Get list of active users viewing an image

        Args:
            image_id: Image ID

        Returns:
            List of user dicts with user_id and username (deduplicated)
        """
        if image_id not in self.active_connections:
            return []

        # Use a dict to deduplicate users by user_id
        users_dict = {}
        for websocket in self.active_connections[image_id]:
            if websocket in self.connection_info:
                info = self.connection_info[websocket]
                user_id = info["user_id"]
                # Only add if not already present (deduplication)
                if user_id not in users_dict:
                    users_dict[user_id] = {
                        "user_id": user_id,
                        "username": info["username"]
                    }

        return list(users_dict.values())

    def get_connection_count(self, image_id: str) -> int:
        """
        Get number of active connections for an image

        Args:
            image_id: Image ID

        Returns:
            Number of active connections
        """
        if image_id not in self.active_connections:
            return 0
        return len(self.active_connections[image_id])

    async def broadcast_annotation_created(
        self,
        image_id: str,
        annotation: dict,
        user_id: str,
        exclude: Optional[WebSocket] = None
    ):
        """
        Broadcast that an annotation was created

        Args:
            image_id: Image ID
            annotation: Annotation data
            user_id: User who created it
            exclude: Optional WebSocket to exclude
        """
        await self.broadcast_to_image(
            image_id,
            {
                "type": "annotation_created",
                "annotation": annotation,
                "user_id": user_id
            },
            exclude=exclude
        )

    async def broadcast_annotation_updated(
        self,
        image_id: str,
        annotation: dict,
        user_id: str,
        exclude: Optional[WebSocket] = None
    ):
        """
        Broadcast that an annotation was updated

        Args:
            image_id: Image ID
            annotation: Updated annotation data
            user_id: User who updated it
            exclude: Optional WebSocket to exclude
        """
        await self.broadcast_to_image(
            image_id,
            {
                "type": "annotation_updated",
                "annotation": annotation,
                "user_id": user_id
            },
            exclude=exclude
        )

    async def broadcast_annotation_deleted(
        self,
        image_id: str,
        annotation_id: str,
        user_id: str,
        exclude: Optional[WebSocket] = None
    ):
        """
        Broadcast that an annotation was deleted

        Args:
            image_id: Image ID
            annotation_id: ID of deleted annotation
            user_id: User who deleted it
            exclude: Optional WebSocket to exclude
        """
        await self.broadcast_to_image(
            image_id,
            {
                "type": "annotation_deleted",
                "annotation_id": annotation_id,
                "user_id": user_id
            },
            exclude=exclude
        )


# Global connection manager instance
manager = ConnectionManager()
