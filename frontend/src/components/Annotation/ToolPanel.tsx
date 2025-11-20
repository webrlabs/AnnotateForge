import { useState } from 'react';
import { Box, IconButton, Tooltip, Divider, Typography, Badge } from '@mui/material';
import {
  PanTool as SelectIcon,
  Circle as CircleIcon,
  CropSquare as BoxIcon,
  Rectangle as RectangleIcon,
  Polyline as PolygonIcon,
  AutoFixHigh as SAM2Icon,
  ViewInAr as YOLOIcon,
  BubbleChart as SimpleBlobIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useUIStore } from '@/store/uiStore';
import { ToolType } from '@/types';
import { YoloSettings } from './ToolSettings/YoloSettings';
import { SAM2Settings } from './ToolSettings/SAM2Settings';
import { SimpleBlobSettings } from './ToolSettings/SimpleBlobSettings';

interface ToolPanelProps {
  yoloModelId: string | null;
  yoloConfidence: number;
  sam2Multimask: boolean;
  simpleBlobParams: {
    min_threshold: number;
    max_threshold: number;
    min_area: number;
    max_area: number;
    filter_by_circularity: boolean;
  };
  onYoloModelChange: (modelId: string | null) => void;
  onYoloConfidenceChange: (confidence: number) => void;
  onSAM2MultimaskChange: (multimask: boolean) => void;
  onSimpleBlobParamsChange: (params: any) => void;
}

export default function ToolPanel({
  yoloModelId,
  yoloConfidence,
  sam2Multimask,
  simpleBlobParams,
  onYoloModelChange,
  onYoloConfidenceChange,
  onSAM2MultimaskChange,
  onSimpleBlobParamsChange,
}: ToolPanelProps) {
  const { currentTool, setTool } = useUIStore();
  const [yoloSettingsOpen, setYoloSettingsOpen] = useState(false);
  const [sam2SettingsOpen, setSam2SettingsOpen] = useState(false);
  const [simpleBlobSettingsOpen, setSimpleBlobSettingsOpen] = useState(false);

  const tools: { type: ToolType; icon: React.ReactNode; label: string; shortcut?: string; description?: string }[] = [
    { type: 'select', icon: <SelectIcon />, label: 'Select', shortcut: 'V', description: 'Click to select, drag to box select' },
    { type: 'circle', icon: <CircleIcon />, label: 'Circle', shortcut: 'C' },
    { type: 'rectangle', icon: <RectangleIcon />, label: 'Rectangle', shortcut: 'R' },
    { type: 'polygon', icon: <PolygonIcon />, label: 'Polygon', shortcut: 'P' },
  ];

  const aiTools: {
    type: ToolType;
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
    onSettingsClick: () => void;
  }[] = [
    { type: 'sam2', icon: <SAM2Icon />, label: 'SAM2', shortcut: 'S', onSettingsClick: () => setSam2SettingsOpen(true) },
    { type: 'yolo', icon: <YOLOIcon />, label: 'YOLO', shortcut: 'Y', onSettingsClick: () => setYoloSettingsOpen(true) },
    { type: 'simpleblob', icon: <SimpleBlobIcon />, label: 'SimpleBlob', shortcut: 'B', onSettingsClick: () => setSimpleBlobSettingsOpen(true) },
  ];

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          py: 2,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
          Manual
        </Typography>

        {tools.map((tool) => (
          <Tooltip
            key={tool.type}
            title={
              <>
                <div>{tool.label}{tool.shortcut ? ` (${tool.shortcut})` : ''}</div>
                {tool.description && <div style={{ fontSize: '0.85em', opacity: 0.8 }}>{tool.description}</div>}
              </>
            }
            placement="right"
          >
            <IconButton
              onClick={() => setTool(tool.type)}
              color={currentTool === tool.type ? 'primary' : 'default'}
              sx={{
                border: currentTool === tool.type ? 2 : 1,
                borderColor: currentTool === tool.type ? 'primary.main' : 'divider',
              }}
            >
              {tool.icon}
            </IconButton>
          </Tooltip>
        ))}

        <Divider sx={{ my: 2, width: '80%' }} />

        <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
          AI Tools
        </Typography>

        {aiTools.map((tool) => (
          <Box key={tool.type} sx={{ position: 'relative' }}>
            <Tooltip title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`} placement="right">
              <IconButton
                onClick={() => setTool(tool.type)}
                color={currentTool === tool.type ? 'secondary' : 'default'}
                sx={{
                  border: currentTool === tool.type ? 2 : 1,
                  borderColor: currentTool === tool.type ? 'secondary.main' : 'divider',
                }}
              >
                {tool.icon}
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings" placement="right">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  tool.onSettingsClick();
                }}
                sx={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  width: 20,
                  height: 20,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <SettingsIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </Box>

      {/* Settings Dialogs */}
      <YoloSettings
        open={yoloSettingsOpen}
        onClose={() => setYoloSettingsOpen(false)}
        selectedModelId={yoloModelId}
        confidence={yoloConfidence}
        onModelChange={onYoloModelChange}
        onConfidenceChange={onYoloConfidenceChange}
      />

      <SAM2Settings
        open={sam2SettingsOpen}
        onClose={() => setSam2SettingsOpen(false)}
        multimaskOutput={sam2Multimask}
        onMultimaskChange={onSAM2MultimaskChange}
      />

      <SimpleBlobSettings
        open={simpleBlobSettingsOpen}
        onClose={() => setSimpleBlobSettingsOpen(false)}
        params={simpleBlobParams}
        onParamsChange={onSimpleBlobParamsChange}
      />
    </>
  );
}
