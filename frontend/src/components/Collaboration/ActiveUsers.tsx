/**
 * ActiveUsers component - Shows who is currently viewing/editing an image
 */
import React from 'react';
import {
  Box,
  Avatar,
  AvatarGroup,
  Tooltip,
  Chip,
  Typography,
  Paper,
} from '@mui/material';
import { People as PeopleIcon } from '@mui/icons-material';
import { ActiveUser } from '@/hooks/useCollaboration';

interface ActiveUsersProps {
  users: ActiveUser[];
  currentUserId?: string;
  variant?: 'compact' | 'detailed';
}

const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 50%)`;
};

const getInitials = (username: string): string => {
  return username
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const ActiveUsers: React.FC<ActiveUsersProps> = ({
  users,
  currentUserId,
  variant = 'compact',
}) => {
  if (users.length === 0) {
    return null;
  }

  // Filter out current user for the "others" count
  const otherUsers = users.filter((u) => u.user_id !== currentUserId);

  if (variant === 'compact') {
    const MAX_AVATARS = 4;
    const hiddenCount = users.length > MAX_AVATARS ? users.length - MAX_AVATARS : 0;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PeopleIcon fontSize="small" color="action" />
        <AvatarGroup max={MAX_AVATARS} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.875rem' } }}>
          {users.map((user) => (
            <Tooltip key={user.user_id} title={user.username} arrow>
              <Avatar
                sx={{
                  bgcolor: stringToColor(user.username),
                  border: user.user_id === currentUserId ? '2px solid #1976d2' : 'none',
                }}
              >
                {getInitials(user.username)}
              </Avatar>
            </Tooltip>
          ))}
        </AvatarGroup>
        {/* Only show count if there are hidden users not displayed in avatars */}
        {hiddenCount > 0 && (
          <Typography variant="caption" color="text.secondary">
            +{hiddenCount} more
          </Typography>
        )}
      </Box>
    );
  }

  // Detailed variant
  return (
    <Paper elevation={1} sx={{ p: 2, maxWidth: 300 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PeopleIcon color="primary" />
        <Typography variant="h6">Active Users ({users.length})</Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {users.map((user) => {
          const isCurrentUser = user.user_id === currentUserId;

          return (
            <Box
              key={user.user_id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: isCurrentUser ? 'action.selected' : 'transparent',
              }}
            >
              <Avatar
                sx={{
                  bgcolor: stringToColor(user.username),
                  width: 32,
                  height: 32,
                  fontSize: '0.875rem',
                }}
              >
                {getInitials(user.username)}
              </Avatar>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {user.username}
              </Typography>
              {isCurrentUser && (
                <Chip label="You" size="small" color="primary" variant="outlined" />
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};

export default ActiveUsers;
