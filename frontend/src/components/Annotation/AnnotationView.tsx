import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Box,
  Alert,
  Snackbar,
} from '@mui/material';
import { useAuthStore } from '@/store/authStore';
import { useAnnotationStore } from '@/store/annotationStore';
import { useUIStore } from '@/store/uiStore';
import { imageAPI } from '@/services/imageService';
import { annotationAPI } from '@/services/annotationService';
import { projectAPI } from '@/services/projectService';
import { useCollaboration } from '@/hooks/useCollaboration';
import { ActiveUsers } from '@/components/Collaboration';
import ImageCanvas from './ImageCanvas';
import ToolPanel from './ToolPanel';
import AnnotationList from './AnnotationList';
import KeyboardShortcutDialog from './KeyboardShortcutDialog';
import { ImageToolbar } from './ImageToolbar';

export default function AnnotationView() {
  const { projectId, imageId } = useParams<{ projectId: string; imageId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setAnnotations, undo, redo, canUndo, canRedo, copySelected, pasteClipboard, duplicateSelected, selectedIds, updateAnnotation, addAnnotation, deleteAnnotation } = useAnnotationStore();
  const { brightness, contrast, setBrightness, setContrast, setTool } = useUIStore();
  const lastImageIdRef = useRef<string | null>(null);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; severity: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  const previousActiveUsersRef = useRef<Map<string, string>>(new Map()); // user_id -> username
  const isInitialMountRef = useRef(true);

  // AI Tool Settings State
  const [selectedYoloModelId, setSelectedYoloModelId] = useState<string | null>(null);
  const [yoloConfidence, setYoloConfidence] = useState(0.5);
  const [sam2Multimask, setSam2Multimask] = useState(true);
  const [simpleBlobParams, setSimpleBlobParams] = useState({
    min_threshold: 40,
    max_threshold: 255,
    min_area: 100,
    max_area: 1000,
    filter_by_circularity: true,
  });

  // Mutation for updating annotation class
  const updateClassMutation = useMutation({
    mutationFn: ({ id, class_label }: { id: string; class_label: string }) =>
      annotationAPI.update(id, { class_label }),
  });

  const handleResetEnhancements = () => {
    setBrightness(0);
    setContrast(0);
  };

  // Zoom control functions
  const triggerZoom = (command: string) => {
    window.dispatchEvent(new CustomEvent('canvasZoom', { detail: { command } }));
  };

  // Fetch project details
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectAPI.getById(projectId!),
    enabled: !!projectId,
  });

  // Fetch all images in the project for navigation
  const { data: projectImages = [] } = useQuery({
    queryKey: ['images', projectId],
    queryFn: () => imageAPI.getByProject(projectId!),
    enabled: !!projectId,
  });

  // Fetch image details
  const { data: image } = useQuery({
    queryKey: ['image', imageId],
    queryFn: () => imageAPI.getById(imageId!),
    enabled: !!imageId,
  });

  // Fetch annotations for this image
  const { data: annotations = [] } = useQuery({
    queryKey: ['annotations', imageId],
    queryFn: () => annotationAPI.getByImage(imageId!),
    enabled: !!imageId,
  });

  // Collaboration WebSocket callbacks
  const handleAnnotationCreated = useCallback((annotation: any) => {
    // Don't add if it's from the current user (already added optimistically)
    if (annotation.created_by !== user?.id) {
      addAnnotation(annotation);
      setNotification({
        message: `New annotation added by another user`,
        severity: 'info',
      });
    }
  }, [user?.id, addAnnotation]);

  const handleAnnotationUpdated = useCallback((annotation: any) => {
    updateAnnotation(annotation.id, annotation);
    if (annotation.created_by !== user?.id) {
      setNotification({
        message: `Annotation updated by another user`,
        severity: 'info',
      });
    }
  }, [user?.id, updateAnnotation]);

  const handleAnnotationDeleted = useCallback((annotationId: string) => {
    deleteAnnotation(annotationId);
    setNotification({
      message: `Annotation deleted by another user`,
      severity: 'info',
    });
  }, [deleteAnnotation]);

  // Collaboration WebSocket hook
  const { activeUsers } = useCollaboration({
    imageId: imageId || '',
    onAnnotationCreated: handleAnnotationCreated,
    onAnnotationUpdated: handleAnnotationUpdated,
    onAnnotationDeleted: handleAnnotationDeleted,
  });

  // Reset initial mount flag when image changes
  useEffect(() => {
    isInitialMountRef.current = true;
  }, [imageId]);

  // Track active users changes and show notifications
  useEffect(() => {
    // Create a sorted array of user IDs for comparison
    const currentUserIds = activeUsers.map(u => u.user_id).sort();
    const previousUserIds = Array.from(previousActiveUsersRef.current.keys()).sort();

    // Skip notifications on initial mount - just set the baseline
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      previousActiveUsersRef.current = new Map(activeUsers.map(u => [u.user_id, u.username]));
      return;
    }

    // Check if the user lists are actually different
    const hasChanged = currentUserIds.length !== previousUserIds.length ||
                       currentUserIds.some((id, index) => id !== previousUserIds[index]);

    if (!hasChanged) {
      return;
    }

    // Create a map of current users
    const currentUsersMap = new Map(activeUsers.map(u => [u.user_id, u.username]));

    // Find users who joined (in current but not in previous)
    currentUsersMap.forEach((username, userId) => {
      if (!previousActiveUsersRef.current.has(userId) && userId !== user?.id) {
        setNotification({
          message: `${username} joined`,
          severity: 'info',
        });
      }
    });

    // Find users who left (in previous but not in current)
    previousActiveUsersRef.current.forEach((username, userId) => {
      if (!currentUsersMap.has(userId) && userId !== user?.id) {
        setNotification({
          message: `${username} left`,
          severity: 'info',
        });
      }
    });

    // Update the previous users reference
    previousActiveUsersRef.current = currentUsersMap;
  }, [activeUsers, user?.id]);

  // Calculate navigation
  const currentImageIndex = projectImages.findIndex(img => img.id === imageId);
  const hasPrevious = currentImageIndex > 0;
  const hasNext = currentImageIndex < projectImages.length - 1;
  const previousImageId = hasPrevious ? projectImages[currentImageIndex - 1]?.id : null;
  const nextImageId = hasNext ? projectImages[currentImageIndex + 1]?.id : null;

  // Load annotations into store when imageId changes
  useEffect(() => {
    if (!imageId) return;

    if (imageId !== lastImageIdRef.current) {
      // New image selected - clear annotations and update ref
      lastImageIdRef.current = imageId;
      setAnnotations([]);
      // Clear previous active users for new image and reset initial mount flag
      previousActiveUsersRef.current.clear();
      isInitialMountRef.current = true;
    }
  }, [imageId, setAnnotations]);

  // Update store when annotations are fetched for current image
  useEffect(() => {
    if (imageId && imageId === lastImageIdRef.current) {
      setAnnotations(annotations);
    }
  }, [imageId, annotations.length, setAnnotations]);

  const handlePreviousImage = () => {
    if (previousImageId) {
      navigate(`/projects/${projectId}/images/${previousImageId}`);
    }
  };

  const handleNextImage = () => {
    if (nextImageId) {
      navigate(`/projects/${projectId}/images/${nextImageId}`);
    }
  };

  // Keyboard navigation for images
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && previousImageId) {
        e.preventDefault();
        handlePreviousImage();
      } else if (e.key === 'ArrowRight' && nextImageId) {
        e.preventDefault();
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previousImageId, nextImageId]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Ctrl+Z for undo, Ctrl+Shift+Z for redo (case-insensitive)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      // Ctrl+Y for redo (alternative)
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Tool keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input and no modifier keys
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
        return;
      }

      const key = e.key.toLowerCase();

      // Tool shortcuts
      if (key === 'v') {
        e.preventDefault();
        setTool('select');
      } else if (key === 'c') {
        e.preventDefault();
        setTool('circle');
      } else if (key === 'r') {
        e.preventDefault();
        setTool('rectangle');
      } else if (key === 'p') {
        e.preventDefault();
        setTool('polygon');
      } else if (key === 's') {
        e.preventDefault();
        setTool('sam2');
      } else if (key === 'y') {
        e.preventDefault();
        setTool('yolo');
      } else if (key === 'b') {
        e.preventDefault();
        setTool('simpleblob');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool]);

  // Copy/paste/duplicate keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Ctrl+C for copy
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelected();
      }
      // Ctrl+V for paste
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteClipboard();
      }
      // Ctrl+D for duplicate
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copySelected, pasteClipboard, duplicateSelected]);

  // Quick class assignment with number keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input and no modifier keys
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
        return;
      }

      // Check if it's a number key 1-9
      const keyNum = parseInt(e.key);
      if (keyNum >= 1 && keyNum <= 9 && project?.classes && selectedIds.length > 0) {
        e.preventDefault();
        const classIndex = keyNum - 1;
        if (classIndex < project.classes.length) {
          const className = project.classes[classIndex];
          // Update all selected annotations with this class
          selectedIds.forEach(id => {
            updateAnnotation(id, { class_label: className });
            updateClassMutation.mutate({ id, class_label: className });
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, selectedIds, updateAnnotation]);

  // Keyboard shortcut help dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Toggle help dialog with ?
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setHelpDialogOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Image-specific toolbar */}
      <ImageToolbar
        currentImageIndex={currentImageIndex}
        totalImages={projectImages.length}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={handlePreviousImage}
        onNext={handleNextImage}
        canUndo={canUndo()}
        canRedo={canRedo()}
        onUndo={undo}
        onRedo={redo}
        onZoom={triggerZoom}
        brightness={brightness}
        contrast={contrast}
        onBrightnessChange={setBrightness}
        onContrastChange={setContrast}
        onResetEnhancements={handleResetEnhancements}
        onHelpOpen={() => setHelpDialogOpen(true)}
        imageFilename={image?.filename}
      />

      {/* Main content area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Tool Panel - Left side */}
        <Box
          sx={{
            width: 80,
            borderRight: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
          }}
        >
          <ToolPanel
            yoloModelId={selectedYoloModelId}
            yoloConfidence={yoloConfidence}
            sam2Multimask={sam2Multimask}
            simpleBlobParams={simpleBlobParams}
            onYoloModelChange={setSelectedYoloModelId}
            onYoloConfidenceChange={setYoloConfidence}
            onSAM2MultimaskChange={setSam2Multimask}
            onSimpleBlobParamsChange={setSimpleBlobParams}
          />
        </Box>

        {/* Canvas - Center */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#2e2e2e',
            overflow: 'hidden',
          }}
        >
          {image && (
            <ImageCanvas
              imageUrl={`http://localhost:8000${image.original_path}`}
              imageId={imageId!}
              imageWidth={image.width}
              imageHeight={image.height}
              yoloModelId={selectedYoloModelId}
              yoloConfidence={yoloConfidence}
              sam2Multimask={sam2Multimask}
              simpleBlobParams={simpleBlobParams}
            />
          )}
        </Box>

        {/* Annotation List - Right side */}
        <Box
          sx={{
            width: 300,
            borderLeft: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
          }}
        >
          {/* Active Users - Top of sidebar */}
          <Box
            sx={{
              p: 1,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <ActiveUsers users={activeUsers} currentUserId={user?.id} variant="compact" />
          </Box>
          <AnnotationList imageId={imageId!} projectClasses={project?.classes || []} image={image} />
        </Box>
      </Box>

      {/* Keyboard Shortcut Help Dialog */}
      <KeyboardShortcutDialog open={helpDialogOpen} onClose={() => setHelpDialogOpen(false)} />

      {/* Collaboration Notifications */}
      <Snackbar
        open={notification !== null}
        autoHideDuration={4000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {notification && (
          <Alert
            onClose={() => setNotification(null)}
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
}
