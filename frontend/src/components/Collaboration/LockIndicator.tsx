/**
 * LockIndicator component - Shows image lock status
 */
import React from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

export interface LockInfo {
  image_id: string;
  locked_by: string;
  locked_by_username: string;
  locked_at: string;
  expires_at: string;
}

interface LockIndicatorProps {
  lockInfo: LockInfo | null;
  currentUserId?: string;
  variant?: 'chip' | 'banner';
}

export const LockIndicator: React.FC<LockIndicatorProps> = ({
  lockInfo,
  currentUserId,
  variant = 'chip',
}) => {
  if (!lockInfo) {
    return null;
  }

  const isLockedByCurrentUser = lockInfo.locked_by === currentUserId;
  const expiresAt = new Date(lockInfo.expires_at);
  const now = new Date();
  const minutesRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / 60000);

  if (variant === 'chip') {
    if (isLockedByCurrentUser) {
      return (
        <Tooltip
          title={`You are editing this image. Lock expires in ${minutesRemaining} minutes.`}
          arrow
        >
          <Chip
            icon={<EditIcon sx={{ fontSize: '1rem' }} />}
            label="Editing"
            size="small"
            sx={{
              bgcolor: '#4caf50',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.8125rem',
              '& .MuiChip-icon': {
                color: 'white',
              },
              border: '2px solid #66bb6a',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          />
        </Tooltip>
      );
    }

    return (
      <Tooltip
        title={`Locked by ${lockInfo.locked_by_username}. Lock expires in ${minutesRemaining} minutes.`}
        arrow
      >
        <Chip
          icon={<LockIcon sx={{ fontSize: '1rem' }} />}
          label={`Locked by ${lockInfo.locked_by_username}`}
          size="small"
          sx={{
            bgcolor: '#f44336',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.8125rem',
            '& .MuiChip-icon': {
              color: 'white',
            },
            border: '2px solid #ef5350',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      </Tooltip>
    );
  }

  // Banner variant
  const bgColor = isLockedByCurrentUser ? 'success.light' : 'error.light';
  const textColor = isLockedByCurrentUser ? 'success.contrastText' : 'error.contrastText';

  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: bgColor,
        color: textColor,
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {isLockedByCurrentUser ? <EditIcon /> : <LockIcon />}
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" fontWeight="bold">
          {isLockedByCurrentUser
            ? 'You are editing this image'
            : `Locked by ${lockInfo.locked_by_username}`}
        </Typography>
        <Typography variant="caption">
          Lock expires in {minutesRemaining} minutes
          {isLockedByCurrentUser && '. Your changes are being auto-saved.'}
        </Typography>
      </Box>
    </Box>
  );
};

export default LockIndicator;
