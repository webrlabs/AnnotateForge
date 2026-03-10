import { Box } from '@mui/material';

interface MinimapProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  viewportX: number;
  viewportY: number;
  viewportWidth: number;
  viewportHeight: number;
  zoom: number;
  onPan: (x: number, y: number) => void;
  visible: boolean;
}

const MINIMAP_WIDTH = 180;

export default function Minimap({
  imageUrl, imageWidth, imageHeight,
  viewportX, viewportY, viewportWidth, viewportHeight,
  zoom, onPan, visible,
}: MinimapProps) {
  if (!visible || !imageWidth || !imageHeight) return null;

  const scale = MINIMAP_WIDTH / imageWidth;
  const minimapHeight = imageHeight * scale;

  // Viewport rectangle on minimap
  const vpX = (-viewportX / zoom) * scale;
  const vpY = (-viewportY / zoom) * scale;
  const vpW = (viewportWidth / zoom) * scale;
  const vpH = (viewportHeight / zoom) * scale;

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / scale;
    const clickY = (e.clientY - rect.top) / scale;
    onPan(
      -(clickX - viewportWidth / zoom / 2) * zoom,
      -(clickY - viewportHeight / zoom / 2) * zoom,
    );
  };

  return (
    <Box
      onClick={handleClick}
      sx={{
        position: 'absolute', bottom: 16, right: 16,
        width: MINIMAP_WIDTH, height: minimapHeight,
        border: '2px solid rgba(255,255,255,0.4)',
        borderRadius: 1, overflow: 'hidden',
        cursor: 'crosshair', zIndex: 10,
        boxShadow: 3,
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        opacity: 0.85,
        '&:hover': { opacity: 1 },
      }}
    >
      <Box sx={{
        position: 'absolute',
        left: Math.max(0, vpX),
        top: Math.max(0, vpY),
        width: Math.min(vpW, MINIMAP_WIDTH),
        height: Math.min(vpH, minimapHeight),
        border: '2px solid #1976d2',
        bgcolor: 'rgba(25, 118, 210, 0.15)',
        pointerEvents: 'none',
      }} />
    </Box>
  );
}
