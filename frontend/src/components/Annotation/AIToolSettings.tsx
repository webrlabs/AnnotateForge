/**
 * AI Tool Settings component - Model selection for YOLO
 */
import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Psychology as AIIcon,
} from '@mui/icons-material';
import { trainingAPI } from '@/services/trainingService';
import { TrainedModel } from '@/types/training';

interface AIToolSettingsProps {
  selectedYoloModelId: string | null;
  onYoloModelChange: (modelId: string | null) => void;
}

export const AIToolSettings: React.FC<AIToolSettingsProps> = ({
  selectedYoloModelId,
  onYoloModelChange,
}) => {
  const [models, setModels] = useState<TrainedModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadModels = async () => {
      try {
        // Fetch detection models only
        const data = await trainingAPI.getModels({ task_type: 'detect' });
        setModels(data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load trained models:', err);
        setLoading(false);
      }
    };
    loadModels();
  }, []);

  return (
    <Accordion defaultExpanded sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon fontSize="small" />
          <Typography variant="subtitle2">AI Tools</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box>
          <FormControl fullWidth size="small">
            <InputLabel>YOLO Model</InputLabel>
            <Select
              value={selectedYoloModelId || 'default'}
              label="YOLO Model"
              onChange={(e) => {
                const value = e.target.value === 'default' ? null : e.target.value;
                onYoloModelChange(value);
              }}
              disabled={loading}
            >
              <MenuItem value="default">
                <Box>
                  <Typography variant="body2">YOLOv8n (default)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pre-trained COCO model
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
            </Select>
          </FormControl>

          {selectedYoloModelId && models.find(m => m.id === selectedYoloModelId) && (
            <Card variant="outlined" sx={{ mt: 2 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Model Classes
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {Object.keys(models.find(m => m.id === selectedYoloModelId)!.classes).map((className) => (
                    <Chip key={className} label={className} size="small" variant="outlined" />
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Select a trained model or use the default pre-trained model for YOLO detection.
          </Typography>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};
