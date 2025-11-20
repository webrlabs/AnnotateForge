import {
  Box,
  Toolbar,
  IconButton,
  Divider,
  Slider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Brightness6 as BrightnessIcon,
  Contrast as ContrastIcon,
  Refresh as ResetIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
  AspectRatio as FitWidthIcon,
  PhotoSizeSelectActual as ActualSizeIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';

interface ImageToolbarProps {
  // Navigation
  currentImageIndex: number;
  totalImages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;

  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  // Zoom
  onZoom: (command: string) => void;

  // Image Enhancement
  brightness: number;
  contrast: number;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onResetEnhancements: () => void;

  // Help
  onHelpOpen: () => void;

  // Current image filename
  imageFilename?: string;
}

export const ImageToolbar: React.FC<ImageToolbarProps> = ({
  currentImageIndex,
  totalImages,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoom,
  brightness,
  contrast,
  onBrightnessChange,
  onContrastChange,
  onResetEnhancements,
  onHelpOpen,
  imageFilename,
}) => {
  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 48, gap: 1 }}>
        {/* Image Navigation */}
        <Tooltip title="Previous image (←)">
          <span>
            <IconButton
              onClick={onPrevious}
              disabled={!hasPrevious}
              size="small"
            >
              <NavigateBeforeIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="body2" sx={{ mx: 1, color: 'text.secondary' }}>
          {currentImageIndex + 1} / {totalImages}
        </Typography>
        <Tooltip title="Next image (→)">
          <span>
            <IconButton
              onClick={onNext}
              disabled={!hasNext}
              size="small"
            >
              <NavigateNextIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Undo/Redo */}
        <Tooltip title="Undo (Ctrl+Z)">
          <span>
            <IconButton
              onClick={onUndo}
              disabled={!canUndo}
              size="small"
            >
              <UndoIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Redo (Ctrl+Shift+Z)">
          <span>
            <IconButton
              onClick={onRedo}
              disabled={!canRedo}
              size="small"
            >
              <RedoIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Zoom Controls */}
        <Tooltip title="Zoom in (+)">
          <IconButton onClick={() => onZoom('zoomIn')} size="small">
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom out (-)">
          <IconButton onClick={() => onZoom('zoomOut')} size="small">
            <ZoomOutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fit to screen">
          <IconButton onClick={() => onZoom('fitToScreen')} size="small">
            <FitScreenIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fit to width">
          <IconButton onClick={() => onZoom('fitToWidth')} size="small">
            <FitWidthIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Actual size (1:1)">
          <IconButton onClick={() => onZoom('actualSize')} size="small">
            <ActualSizeIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Image Filename */}
        <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
          {imageFilename || 'Loading...'}
        </Typography>

        {/* Image Enhancement Controls */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Tooltip title={`Brightness: ${brightness}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
              <BrightnessIcon fontSize="small" />
              <Slider
                value={brightness}
                onChange={(_, value) => onBrightnessChange(value as number)}
                min={-100}
                max={100}
                size="small"
                sx={{ width: 100 }}
              />
            </Box>
          </Tooltip>
          <Tooltip title={`Contrast: ${contrast}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
              <ContrastIcon fontSize="small" />
              <Slider
                value={contrast}
                onChange={(_, value) => onContrastChange(value as number)}
                min={-100}
                max={100}
                size="small"
                sx={{ width: 100 }}
              />
            </Box>
          </Tooltip>
          <Tooltip title="Reset">
            <IconButton size="small" onClick={onResetEnhancements}>
              <ResetIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        <Tooltip title="Keyboard shortcuts (?)">
          <IconButton size="small" onClick={onHelpOpen}>
            <HelpIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </Box>
  );
};
