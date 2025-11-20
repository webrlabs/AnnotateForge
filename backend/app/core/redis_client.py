"""
Redis client for caching
"""
import redis
import json
import pickle
import hashlib
from typing import Any, Optional
from app.core.config import settings


class RedisCache:
    """Redis caching client for inference results and session data"""

    def __init__(self):
        """Initialize Redis connection"""
        self.client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=False  # We'll handle encoding ourselves
        )

    def _generate_key(self, prefix: str, *args, **kwargs) -> str:
        """
        Generate a cache key from arguments

        Args:
            prefix: Key prefix (e.g., 'sam2', 'yolo')
            *args: Positional arguments to hash
            **kwargs: Keyword arguments to hash

        Returns:
            Cache key string
        """
        # Create a deterministic string from args and kwargs
        data_str = json.dumps({
            'args': args,
            'kwargs': sorted(kwargs.items())
        }, sort_keys=True)

        # Hash it
        hash_digest = hashlib.sha256(data_str.encode()).hexdigest()[:16]

        return f"{prefix}:{hash_digest}"

    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache

        Args:
            key: Cache key

        Returns:
            Cached value or None
        """
        try:
            value = self.client.get(key)
            if value:
                return pickle.loads(value)
            return None
        except Exception as e:
            print(f"Redis get error: {e}")
            return None

    def set(
        self,
        key: str,
        value: Any,
        ttl: int = 3600
    ) -> bool:
        """
        Set value in cache

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (default 1 hour)

        Returns:
            True if successful
        """
        try:
            serialized = pickle.dumps(value)
            self.client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            print(f"Redis set error: {e}")
            return False

    def delete(self, key: str) -> bool:
        """
        Delete value from cache

        Args:
            key: Cache key

        Returns:
            True if successful
        """
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            print(f"Redis delete error: {e}")
            return False

    def get_inference_result(
        self,
        service: str,
        image_id: str,
        params: dict
    ) -> Optional[list]:
        """
        Get cached inference result

        Args:
            service: Service name ('sam2', 'yolo', 'simpleblob')
            image_id: Image UUID
            params: Inference parameters

        Returns:
            List of annotations or None
        """
        key = self._generate_key(
            f"inference:{service}",
            image_id,
            **params
        )
        return self.get(key)

    def set_inference_result(
        self,
        service: str,
        image_id: str,
        params: dict,
        results: list,
        ttl: int = 3600
    ) -> bool:
        """
        Cache inference result

        Args:
            service: Service name ('sam2', 'yolo', 'simpleblob')
            image_id: Image UUID
            params: Inference parameters
            results: Annotation results
            ttl: Cache TTL in seconds (default 1 hour)

        Returns:
            True if successful
        """
        key = self._generate_key(
            f"inference:{service}",
            image_id,
            **params
        )
        return self.set(key, results, ttl)

    def invalidate_image_cache(self, image_id: str):
        """
        Invalidate all cached inference results for an image

        Args:
            image_id: Image UUID
        """
        # Find all keys matching this image
        pattern = f"inference:*{image_id}*"
        try:
            keys = self.client.keys(pattern)
            if keys:
                self.client.delete(*keys)
        except Exception as e:
            print(f"Redis invalidate error: {e}")

    def get_session_data(self, session_id: str) -> Optional[dict]:
        """
        Get WebSocket session data

        Args:
            session_id: Session UUID

        Returns:
            Session data or None
        """
        key = f"session:{session_id}"
        return self.get(key)

    def set_session_data(
        self,
        session_id: str,
        data: dict,
        ttl: int = 1800
    ) -> bool:
        """
        Store WebSocket session data

        Args:
            session_id: Session UUID
            data: Session data
            ttl: TTL in seconds (default 30 minutes)

        Returns:
            True if successful
        """
        key = f"session:{session_id}"
        return self.set(key, data, ttl)

    def delete_session(self, session_id: str) -> bool:
        """
        Delete session data

        Args:
            session_id: Session UUID

        Returns:
            True if successful
        """
        key = f"session:{session_id}"
        return self.delete(key)

    def health_check(self) -> bool:
        """
        Check if Redis is healthy

        Returns:
            True if Redis is reachable
        """
        try:
            return self.client.ping()
        except Exception:
            return False


# Global Redis cache instance
redis_cache = RedisCache()
