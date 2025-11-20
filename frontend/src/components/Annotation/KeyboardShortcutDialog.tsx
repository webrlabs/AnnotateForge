import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Grid,
  Divider,
  Chip,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface KeyboardShortcutDialogProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  category?: string;
}

export default function KeyboardShortcutDialog({ open, onClose }: KeyboardShortcutDialogProps) {
  const shortcuts: Shortcut[] = [
    // Tools
    { keys: ['V'], description: 'Select tool (click to select, drag to box select)', category: 'Manual Tools' },
    { keys: ['C'], description: 'Circle tool', category: 'Manual Tools' },
    { keys: ['R'], description: 'Rectangle tool', category: 'Manual Tools' },
    { keys: ['P'], description: 'Polygon tool', category: 'Manual Tools' },
    { keys: ['Enter'], description: 'Finish polygon or SAM2 segmentation', category: 'Manual Tools' },
    { keys: ['Esc'], description: 'Cancel current drawing', category: 'Manual Tools' },

    // AI Tools
    { keys: ['S'], description: 'SAM2 tool (click points, Enter to segment)', category: 'AI Tools' },
    { keys: ['Y'], description: 'YOLO detection (click to detect all)', category: 'AI Tools' },
    { keys: ['B'], description: 'SimpleBlob detection', category: 'AI Tools' },

    // Selection
    { keys: ['Click'], description: 'Select annotation', category: 'Selection' },
    { keys: ['Ctrl', 'Click'], description: 'Multi-select annotations', category: 'Selection' },
    { keys: ['Drag'], description: 'Box select (with Select tool)', category: 'Selection' },

    // Editing
    { keys: ['Ctrl', 'C'], description: 'Copy selected annotations', category: 'Editing' },
    { keys: ['Ctrl', 'V'], description: 'Paste annotations', category: 'Editing' },
    { keys: ['Ctrl', 'D'], description: 'Duplicate selected annotations', category: 'Editing' },
    { keys: ['Delete'], description: 'Delete selected annotations', category: 'Editing' },
    { keys: ['Ctrl', 'Z'], description: 'Undo', category: 'Editing' },
    { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo', category: 'Editing' },
    { keys: ['Ctrl', 'Y'], description: 'Redo (alternative)', category: 'Editing' },

    // Quick Class Assignment
    { keys: ['1-9'], description: 'Assign class to selected annotations', category: 'Quick Actions' },

    // Navigation
    { keys: ['←'], description: 'Previous image', category: 'Navigation' },
    { keys: ['→'], description: 'Next image', category: 'Navigation' },

    // Zoom
    { keys: ['+', '='], description: 'Zoom in', category: 'Zoom' },
    { keys: ['-'], description: 'Zoom out', category: 'Zoom' },
    { keys: ['Ctrl', '0'], description: 'Fit to screen', category: 'Zoom' },
    { keys: ['Ctrl', '1'], description: 'Actual size (1:1)', category: 'Zoom' },
    { keys: ['Mouse Wheel'], description: 'Zoom at pointer', category: 'Zoom' },
    { keys: ['Space', 'Drag'], description: 'Pan canvas', category: 'Zoom' },
  ];

  const categories = Array.from(new Set(shortcuts.map(s => s.category))).filter(Boolean);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Keyboard Shortcuts</Typography>
          <IconButton edge="end" onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pb: 2 }}>
          {categories.map((category) => (
            <Box key={category} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.main' }}>
                {category}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut, idx) => (
                    <Grid item xs={12} sm={6} key={idx}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {shortcut.description}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                          {shortcut.keys.map((key, keyIdx) => (
                            <Box key={keyIdx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Chip
                                label={key}
                                size="small"
                                sx={{
                                  fontFamily: 'monospace',
                                  fontWeight: 'bold',
                                  fontSize: '0.75rem',
                                  height: '24px',
                                  bgcolor: 'action.selected',
                                }}
                              />
                              {keyIdx < shortcut.keys.length - 1 && (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  +
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    </Grid>
                  ))}
              </Grid>
            </Box>
          ))}
        </Box>
        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
          Press <Chip label="?" size="small" sx={{ fontFamily: 'monospace', height: '20px', fontSize: '0.7rem' }} /> to toggle this dialog
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
