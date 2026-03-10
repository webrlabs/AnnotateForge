import { Box, Chip, Typography } from '@mui/material';
import { CLASS_COLORS } from '@/utils/classColors';

interface ClassHotkeyBarProps {
  classes: string[];
  activeClass?: string | null;
  onClassSelect?: (className: string) => void;
  onActiveClassChange?: (className: string | null) => void;
}

export default function ClassHotkeyBar({ classes, activeClass, onClassSelect, onActiveClassChange }: ClassHotkeyBarProps) {
  if (!classes || classes.length === 0) return null;

  const handleClick = (cls: string) => {
    if (onActiveClassChange) {
      // Toggle: clicking the active class deselects it
      onActiveClassChange(activeClass === cls ? null : cls);
    }
    onClassSelect?.(cls);
  };

  return (
    <Box sx={{
      display: 'flex', gap: 0.5, px: 1, py: 0.5,
      borderBottom: 1, borderColor: 'divider',
      overflowX: 'auto', flexShrink: 0,
      bgcolor: 'background.paper',
      alignItems: 'center',
    }}>
      <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', mr: 0.5, whiteSpace: 'nowrap' }}>
        Classes:
      </Typography>
      {classes.slice(0, 9).map((cls, index) => {
        const color = CLASS_COLORS[index % CLASS_COLORS.length];
        const isActive = activeClass === cls;
        return (
          <Chip
            key={cls}
            label={`${index + 1} ${cls}`}
            size="small"
            variant={isActive ? 'filled' : 'outlined'}
            onClick={() => handleClick(cls)}
            sx={{
              fontSize: '0.75rem',
              bgcolor: isActive ? color : undefined,
              color: isActive ? 'white' : undefined,
              borderColor: color,
              '&:hover': {
                bgcolor: color,
                color: 'white',
                opacity: 0.85,
              },
            }}
          />
        );
      })}
    </Box>
  );
}
