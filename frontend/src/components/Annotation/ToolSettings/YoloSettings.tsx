/**
 * YOLO tool settings popup
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Typography,
  Box,
  Chip,
  CircularProgress,
} from '@mui/material';
import { trainingAPI } from '@/services/trainingService';
import { TrainedModel } from '@/types/training';

interface YoloSettingsProps {
  open: boolean;
  onClose: () => void;
  selectedModelId: string | null;
  confidence: number;
  onModelChange: (modelId: string | null) => void;
  onConfidenceChange: (confidence: number) => void;
}

export const YoloSettings: React.FC<YoloSettingsProps> = ({
  open,
  onClose,
  selectedModelId,
  confidence,
  onModelChange,
  onConfidenceChange,
}) => {
  const [models, setModels] = useState<TrainedModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadModels();
    }
  }, [open]);

  const loadModels = async () => {
    try {
      const data = await trainingAPI.getModels({ task_type: 'detect' });
      setModels(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load trained models:', err);
      setLoading(false);
    }
  };

  const selectedModel = models.find(m => m.id === selectedModelId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>YOLO Detection Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {/* Model Selection */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Model</InputLabel>
            <Select
              value={selectedModelId || 'default'}
              label="Model"
              onChange={(e) => {
                const value = e.target.value === 'default' ? null : e.target.value;
                onModelChange(value);
              }}
              disabled={loading}
            >
              <MenuItem value="default">
                <Box>
                  <Typography variant="body2">YOLOv8n (default)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pre-trained COCO model - 80 classes
                  </Typography>
                </Box>
              </MenuItem>

              {models.length > 0 && (
                <MenuItem disabled>
                  <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                    — Custom Trained Models —
                  </Typography>
                </MenuItem>
              )}

              {models.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  <Box sx={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="body2">{model.name}</Typography>
                      {model.is_active && (
                        <Chip label="Active" size="small" color="success" sx={{ ml: 1, height: 18 }} />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {model.num_classes} classes • {model.model_type}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}

              {models.length === 0 && !loading && (
                <MenuItem disabled>
                  <Typography variant="caption" color="text.secondary">
                    No custom models available
                  </Typography>
                </MenuItem>
              )}

              {loading && (
                <MenuItem disabled>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption">Loading models...</Typography>
                  </Box>
                </MenuItem>
              )}
            </Select>
          </FormControl>

          {/* Show selected model classes */}
          {selectedModel && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Model Classes ({selectedModel.num_classes})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {Object.keys(selectedModel.classes).slice(0, 10).map((className) => (
                  <Chip key={className} label={className} size="small" variant="outlined" />
                ))}
                {Object.keys(selectedModel.classes).length > 10 && (
                  <Chip
                    label={`+${Object.keys(selectedModel.classes).length - 10} more`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>
          )}

          {/* Confidence Threshold */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Confidence Threshold
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Minimum confidence score for detections (lower = more detections)
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={confidence}
                onChange={(_, value) => onConfidenceChange(value as number)}
                min={0.1}
                max={0.95}
                step={0.05}
                marks={[
                  { value: 0.1, label: '0.1' },
                  { value: 0.5, label: '0.5' },
                  { value: 0.95, label: '0.95' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => value.toFixed(2)}
              />
            </Box>
            <Typography variant="body2" align="center" sx={{ mt: 1 }}>
              Current: {confidence.toFixed(2)}
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
