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
  ArrowBack as ArrowBackIcon,
  Brightness6 as BrightnessIcon,
  Contrast as ContrastIcon,
  InvertColors as InvertIcon,
  WaterDrop as SaturationIcon,
  Tune as GammaIcon,
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
  SkipNext as SkipNextIcon,
} from '@mui/icons-material';

interface ImageToolbarProps {
  // Project navigation
  projectName?: string;
  onNavigateToProject?: () => void;

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
  saturation?: number;
  gamma?: number;
  invert?: boolean;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onSaturationChange?: (value: number) => void;
  onGammaChange?: (value: number) => void;
  onInvertToggle?: () => void;
  onResetEnhancements: () => void;

  // Auto-advance
  autoAdvance?: boolean;
  onAutoAdvanceToggle?: () => void;

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
  saturation = 100,
  gamma = 1.0,
  invert = false,
  onBrightnessChange,
  onContrastChange,
  onSaturationChange,
  onGammaChange,
  onInvertToggle,
  onResetEnhancements,
  onHelpOpen,
  imageFilename,
  projectName,
  onNavigateToProject,
  autoAdvance,
  onAutoAdvanceToggle,
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
        {/* Back to Project */}
        {onNavigateToProject && (
          <>
            <Tooltip title="Back to Project (Esc)">
              <IconButton onClick={onNavigateToProject} size="small">
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          </>
        )}

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
        <Tooltip title={imageFilename || ''} placement="bottom">
          <Typography variant="body2" sx={{ mx: 1, color: 'text.secondary', cursor: 'default' }}>
            {currentImageIndex + 1} / {totalImages}
          </Typography>
        </Tooltip>
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

        {onAutoAdvanceToggle && (
          <Tooltip title={`Auto-advance to next unannotated image: ${autoAdvance ? 'ON' : 'OFF'}`}>
            <IconButton
              onClick={onAutoAdvanceToggle}
              size="small"
              color={autoAdvance ? 'primary' : 'default'}
            >
              <SkipNextIcon />
            </IconButton>
          </Tooltip>
        )}

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

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

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
          {onSaturationChange && (
            <Tooltip title={`Saturation: ${saturation}%`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
                <SaturationIcon fontSize="small" />
                <Slider
                  value={saturation}
                  onChange={(_, value) => onSaturationChange(value as number)}
                  min={0}
                  max={200}
                  size="small"
                  sx={{ width: 100 }}
                />
              </Box>
            </Tooltip>
          )}
          {onGammaChange && (
            <Tooltip title={`Gamma: ${gamma?.toFixed(1)}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
                <GammaIcon fontSize="small" />
                <Slider
                  value={gamma}
                  onChange={(_, value) => onGammaChange(value as number)}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  size="small"
                  sx={{ width: 100 }}
                />
              </Box>
            </Tooltip>
          )}
          {onInvertToggle && (
            <Tooltip title={`Invert colors (I): ${invert ? 'ON' : 'OFF'}`}>
              <IconButton
                size="small"
                onClick={onInvertToggle}
                color={invert ? 'primary' : 'default'}
              >
                <InvertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Reset all">
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
