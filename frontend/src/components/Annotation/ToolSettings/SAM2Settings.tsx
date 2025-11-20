/**
 * SAM2 tool settings popup
 */
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Slider,
  Typography,
  Box,
  FormControlLabel,
  Switch,
} from '@mui/material';

interface SAM2SettingsProps {
  open: boolean;
  onClose: () => void;
  multimaskOutput: boolean;
  onMultimaskChange: (value: boolean) => void;
}

export const SAM2Settings: React.FC<SAM2SettingsProps> = ({
  open,
  onClose,
  multimaskOutput,
  onMultimaskChange,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>SAM2 Segmentation Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {/* Multimask Output */}
          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={multimaskOutput}
                  onChange={(e) => onMultimaskChange(e.target.checked)}
                />
              }
              label="Multimask Output"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
              {multimaskOutput
                ? 'Generate 3 masks with different quality scores (best quality selected)'
                : 'Generate single best mask (faster)'}
            </Typography>
          </Box>

          {/* Instructions */}
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              How to use SAM2:
            </Typography>
            <Typography variant="body2" component="div">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Click to add positive points (include this area)</li>
                <li>Right-click to add negative points (exclude this area)</li>
                <li>SAM2 will generate a mask based on your points</li>
                <li>Add more points to refine the mask</li>
              </ul>
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
