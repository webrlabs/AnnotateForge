/**
 * SimpleBlob tool settings popup
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
  Grid,
} from '@mui/material';

interface SimpleBlobParams {
  min_threshold: number;
  max_threshold: number;
  min_area: number;
  max_area: number;
  filter_by_circularity: boolean;
}

interface SimpleBlobSettingsProps {
  open: boolean;
  onClose: () => void;
  params: SimpleBlobParams;
  onParamsChange: (params: SimpleBlobParams) => void;
}

export const SimpleBlobSettings: React.FC<SimpleBlobSettingsProps> = ({
  open,
  onClose,
  params,
  onParamsChange,
}) => {
  const updateParam = <K extends keyof SimpleBlobParams>(
    key: K,
    value: SimpleBlobParams[K]
  ) => {
    onParamsChange({ ...params, [key]: value });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>SimpleBlob Detection Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {/* Threshold Range */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Threshold Range
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Pixel intensity range for blob detection
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" gutterBottom>
                  Min Threshold
                </Typography>
                <Slider
                  value={params.min_threshold}
                  onChange={(_, value) => updateParam('min_threshold', value as number)}
                  min={0}
                  max={255}
                  step={5}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0, label: '0' },
                    { value: 255, label: '255' },
                  ]}
                />
                <Typography variant="body2" align="center">
                  {params.min_threshold}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" gutterBottom>
                  Max Threshold
                </Typography>
                <Slider
                  value={params.max_threshold}
                  onChange={(_, value) => updateParam('max_threshold', value as number)}
                  min={0}
                  max={255}
                  step={5}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0, label: '0' },
                    { value: 255, label: '255' },
                  ]}
                />
                <Typography variant="body2" align="center">
                  {params.max_threshold}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          {/* Area Range */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Area Range (pixels)
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Min and max blob size in pixels
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" gutterBottom>
                  Min Area
                </Typography>
                <Slider
                  value={params.min_area}
                  onChange={(_, value) => updateParam('min_area', value as number)}
                  min={10}
                  max={5000}
                  step={10}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 10, label: '10' },
                    { value: 5000, label: '5K' },
                  ]}
                />
                <Typography variant="body2" align="center">
                  {params.min_area}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" gutterBottom>
                  Max Area
                </Typography>
                <Slider
                  value={params.max_area}
                  onChange={(_, value) => updateParam('max_area', value as number)}
                  min={10}
                  max={10000}
                  step={10}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 10, label: '10' },
                    { value: 10000, label: '10K' },
                  ]}
                />
                <Typography variant="body2" align="center">
                  {params.max_area}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          {/* Circularity Filter */}
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={params.filter_by_circularity}
                  onChange={(e) => updateParam('filter_by_circularity', e.target.checked)}
                />
              }
              label="Filter by Circularity"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
              {params.filter_by_circularity
                ? 'Only detect circular/round blobs'
                : 'Detect all blob shapes'}
            </Typography>
          </Box>

          {/* Info */}
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              SimpleBlob detects dark blobs on light backgrounds or light blobs on dark backgrounds.
              Adjust thresholds and area to match your blob characteristics.
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
