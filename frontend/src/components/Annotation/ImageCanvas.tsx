import { useState, useRef, useEffect, Fragment } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Rect, Line } from 'react-konva';
import useImage from 'use-image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, CircularProgress, Typography, Backdrop, Menu, MenuItem, ListItemIcon, ListItemText, Divider as MuiDivider } from '@mui/material';
import { Delete as DeleteIcon, Label as LabelIcon, ContentCopy as CopyIcon, FiberManualRecord as DotIcon } from '@mui/icons-material';
import { getClassColor } from '@/utils/classColors';
import Minimap from './Minimap';
import { useUIStore } from '@/store/uiStore';
import { useAnnotationStore } from '@/store/annotationStore';
import { annotationAPI } from '@/services/annotationService';
import { inferenceAPI } from '@/services/inferenceService';
import { Annotation, AnnotationCreate } from '@/types';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

interface SimpleBlobParams {
  min_threshold: number;
  max_threshold: number;
  min_area: number;
  max_area: number;
  filter_by_circularity: boolean;
}

interface ImageCanvasProps {
  imageUrl: string;
  imageId: string;
  imageWidth: number;
  imageHeight: number;
  yoloModelId?: string | null;
  yoloConfidence?: number;
  sam2Multimask?: boolean;
  simpleBlobParams?: SimpleBlobParams;
  projectClasses?: string[];
}

export default function ImageCanvas({
  imageUrl,
  imageId,
  imageWidth,
  imageHeight,
  yoloModelId,
  yoloConfidence = 0.5,
  sam2Multimask = true,
  simpleBlobParams = {
    min_threshold: 40,
    max_threshold: 255,
    min_area: 100,
    max_area: 1000,
    filter_by_circularity: true,
  },
  projectClasses = [],
}: ImageCanvasProps) {
  const [image] = useImage(imageUrl);
  const { currentTool, brightness, contrast, saturation, gamma, invert, showMinimap, snapping, setTool, activeClass } = useUIStore();
  const { annotations, selectedIds, selectAnnotation, addAnnotation, clearSelection, deleteAnnotation, deleteSelected, copySelected, updateAnnotation, updateAnnotationLocal } = useAnnotationStore();
  const queryClient = useQueryClient();

  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<{ x: number; y: number } | null>(null);
  const [drawingData, setDrawingData] = useState<any>(null);
  const [sam2Points, setSam2Points] = useState<{ points: number[][]; labels: number[] }>({ points: [], labels: [] });
  const [boxSelection, setBoxSelection] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ annotationId: string; pointIndex: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const imageRef = useRef<Konva.Image>(null);
  const dragStartDataRef = useRef<{
    corners?: [number, number][];
    points?: [number, number][];
    start?: [number, number];
    end?: [number, number];
    startPos?: { x: number; y: number };
  } | null>(null);

  // Snap helper: snaps a point to grid or nearby annotation vertices
  const snapPoint = (x: number, y: number, excludeId?: string): { x: number; y: number } => {
    if (!snapping.enabled) return { x, y };

    let snapX = x, snapY = y;
    let minDist = snapping.snapThreshold;

    // Grid snapping
    const gridX = Math.round(x / snapping.gridSize) * snapping.gridSize;
    const gridY = Math.round(y / snapping.gridSize) * snapping.gridSize;
    const gridDist = Math.hypot(gridX - x, gridY - y);
    if (gridDist < minDist) {
      snapX = gridX;
      snapY = gridY;
      minDist = gridDist;
    }

    // Vertex snapping
    if (snapping.snapToVertices) {
      for (const ann of annotations) {
        if (ann.id === excludeId) continue;
        const vertices: [number, number][] = [];
        if (ann.type === 'circle') vertices.push([ann.data.x, ann.data.y]);
        else if (ann.type === 'polygon') vertices.push(...ann.data.points);
        else if (ann.type === 'box' || ann.type === 'rectangle') vertices.push(...ann.data.corners);
        else if (ann.type === 'line') { vertices.push(ann.data.start); vertices.push(ann.data.end); }

        for (const [vx, vy] of vertices) {
          const dist = Math.hypot(vx - x, vy - y);
          if (dist < minDist) {
            snapX = vx;
            snapY = vy;
            minDist = dist;
          }
        }
      }
    }

    return { x: snapX, y: snapY };
  };

  // Zoom functions
  const fitToScreen = () => {
    const container = stageRef.current?.container();
    if (!container) return;

    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    const scaleX = (containerWidth * 0.95) / imageWidth;
    const scaleY = (containerHeight * 0.95) / imageHeight;
    const newScale = Math.min(scaleX, scaleY);

    const scaledWidth = imageWidth * newScale;
    const scaledHeight = imageHeight * newScale;

    setScale(newScale);
    setPosition({
      x: (containerWidth - scaledWidth) / 2,
      y: (containerHeight - scaledHeight) / 2,
    });
  };

  const fitToWidth = () => {
    const container = stageRef.current?.container();
    if (!container) return;

    const containerWidth = container.offsetWidth;
    const newScale = (containerWidth * 0.95) / imageWidth;

    const scaledWidth = imageWidth * newScale;
    const scaledHeight = imageHeight * newScale;

    setScale(newScale);
    setPosition({
      x: (containerWidth - scaledWidth) / 2,
      y: 20,
    });
  };

  const actualSize = () => {
    const container = stageRef.current?.container();
    if (!container) return;

    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    setScale(1);
    setPosition({
      x: (containerWidth - imageWidth) / 2,
      y: (containerHeight - imageHeight) / 2,
    });
  };

  const zoomIn = () => {
    const container = stageRef.current?.container();
    if (!container) return;

    const newScale = Math.min(scale * 1.2, 10);
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    // Zoom towards center
    const dx = containerWidth / 2 - position.x;
    const dy = containerHeight / 2 - position.y;
    const ratio = newScale / scale;

    setScale(newScale);
    setPosition({
      x: containerWidth / 2 - dx * ratio,
      y: containerHeight / 2 - dy * ratio,
    });
  };

  const zoomOut = () => {
    const container = stageRef.current?.container();
    if (!container) return;

    const newScale = Math.max(scale / 1.2, 0.1);
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    // Zoom towards center
    const dx = containerWidth / 2 - position.x;
    const dy = containerHeight / 2 - position.y;
    const ratio = newScale / scale;

    setScale(newScale);
    setPosition({
      x: containerWidth / 2 - dx * ratio,
      y: containerHeight / 2 - dy * ratio,
    });
  };

  // Expose zoom functions via custom event
  useEffect(() => {
    const handleZoomCommand = (e: CustomEvent) => {
      const { command } = e.detail;
      switch (command) {
        case 'fitToScreen':
          fitToScreen();
          break;
        case 'fitToWidth':
          fitToWidth();
          break;
        case 'actualSize':
          actualSize();
          break;
        case 'zoomIn':
          zoomIn();
          break;
        case 'zoomOut':
          zoomOut();
          break;
      }
    };

    window.addEventListener('canvasZoom', handleZoomCommand as EventListener);
    return () => window.removeEventListener('canvasZoom', handleZoomCommand as EventListener);
  }, [scale, position, imageWidth, imageHeight]);

  // Initial fit to screen
  useEffect(() => {
    if (image) {
      const container = stageRef.current?.container();
      if (container) {
        setStageSize({
          width: container.offsetWidth,
          height: container.offsetHeight,
        });
        fitToScreen();
      }
    }
  }, [image, imageWidth, imageHeight]);

  // Apply CSS filters to canvas (brightness, contrast, saturation, gamma, invert)
  useEffect(() => {
    const canvas = stageRef.current?.content;
    if (canvas) {
      const brightnessPercent = 100 + brightness;
      const contrastPercent = 100 + contrast;
      // Gamma correction via SVG filter (CSS has no native gamma)
      const gammaExponent = 1 / gamma;
      const svgFilterId = 'gamma-filter';
      let svgEl = document.getElementById(svgFilterId + '-svg') as SVGSVGElement | null;
      if (!svgEl) {
        svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('id', svgFilterId + '-svg');
        svgEl.style.position = 'absolute';
        svgEl.style.width = '0';
        svgEl.style.height = '0';
        svgEl.innerHTML = `<filter id="${svgFilterId}"><feComponentTransfer><feFuncR type="gamma" exponent="${gammaExponent}" amplitude="1" offset="0"/><feFuncG type="gamma" exponent="${gammaExponent}" amplitude="1" offset="0"/><feFuncB type="gamma" exponent="${gammaExponent}" amplitude="1" offset="0"/></feComponentTransfer></filter>`;
        document.body.appendChild(svgEl);
      } else {
        svgEl.innerHTML = `<filter id="${svgFilterId}"><feComponentTransfer><feFuncR type="gamma" exponent="${gammaExponent}" amplitude="1" offset="0"/><feFuncG type="gamma" exponent="${gammaExponent}" amplitude="1" offset="0"/><feFuncB type="gamma" exponent="${gammaExponent}" amplitude="1" offset="0"/></feComponentTransfer></filter>`;
      }
      const filters = [
        `brightness(${brightnessPercent}%)`,
        `contrast(${contrastPercent}%)`,
        `saturate(${saturation}%)`,
        gamma !== 1.0 ? `url(#${svgFilterId})` : '',
        invert ? 'invert(100%)' : '',
      ].filter(Boolean).join(' ');
      canvas.style.filter = filters;
    }
  }, [brightness, contrast, saturation, gamma, invert]);

  // Create annotation mutation
  const createMutation = useMutation({
    mutationFn: (data: AnnotationCreate) => annotationAPI.create(imageId, data),
    onSuccess: (newAnnotation) => {
      queryClient.invalidateQueries({ queryKey: ['annotations', imageId] });
      addAnnotation(newAnnotation);
    },
    onError: (error) => {
      console.error('Failed to create annotation:', error);
    },
  });

  // Delete annotation mutation
  const deleteMutation = useMutation({
    mutationFn: (annotationId: string) => annotationAPI.delete(annotationId),
    onSuccess: (_, annotationId) => {
      queryClient.invalidateQueries({ queryKey: ['annotations', imageId] });
      deleteAnnotation(annotationId);
    },
  });

  // Update annotation mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => annotationAPI.update(id, { data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', imageId] });
    },
  });

  // SimpleBlob inference mutation
  const simpleBlobMutation = useMutation({
    mutationFn: () => inferenceAPI.simpleBlob({
      image_id: imageId,
      params: simpleBlobParams,
    }),
    onSuccess: async (response) => {
      // Save each annotation to the backend and add to store
      for (const ann of response.annotations) {
        const annotationData: AnnotationCreate = {
          type: ann.type,
          data: ann.data,
          source: ann.source,
          confidence: ann.confidence,
          class_label: ann.class_label,
        };
        const createdAnnotation = await annotationAPI.create(imageId, annotationData);
        addAnnotation(createdAnnotation);
      }
      queryClient.invalidateQueries({ queryKey: ['annotations', imageId] });
      setTool('select');
    },
  });

  // YOLO inference mutation
  const yoloMutation = useMutation({
    mutationFn: () => inferenceAPI.yolo({
      image_id: imageId,
      confidence: yoloConfidence,
      model_id: yoloModelId || undefined,
    }),
    onSuccess: async (response) => {
      // Save each annotation to the backend and add to store
      for (const ann of response.annotations) {
        const annotationData: AnnotationCreate = {
          type: ann.type,
          data: ann.data,
          source: ann.source,
          confidence: ann.confidence,
          class_label: ann.class_label,
        };
        const createdAnnotation = await annotationAPI.create(imageId, annotationData);
        addAnnotation(createdAnnotation);
      }
      queryClient.invalidateQueries({ queryKey: ['annotations', imageId] });
      setTool('select');
    },
  });

  // SAM2 inference mutation
  const sam2Mutation = useMutation({
    mutationFn: () => inferenceAPI.sam2({
      image_id: imageId,
      prompts: {
        points: sam2Points.points,
        labels: sam2Points.labels,
      },
      multimask_output: sam2Multimask,
    }),
    onSuccess: async (response) => {
      // Save each annotation to the backend and add to store
      for (const ann of response.annotations) {
        const annotationData: AnnotationCreate = {
          type: ann.type,
          data: ann.data,
          source: ann.source,
          confidence: ann.confidence,
          class_label: ann.class_label,
        };
        const createdAnnotation = await annotationAPI.create(imageId, annotationData);
        addAnnotation(createdAnnotation);
      }
      queryClient.invalidateQueries({ queryKey: ['annotations', imageId] });
      setSam2Points({ points: [], labels: [] });
      setTool('select');
    },
  });

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Convert to image coordinates (accounting for layer transform)
    const rawX = (pos.x - position.x) / scale;
    const rawY = (pos.y - position.y) / scale;
    const snapped = snapPoint(rawX, rawY);
    const x = snapped.x;
    const y = snapped.y;

    // Handle pan tool
    if (currentTool === 'pan') {
      setIsPanning(true);
      setLastPanPoint({ x: pos.x, y: pos.y });
      return;
    }

    // Handle box selection with select tool
    if (currentTool === 'select') {
      // Only start box selection if NOT clicking on an annotation shape (Circle, Line, Rect)
      const targetClassName = e.target.getClassName();
      const clickedOnAnnotation = targetClassName === 'Circle' || targetClassName === 'Line' || targetClassName === 'Rect';

      if (!clickedOnAnnotation) {
        setIsDrawing(true);
        setBoxSelection({ x1: x, y1: y, x2: x, y2: y });
        if (!e.evt.ctrlKey && !e.evt.metaKey) {
          clearSelection();
        }
      }
      return;
    }

    // Handle SAM2 point prompts
    if (currentTool === 'sam2') {
      // Left click = positive point (label 1), Right click = negative point (label 0)
      const label = e.evt.button === 0 ? 1 : 0;
      setSam2Points({
        points: [...sam2Points.points, [x, y]],
        labels: [...sam2Points.labels, label],
      });
      return;
    }

    // Handle YOLO and SimpleBlob - trigger inference immediately
    if (currentTool === 'yolo') {
      yoloMutation.mutate();
      return;
    }

    if (currentTool === 'simpleblob') {
      simpleBlobMutation.mutate();
      return;
    }

    setIsDrawing(true);

    switch (currentTool) {
      case 'circle':
        setDrawingData({ x, y, size: 0 });
        break;
      case 'rectangle':
        setDrawingData({ x1: x, y1: y, x2: x, y2: y });
        break;
      case 'line':
        setDrawingData({ x1: x, y1: y, x2: x, y2: y });
        break;
      case 'polygon':
        // For polygon, accumulate points
        if (!drawingData) {
          setDrawingData({ points: [[x, y]] });
        } else {
          setDrawingData({
            ...drawingData,
            points: [...drawingData.points, [x, y]],
          });
        }
        setIsDrawing(false); // Polygon doesn't use drag
        break;
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Handle pan tool drag
    if (isPanning && currentTool === 'pan' && lastPanPoint) {
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      setPosition({
        x: position.x + (pos.x - lastPanPoint.x),
        y: position.y + (pos.y - lastPanPoint.y),
      });
      setLastPanPoint({ x: pos.x, y: pos.y });
      return;
    }

    if (!isDrawing || currentTool === 'polygon') return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Convert to image coordinates (accounting for layer transform)
    const rawX = (pos.x - position.x) / scale;
    const rawY = (pos.y - position.y) / scale;
    const snapped = snapPoint(rawX, rawY);
    const x = snapped.x;
    const y = snapped.y;

    // Update box selection
    if (currentTool === 'select' && boxSelection) {
      setBoxSelection({ ...boxSelection, x2: x, y2: y });
      return;
    }

    switch (currentTool) {
      case 'circle':
        const dx = x - drawingData.x;
        const dy = y - drawingData.y;
        const size = Math.sqrt(dx * dx + dy * dy);
        setDrawingData({ ...drawingData, size });
        break;
      case 'rectangle':
        setDrawingData({ ...drawingData, x2: x, y2: y });
        break;
      case 'line':
        setDrawingData({ ...drawingData, x2: x, y2: y });
        break;
    }
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
      return;
    }

    if (!isDrawing) return;

    setIsDrawing(false);

    // Handle box selection
    if (currentTool === 'select' && boxSelection) {
      const minX = Math.min(boxSelection.x1, boxSelection.x2);
      const maxX = Math.max(boxSelection.x1, boxSelection.x2);
      const minY = Math.min(boxSelection.y1, boxSelection.y2);
      const maxY = Math.max(boxSelection.y1, boxSelection.y2);

      // Find all annotations that intersect with the selection box
      const selectedAnnotations = annotations.filter(ann => {
        if (ann.type === 'circle') {
          const { x, y, size } = ann.data;
          // Check if circle intersects with box
          const closestX = Math.max(minX, Math.min(x, maxX));
          const closestY = Math.max(minY, Math.min(y, maxY));
          const distanceX = x - closestX;
          const distanceY = y - closestY;
          return (distanceX * distanceX + distanceY * distanceY) <= (size * size);
        } else if (ann.type === 'rectangle' || ann.type === 'box') {
          const corners = ann.data.corners;
          // Check if any corner is inside the box or if rectangles overlap
          return corners.some((corner: [number, number]) => {
            const [x, y] = corner;
            return x >= minX && x <= maxX && y >= minY && y <= maxY;
          });
        } else if (ann.type === 'polygon') {
          const points = ann.data.points;
          // Check if any point is inside the box
          return points.some((point: [number, number]) => {
            const [x, y] = point;
            return x >= minX && x <= maxX && y >= minY && y <= maxY;
          });
        } else if (ann.type === 'line') {
          const { start, end } = ann.data;
          // Check if either endpoint is inside the box
          return (
            (start[0] >= minX && start[0] <= maxX && start[1] >= minY && start[1] <= maxY) ||
            (end[0] >= minX && end[0] <= maxX && end[1] >= minY && end[1] <= maxY)
          );
        }
        return false;
      });

      // Select the annotations
      const multiSelect = e.evt.ctrlKey || e.evt.metaKey;
      if (selectedAnnotations.length > 0) {
        if (multiSelect) {
          // Add to existing selection
          selectedAnnotations.forEach(ann => {
            if (!selectedIds.includes(ann.id)) {
              selectAnnotation(ann.id, true);
            }
          });
        } else {
          // Replace selection - select all at once
          clearSelection();
          selectedAnnotations.forEach((ann, idx) => {
            selectAnnotation(ann.id, idx > 0);
          });
        }
      }

      setBoxSelection(null);
      return;
    }

    if (!drawingData) return;

    // Create annotation based on tool
    let annotationData: any;

    switch (currentTool) {
      case 'circle':
        if (drawingData.size > 5) {
          annotationData = {
            type: 'circle' as const,
            data: {
              x: drawingData.x,
              y: drawingData.y,
              size: drawingData.size,
            },
            source: 'manual' as const,
            class_label: activeClass || undefined,
          };
        }
        break;
      case 'rectangle':
        if (Math.abs(drawingData.x2 - drawingData.x1) > 5 && Math.abs(drawingData.y2 - drawingData.y1) > 5) {
          const corners = [
            [drawingData.x1, drawingData.y1],
            [drawingData.x2, drawingData.y1],
            [drawingData.x2, drawingData.y2],
            [drawingData.x1, drawingData.y2],
          ];
          annotationData = {
            type: 'rectangle' as const,
            data: { corners },
            source: 'manual' as const,
            class_label: activeClass || undefined,
          };
        }
        break;
      case 'line':
        const lineDx = drawingData.x2 - drawingData.x1;
        const lineDy = drawingData.y2 - drawingData.y1;
        const lineLength = Math.sqrt(lineDx * lineDx + lineDy * lineDy);
        if (lineLength > 5) {
          annotationData = {
            type: 'line' as const,
            data: {
              start: [drawingData.x1, drawingData.y1],
              end: [drawingData.x2, drawingData.y2],
            },
            source: 'manual' as const,
            class_label: activeClass || undefined,
          };
        }
        break;
    }

    if (annotationData) {
      createMutation.mutate(annotationData);
    }

    setDrawingData(null);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Zoom shortcuts
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomIn();
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomOut();
    } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      fitToScreen();
    } else if (e.key === '1' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      actualSize();
    }
    // Tool shortcuts
    else if (e.key.toLowerCase() === 'v') {
      setTool('select');
    } else if (e.key.toLowerCase() === 'c') {
      setTool('circle');
    } else if (e.key.toLowerCase() === 'r') {
      setTool('rectangle');
    } else if (e.key.toLowerCase() === 'p') {
      setTool('polygon');
    } else if (e.key.toLowerCase() === 'l') {
      setTool('line');
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Delete selected polygon point
      if (selectedPoint) {
        const annotation = annotations.find(a => a.id === selectedPoint.annotationId);
        if (annotation && annotation.type === 'polygon') {
          const points = annotation.data.points;
          // Don't allow deleting if only 3 points left (minimum for polygon)
          if (points.length > 3) {
            const newPoints = points.filter((_: any, idx: number) => idx !== selectedPoint.pointIndex);
            updateAnnotation(annotation.id, { data: { points: newPoints } });
            updateMutation.mutate({
              id: annotation.id,
              data: { points: newPoints },
            });
          }
        }
        setSelectedPoint(null);
      }
      // Delete selected annotations
      else if (selectedIds.length > 0) {
        selectedIds.forEach(id => {
          deleteMutation.mutate(id);
        });
      }
    } else if (e.key === 'Enter') {
      // Complete polygon or run SAM2
      if (currentTool === 'polygon' && drawingData?.points?.length >= 3) {
        const annotationData = {
          type: 'polygon' as const,
          data: { points: drawingData.points },
          source: 'manual' as const,
          class_label: activeClass || undefined,
        };
        createMutation.mutate(annotationData);
        setDrawingData(null);
      } else if (currentTool === 'sam2' && sam2Points.points.length > 0) {
        sam2Mutation.mutate();
      }
    } else if (e.key === 'Escape') {
      // Cancel drawing, clear SAM2 points, or clear selection
      if (drawingData) {
        setDrawingData(null);
        setIsDrawing(false);
      } else if (sam2Points.points.length > 0) {
        setSam2Points({ points: [], labels: [] });
      } else {
        clearSelection();
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTool, drawingData, selectedIds, sam2Points, selectedPoint, annotations]);

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Deselect when clicking on empty space
    if (e.target === e.target.getStage()) {
      clearSelection();
      setSelectedPoint(null);
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * 1.1 : oldScale / 1.1;
    const boundedScale = Math.max(0.1, Math.min(10, newScale));

    setScale(boundedScale);
    setPosition({
      x: pointer.x - mousePointTo.x * boundedScale,
      y: pointer.y - mousePointTo.y * boundedScale,
    });
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
    <Stage
      ref={stageRef}
      width={stageSize.width}
      height={stageSize.height}
      style={{ cursor: currentTool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleStageClick}
      onWheel={handleWheel}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        if (selectedIds.length > 0) {
          setContextMenu({ mouseX: e.evt.clientX, mouseY: e.evt.clientY });
        }
      }}
    >
      <Layer
        x={position.x}
        y={position.y}
        scaleX={scale}
        scaleY={scale}
      >
        {/* Image */}
        {image && (
          <KonvaImage
            image={image}
            width={imageWidth}
            height={imageHeight}
          />
        )}

        {/* Grid overlay when snapping is enabled (limit to max ~200 lines for performance) */}
        {snapping.enabled && scale >= 0.5 && (imageWidth / snapping.gridSize + imageHeight / snapping.gridSize) < 200 && (() => {
          const gridLines: React.ReactNode[] = [];
          const gs = snapping.gridSize;
          for (let gx = 0; gx <= imageWidth; gx += gs) {
            gridLines.push(
              <Line
                key={`gv-${gx}`}
                points={[gx, 0, gx, imageHeight]}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1 / scale}
                listening={false}
              />
            );
          }
          for (let gy = 0; gy <= imageHeight; gy += gs) {
            gridLines.push(
              <Line
                key={`gh-${gy}`}
                points={[0, gy, imageWidth, gy]}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1 / scale}
                listening={false}
              />
            );
          }
          return gridLines;
        })()}

        {/* Existing annotations */}
        {annotations.map((annotation) => {
          const isSelected = selectedIds.includes(annotation.id);
          const classColor = annotation.class_label
            ? getClassColor(annotation.class_label, projectClasses)
            : '#ff0000';
          const strokeColor = isSelected ? '#00ff00' : classColor;
          const strokeWidth = isSelected ? 3 : 2;

          switch (annotation.type) {
            case 'circle':
              const circleData = annotation.data;
              return (
                <Fragment key={annotation.id}>
                  <Circle
                    x={circleData.x}
                    y={circleData.y}
                    radius={circleData.size}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth / scale}
                    onClick={(e) => selectAnnotation(annotation.id, e.evt.ctrlKey || e.evt.metaKey)}
                    draggable={isSelected}
                    onDragMove={(e) => {
                      updateAnnotationLocal(annotation.id, { data: { x: e.target.x(), y: e.target.y(), size: circleData.size } });
                    }}
                    onDragEnd={(e) => {
                      updateAnnotation(annotation.id, { data: { x: e.target.x(), y: e.target.y(), size: circleData.size } });
                      updateMutation.mutate({
                        id: annotation.id,
                        data: { x: e.target.x(), y: e.target.y(), size: circleData.size },
                      });
                    }}
                  />
                  {isSelected && (
                    <Circle
                      key={`${annotation.id}-handle`}
                      x={circleData.x + circleData.size}
                      y={circleData.y}
                      radius={6 / scale}
                      fill="white"
                      stroke={strokeColor}
                      strokeWidth={2 / scale}
                      draggable
                      onDragMove={(e) => {
                        const dx = e.target.x() - circleData.x;
                        const dy = e.target.y() - circleData.y;
                        const newSize = Math.sqrt(dx * dx + dy * dy);
                        e.target.x(circleData.x + newSize);
                        e.target.y(circleData.y);
                        updateAnnotationLocal(annotation.id, { data: { x: circleData.x, y: circleData.y, size: newSize } });
                      }}
                      onDragEnd={(e) => {
                        const dx = e.target.x() - circleData.x;
                        const dy = e.target.y() - circleData.y;
                        const newSize = Math.sqrt(dx * dx + dy * dy);
                        updateAnnotation(annotation.id, { data: { x: circleData.x, y: circleData.y, size: newSize } });
                        updateMutation.mutate({
                          id: annotation.id,
                          data: { x: circleData.x, y: circleData.y, size: newSize },
                        });
                      }}
                    />
                  )}
                </Fragment>
              );

            case 'box':
            case 'rectangle':
              const rectData = annotation.data;
              if (rectData.corners && rectData.corners.length >= 4) {
                const points = rectData.corners.flatMap((corner: [number, number]) => [
                  corner[0],
                  corner[1],
                ]);
                return (
                  <Fragment key={annotation.id}>
                    <Line
                      points={points}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth / scale}
                      closed
                      onClick={(e) => selectAnnotation(annotation.id, e.evt.ctrlKey || e.evt.metaKey)}
                      draggable={isSelected}
                      onDragStart={(e) => {
                        const stage = e.target.getStage();
                        const pointerPos = stage?.getPointerPosition();
                        if (!pointerPos) return;

                        // Convert stage coordinates to image coordinates
                        const imageX = (pointerPos.x - position.x) / scale;
                        const imageY = (pointerPos.y - position.y) / scale;

                        dragStartDataRef.current = {
                          corners: rectData.corners,
                          startPos: { x: imageX, y: imageY }
                        };
                      }}
                      onDragMove={(e) => {
                        if (!dragStartDataRef.current?.corners || !dragStartDataRef.current?.startPos) return;

                        const stage = e.target.getStage();
                        const pointerPos = stage?.getPointerPosition();
                        if (!pointerPos) return;

                        // Convert current position to image coordinates
                        const imageX = (pointerPos.x - position.x) / scale;
                        const imageY = (pointerPos.y - position.y) / scale;

                        // Calculate delta from start position
                        const deltaX = imageX - dragStartDataRef.current.startPos.x;
                        const deltaY = imageY - dragStartDataRef.current.startPos.y;

                        const newCorners = dragStartDataRef.current.corners.map((corner: [number, number]) => [
                          corner[0] + deltaX,
                          corner[1] + deltaY,
                        ]);
                        updateAnnotationLocal(annotation.id, { data: { corners: newCorners } });
                        e.target.position({ x: 0, y: 0 });
                      }}
                      onDragEnd={(e) => {
                        if (!dragStartDataRef.current?.corners || !dragStartDataRef.current?.startPos) return;

                        const stage = e.target.getStage();
                        const pointerPos = stage?.getPointerPosition();
                        if (!pointerPos) return;

                        // Convert current position to image coordinates
                        const imageX = (pointerPos.x - position.x) / scale;
                        const imageY = (pointerPos.y - position.y) / scale;

                        // Calculate delta from start position
                        const deltaX = imageX - dragStartDataRef.current.startPos.x;
                        const deltaY = imageY - dragStartDataRef.current.startPos.y;

                        const newCorners = dragStartDataRef.current.corners.map((corner: [number, number]) => [
                          corner[0] + deltaX,
                          corner[1] + deltaY,
                        ]);
                        updateAnnotation(annotation.id, { data: { corners: newCorners } });
                        updateMutation.mutate({
                          id: annotation.id,
                          data: { corners: newCorners },
                        });
                        e.target.position({ x: 0, y: 0 });
                        dragStartDataRef.current = null;
                      }}
                    />
                    {isSelected && rectData.corners.map((corner: [number, number], idx: number) => (
                      <Circle
                        key={`${annotation.id}-corner-${idx}`}
                        x={corner[0]}
                        y={corner[1]}
                        radius={6 / scale}
                        fill="white"
                        stroke={strokeColor}
                        strokeWidth={2 / scale}
                        draggable
                        onDragMove={(e) => {
                          const newX = e.target.x();
                          const newY = e.target.y();
                          const newCorners = [...rectData.corners];

                          // Update corners to maintain rectangle shape
                          // Corners are: [0]=top-left, [1]=top-right, [2]=bottom-right, [3]=bottom-left
                          switch(idx) {
                            case 0: // top-left
                              newCorners[0] = [newX, newY];
                              newCorners[1] = [newCorners[1][0], newY]; // update top-right y
                              newCorners[3] = [newX, newCorners[3][1]]; // update bottom-left x
                              break;
                            case 1: // top-right
                              newCorners[1] = [newX, newY];
                              newCorners[0] = [newCorners[0][0], newY]; // update top-left y
                              newCorners[2] = [newX, newCorners[2][1]]; // update bottom-right x
                              break;
                            case 2: // bottom-right
                              newCorners[2] = [newX, newY];
                              newCorners[3] = [newCorners[3][0], newY]; // update bottom-left y
                              newCorners[1] = [newX, newCorners[1][1]]; // update top-right x
                              break;
                            case 3: // bottom-left
                              newCorners[3] = [newX, newY];
                              newCorners[2] = [newCorners[2][0], newY]; // update bottom-right y
                              newCorners[0] = [newX, newCorners[0][1]]; // update top-left x
                              break;
                          }

                          updateAnnotationLocal(annotation.id, { data: { corners: newCorners } });
                        }}
                        onDragEnd={(e) => {
                          const newX = e.target.x();
                          const newY = e.target.y();
                          const newCorners = [...rectData.corners];

                          // Update corners to maintain rectangle shape
                          switch(idx) {
                            case 0: // top-left
                              newCorners[0] = [newX, newY];
                              newCorners[1] = [newCorners[1][0], newY];
                              newCorners[3] = [newX, newCorners[3][1]];
                              break;
                            case 1: // top-right
                              newCorners[1] = [newX, newY];
                              newCorners[0] = [newCorners[0][0], newY];
                              newCorners[2] = [newX, newCorners[2][1]];
                              break;
                            case 2: // bottom-right
                              newCorners[2] = [newX, newY];
                              newCorners[3] = [newCorners[3][0], newY];
                              newCorners[1] = [newX, newCorners[1][1]];
                              break;
                            case 3: // bottom-left
                              newCorners[3] = [newX, newY];
                              newCorners[2] = [newCorners[2][0], newY];
                              newCorners[0] = [newX, newCorners[0][1]];
                              break;
                          }

                          updateAnnotation(annotation.id, { data: { corners: newCorners } });
                          updateMutation.mutate({
                            id: annotation.id,
                            data: { corners: newCorners },
                          });
                        }}
                      />
                    ))}
                  </Fragment>
                );
              }
              return null;

            case 'polygon':
              const polyData = annotation.data;
              if (polyData.points && polyData.points.length >= 3) {
                const points = polyData.points.flatMap((point: [number, number]) => [
                  point[0],
                  point[1],
                ]);

                // Helper function to calculate distance from point to line segment
                const pointToSegmentDistance = (
                  px: number, py: number,
                  x1: number, y1: number,
                  x2: number, y2: number
                ): number => {
                  const dx = x2 - x1;
                  const dy = y2 - y1;
                  const lengthSquared = dx * dx + dy * dy;

                  if (lengthSquared === 0) {
                    return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
                  }

                  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
                  t = Math.max(0, Math.min(1, t));

                  const closestX = x1 + t * dx;
                  const closestY = y1 + t * dy;

                  return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
                };

                return (
                  <Fragment key={annotation.id}>
                    <Line
                      points={points}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth / scale}
                      closed
                      onClick={(e) => {
                        selectAnnotation(annotation.id, e.evt.ctrlKey || e.evt.metaKey);
                        setSelectedPoint(null);
                      }}
                      onDblClick={(e) => {
                        if (!isSelected) return;
                        e.cancelBubble = true;

                        const stage = e.target.getStage();
                        const pointerPos = stage?.getPointerPosition();
                        if (!pointerPos) return;

                        // Convert to image coordinates
                        const clickX = (pointerPos.x - position.x) / scale;
                        const clickY = (pointerPos.y - position.y) / scale;

                        // Find the closest segment
                        let minDist = Infinity;
                        let insertIndex = 0;

                        for (let i = 0; i < polyData.points.length; i++) {
                          const p1 = polyData.points[i];
                          const p2 = polyData.points[(i + 1) % polyData.points.length];

                          // Calculate distance from click to line segment
                          const dist = pointToSegmentDistance(
                            clickX, clickY,
                            p1[0], p1[1],
                            p2[0], p2[1]
                          );

                          if (dist < minDist) {
                            minDist = dist;
                            insertIndex = i + 1;
                          }
                        }

                        // Insert new point at the closest segment
                        const newPoints = [...polyData.points];
                        newPoints.splice(insertIndex, 0, [clickX, clickY]);

                        updateAnnotation(annotation.id, { data: { points: newPoints } });
                        updateMutation.mutate({
                          id: annotation.id,
                          data: { points: newPoints },
                        });
                      }}
                      draggable={isSelected}
                      onDragStart={(e) => {
                        const stage = e.target.getStage();
                        const pointerPos = stage?.getPointerPosition();
                        if (!pointerPos) return;

                        // Convert stage coordinates to image coordinates
                        const imageX = (pointerPos.x - position.x) / scale;
                        const imageY = (pointerPos.y - position.y) / scale;

                        dragStartDataRef.current = {
                          points: polyData.points,
                          startPos: { x: imageX, y: imageY }
                        };
                      }}
                      onDragMove={(e) => {
                        if (!dragStartDataRef.current?.points || !dragStartDataRef.current?.startPos) return;

                        const stage = e.target.getStage();
                        const pointerPos = stage?.getPointerPosition();
                        if (!pointerPos) return;

                        // Convert current position to image coordinates
                        const imageX = (pointerPos.x - position.x) / scale;
                        const imageY = (pointerPos.y - position.y) / scale;

                        // Calculate delta from start position
                        const deltaX = imageX - dragStartDataRef.current.startPos.x;
                        const deltaY = imageY - dragStartDataRef.current.startPos.y;

                        const newPoints = dragStartDataRef.current.points.map((point: [number, number]) => [
                          point[0] + deltaX,
                          point[1] + deltaY,
                        ]);
                        updateAnnotationLocal(annotation.id, { data: { points: newPoints } });
                        e.target.position({ x: 0, y: 0 });
                      }}
                      onDragEnd={(e) => {
                        if (!dragStartDataRef.current?.points || !dragStartDataRef.current?.startPos) return;

                        const stage = e.target.getStage();
                        const pointerPos = stage?.getPointerPosition();
                        if (!pointerPos) return;

                        // Convert current position to image coordinates
                        const imageX = (pointerPos.x - position.x) / scale;
                        const imageY = (pointerPos.y - position.y) / scale;

                        // Calculate delta from start position
                        const deltaX = imageX - dragStartDataRef.current.startPos.x;
                        const deltaY = imageY - dragStartDataRef.current.startPos.y;

                        const newPoints = dragStartDataRef.current.points.map((point: [number, number]) => [
                          point[0] + deltaX,
                          point[1] + deltaY,
                        ]);
                        updateAnnotation(annotation.id, { data: { points: newPoints } });
                        updateMutation.mutate({
                          id: annotation.id,
                          data: { points: newPoints },
                        });
                        e.target.position({ x: 0, y: 0 });
                        dragStartDataRef.current = null;
                      }}
                    />
                    {isSelected && polyData.points.map((point: [number, number], idx: number) => {
                      const isPointSelected = selectedPoint?.annotationId === annotation.id && selectedPoint?.pointIndex === idx;
                      return (
                        <Circle
                          key={`${annotation.id}-point-${idx}`}
                          x={point[0]}
                          y={point[1]}
                          radius={isPointSelected ? 8 / scale : 6 / scale}
                          fill={isPointSelected ? '#ff6b6b' : 'white'}
                          stroke={isPointSelected ? '#ff0000' : strokeColor}
                          strokeWidth={2 / scale}
                          draggable
                          onClick={(e) => {
                            e.cancelBubble = true;
                            setSelectedPoint({ annotationId: annotation.id, pointIndex: idx });
                          }}
                          onDragMove={(e) => {
                            const newPoints = [...polyData.points];
                            newPoints[idx] = [e.target.x(), e.target.y()];
                            updateAnnotationLocal(annotation.id, { data: { points: newPoints } });
                          }}
                          onDragEnd={(e) => {
                            const newPoints = [...polyData.points];
                            newPoints[idx] = [e.target.x(), e.target.y()];
                            updateAnnotation(annotation.id, { data: { points: newPoints } });
                            updateMutation.mutate({
                              id: annotation.id,
                              data: { points: newPoints },
                            });
                          }}
                        />
                      );
                    })}
                  </Fragment>
                );
              }
              return null;

            case 'line':
              const lineData = annotation.data;
              if (lineData.start && lineData.end) {
                return (
                  <Fragment key={annotation.id}>
                    <Line
                      points={[lineData.start[0], lineData.start[1], lineData.end[0], lineData.end[1]]}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth / scale}
                      onClick={(e) => selectAnnotation(annotation.id, e.evt.ctrlKey || e.evt.metaKey)}
                      draggable={isSelected}
                      onDragStart={(e) => {
                        const stage = e.target.getStage();
                        const pointerPos = stage?.getPointerPosition();
                        if (!pointerPos) return;

                        const imageX = (pointerPos.x - position.x) / scale;
                        const imageY = (pointerPos.y - position.y) / scale;

                        dragStartDataRef.current = {
                          start: lineData.start,
                          end: lineData.end,
                          startPos: { x: imageX, y: imageY },
                        };
                      }}
                      onDragMove={(e) => {
                        if (!dragStartDataRef.current?.start || !dragStartDataRef.current?.end || !dragStartDataRef.current?.startPos) return;

                        const stage = e.target.getStage();
                        const pointerPos = stage?.getPointerPosition();
                        if (!pointerPos) return;

                        const imageX = (pointerPos.x - position.x) / scale;
                        const imageY = (pointerPos.y - position.y) / scale;

                        const deltaX = imageX - dragStartDataRef.current.startPos.x;
                        const deltaY = imageY - dragStartDataRef.current.startPos.y;

                        const newStart: [number, number] = [
                          dragStartDataRef.current.start[0] + deltaX,
                          dragStartDataRef.current.start[1] + deltaY,
                        ];
                        const newEnd: [number, number] = [
                          dragStartDataRef.current.end[0] + deltaX,
                          dragStartDataRef.current.end[1] + deltaY,
                        ];
                        updateAnnotationLocal(annotation.id, { data: { start: newStart, end: newEnd } });
                        e.target.position({ x: 0, y: 0 });
                      }}
                      onDragEnd={(e) => {
                        if (!dragStartDataRef.current?.start || !dragStartDataRef.current?.end || !dragStartDataRef.current?.startPos) return;

                        const stage = e.target.getStage();
                        const pointerPos = stage?.getPointerPosition();
                        if (!pointerPos) return;

                        const imageX = (pointerPos.x - position.x) / scale;
                        const imageY = (pointerPos.y - position.y) / scale;

                        const deltaX = imageX - dragStartDataRef.current.startPos.x;
                        const deltaY = imageY - dragStartDataRef.current.startPos.y;

                        const newStart: [number, number] = [
                          dragStartDataRef.current.start[0] + deltaX,
                          dragStartDataRef.current.start[1] + deltaY,
                        ];
                        const newEnd: [number, number] = [
                          dragStartDataRef.current.end[0] + deltaX,
                          dragStartDataRef.current.end[1] + deltaY,
                        ];
                        updateAnnotation(annotation.id, { data: { start: newStart, end: newEnd } });
                        updateMutation.mutate({
                          id: annotation.id,
                          data: { start: newStart, end: newEnd },
                        });
                        e.target.position({ x: 0, y: 0 });
                        dragStartDataRef.current = null;
                      }}
                    />
                    {isSelected && (
                      <>
                        <Circle
                          key={`${annotation.id}-start`}
                          x={lineData.start[0]}
                          y={lineData.start[1]}
                          radius={6 / scale}
                          fill="white"
                          stroke={strokeColor}
                          strokeWidth={2 / scale}
                          draggable
                          onDragMove={(e) => {
                            updateAnnotationLocal(annotation.id, {
                              data: { start: [e.target.x(), e.target.y()], end: lineData.end },
                            });
                          }}
                          onDragEnd={(e) => {
                            const newData = { start: [e.target.x(), e.target.y()], end: lineData.end };
                            updateAnnotation(annotation.id, { data: newData });
                            updateMutation.mutate({ id: annotation.id, data: newData });
                          }}
                        />
                        <Circle
                          key={`${annotation.id}-end`}
                          x={lineData.end[0]}
                          y={lineData.end[1]}
                          radius={6 / scale}
                          fill="white"
                          stroke={strokeColor}
                          strokeWidth={2 / scale}
                          draggable
                          onDragMove={(e) => {
                            updateAnnotationLocal(annotation.id, {
                              data: { start: lineData.start, end: [e.target.x(), e.target.y()] },
                            });
                          }}
                          onDragEnd={(e) => {
                            const newData = { start: lineData.start, end: [e.target.x(), e.target.y()] };
                            updateAnnotation(annotation.id, { data: newData });
                            updateMutation.mutate({ id: annotation.id, data: newData });
                          }}
                        />
                      </>
                    )}
                  </Fragment>
                );
              }
              return null;

            default:
              return null;
          }
        })}

        {/* Drawing preview */}
        {drawingData && (
          <>
            {currentTool === 'circle' && (
              <Circle
                x={drawingData.x}
                y={drawingData.y}
                radius={drawingData.size}
                stroke="#ffff00"
                strokeWidth={2 / scale}
                dash={[5 / scale, 5 / scale]}
              />
            )}
            {currentTool === 'rectangle' && (
              <Rect
                x={Math.min(drawingData.x1, drawingData.x2)}
                y={Math.min(drawingData.y1, drawingData.y2)}
                width={Math.abs(drawingData.x2 - drawingData.x1)}
                height={Math.abs(drawingData.y2 - drawingData.y1)}
                stroke="#ffff00"
                strokeWidth={2 / scale}
                dash={[5 / scale, 5 / scale]}
              />
            )}
            {currentTool === 'line' && (
              <Line
                points={[drawingData.x1, drawingData.y1, drawingData.x2, drawingData.y2]}
                stroke="#ffff00"
                strokeWidth={2 / scale}
                dash={[5 / scale, 5 / scale]}
              />
            )}
            {currentTool === 'polygon' && drawingData.points && (
              <Line
                points={drawingData.points.flatMap((p: [number, number]) => [p[0], p[1]])}
                stroke="#ffff00"
                strokeWidth={2 / scale}
                dash={[5 / scale, 5 / scale]}
                closed={false}
              />
            )}
          </>
        )}

        {/* SAM2 point prompts */}
        {currentTool === 'sam2' && sam2Points.points.map((point, idx) => (
          <Circle
            key={`sam2-point-${idx}`}
            x={point[0]}
            y={point[1]}
            radius={8 / scale}
            fill={sam2Points.labels[idx] === 1 ? '#00ff00' : '#ff0000'}
            stroke="white"
            strokeWidth={2 / scale}
          />
        ))}

        {/* Box selection */}
        {boxSelection && (
          <Rect
            x={Math.min(boxSelection.x1, boxSelection.x2)}
            y={Math.min(boxSelection.y1, boxSelection.y2)}
            width={Math.abs(boxSelection.x2 - boxSelection.x1)}
            height={Math.abs(boxSelection.y2 - boxSelection.y1)}
            stroke="#0066ff"
            strokeWidth={2 / scale}
            dash={[10 / scale, 5 / scale]}
            fill="rgba(0, 102, 255, 0.1)"
          />
        )}
      </Layer>
    </Stage>

    {/* Minimap overlay */}
    <Minimap
      imageUrl={imageUrl}
      imageWidth={imageWidth}
      imageHeight={imageHeight}
      viewportX={position.x}
      viewportY={position.y}
      viewportWidth={stageSize.width}
      viewportHeight={stageSize.height}
      zoom={scale}
      onPan={(x, y) => setPosition({ x, y })}
      visible={showMinimap}
    />

    {/* Right-click context menu */}
    <Menu
      open={contextMenu !== null}
      onClose={() => setContextMenu(null)}
      anchorReference="anchorPosition"
      anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
    >
      <MenuItem disabled>
        <ListItemText>{selectedIds.length} selected</ListItemText>
      </MenuItem>
      <MuiDivider />
      {projectClasses.map((cls) => (
        <MenuItem key={cls} onClick={() => {
          selectedIds.forEach(id => {
            updateAnnotation(id, { class_label: cls });
            annotationAPI.update(id, { class_label: cls });
          });
          setContextMenu(null);
        }}>
          <ListItemIcon><DotIcon fontSize="small" sx={{ color: getClassColor(cls, projectClasses) }} /></ListItemIcon>
          <ListItemText>Set class: {cls}</ListItemText>
        </MenuItem>
      ))}
      {projectClasses.length > 0 && <MuiDivider />}
      <MenuItem onClick={() => { copySelected(); setContextMenu(null); }}>
        <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Copy</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => {
        const ids = [...selectedIds];
        deleteSelected();
        ids.forEach(id => annotationAPI.delete(id).catch(() => {}));
        setContextMenu(null);
      }} sx={{ color: 'error.main' }}>
        <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
        <ListItemText>Delete All</ListItemText>
      </MenuItem>
    </Menu>

    {/* AI Inference Loading Overlay */}
    {(yoloMutation.isPending || sam2Mutation.isPending || simpleBlobMutation.isPending) && (
      <Backdrop
        open={true}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={60} sx={{ color: 'white', mb: 2 }} />
        <Typography variant="h6" sx={{ color: 'white' }}>
          {yoloMutation.isPending && 'Running YOLO Detection...'}
          {sam2Mutation.isPending && 'Running SAM2 Segmentation...'}
          {simpleBlobMutation.isPending && 'Running SimpleBlob Detection...'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'white', mt: 1 }}>
          Please wait...
        </Typography>
      </Backdrop>
    )}
  </Box>
  );
}
