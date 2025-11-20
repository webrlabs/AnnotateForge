import { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Chip,
  Divider,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
  Paper,
  Stack,
} from '@mui/material';
import { Delete as DeleteIcon, DeleteSweep as DeleteSweepIcon, ExpandMore as ExpandMoreIcon, BarChart as StatsIcon } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAnnotationStore } from '@/store/annotationStore';
import { annotationAPI } from '@/services/annotationService';
import { imageAPI } from '@/services/imageService';
import { Image } from '@/types';

interface AnnotationListProps {
  imageId: string;
  projectClasses: string[];
  image?: Image;
}

export default function AnnotationList({ imageId, projectClasses, image }: AnnotationListProps) {
  const queryClient = useQueryClient();
  const { annotations, selectedIds, selectAnnotation, deleteAnnotation, updateAnnotation, clearSelection } = useAnnotationStore();
  const [showStats, setShowStats] = useState(false);

  // Delete annotation mutation
  const deleteMutation = useMutation({
    mutationFn: (annotationId: string) => annotationAPI.delete(annotationId),
    onSuccess: (_, annotationId) => {
      queryClient.invalidateQueries({ queryKey: ['annotations', imageId] });
      deleteAnnotation(annotationId);
    },
  });

  // Update annotation class mutation
  const updateClassMutation = useMutation({
    mutationFn: ({ id, class_label }: { id: string; class_label: string | null }) =>
      annotationAPI.update(id, { class_label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', imageId] });
    },
  });

  // Update image class mutation
  const updateImageClassMutation = useMutation({
    mutationFn: (image_class: string | null) => imageAPI.update(imageId, { image_class }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image', imageId] });
    },
  });

  const handleDelete = (annotationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this annotation?')) {
      deleteMutation.mutate(annotationId);
    }
  };

  const handleClearAll = () => {
    if (annotations.length === 0) return;

    if (window.confirm(`Delete all ${annotations.length} annotations? This cannot be undone.`)) {
      // Delete all annotations
      annotations.forEach(ann => {
        deleteMutation.mutate(ann.id);
      });
    }
  };

  const handleClassChange = (annotationId: string, className: string) => {
    const class_label = className === '' ? null : className;
    // Update local state immediately
    const annotation = annotations.find(a => a.id === annotationId);
    if (annotation) {
      updateAnnotation(annotationId, { class_label });
    }
    // Update backend
    updateClassMutation.mutate({ id: annotationId, class_label });
  };

  const handleImageClassChange = (className: string) => {
    const image_class = className === '' ? null : className;
    updateImageClassMutation.mutate(image_class);
  };

  const handleSelectAll = () => {
    clearSelection();
    annotations.forEach((ann, idx) => selectAnnotation(ann.id, idx > 0));
  };

  const handleBatchClassChange = (className: string) => {
    const class_label = className === '' ? null : className;

    // Update all selected annotations
    selectedIds.forEach(id => {
      const annotation = annotations.find(a => a.id === id);
      if (annotation) {
        updateAnnotation(id, { class_label });
        updateClassMutation.mutate({ id, class_label });
      }
    });
  };

  const getAnnotationIcon = (type: string) => {
    switch (type) {
      case 'circle':
        return '⭕';
      case 'box':
        return '▢';
      case 'rectangle':
        return '▭';
      case 'polygon':
        return '⬡';
      default:
        return '•';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'manual':
        return 'default';
      case 'sam2':
        return 'primary';
      case 'yolo':
        return 'secondary';
      case 'simpleblob':
        return 'info';
      default:
        return 'default';
    }
  };

  // Calculate statistics
  const stats = {
    total: annotations.length,
    byType: annotations.reduce((acc, ann) => {
      acc[ann.type] = (acc[ann.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byClass: annotations.reduce((acc, ann) => {
      const className = ann.class_label || 'Unclassified';
      acc[className] = (acc[className] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    bySource: annotations.reduce((acc, ann) => {
      acc[ann.source] = (acc[ann.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Image Classification */}
      {projectClasses.length > 0 && image && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Image Classification
          </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Image Class</InputLabel>
            <Select
              value={image.image_class || ''}
              onChange={(e) => handleImageClassChange(e.target.value)}
              label="Image Class"
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {projectClasses.map((className) => (
                <MenuItem key={className} value={className}>
                  {className}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">Annotations</Typography>
          {annotations.length > 0 && (
            <Button
              size="small"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={handleClearAll}
              sx={{ fontSize: '0.75rem' }}
            >
              Clear All
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {annotations.length} total {selectedIds.length > 0 && `• ${selectedIds.length} selected`}
          </Typography>
          {annotations.length > 0 && (
            <Button
              size="small"
              onClick={selectedIds.length === annotations.length ? clearSelection : handleSelectAll}
              sx={{ fontSize: '0.7rem' }}
            >
              {selectedIds.length === annotations.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </Box>
      </Box>

      {/* Batch Operations */}
      {selectedIds.length > 1 && projectClasses.length > 0 && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Batch Operations ({selectedIds.length} selected)
          </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Assign Class to Selected</InputLabel>
            <Select
              value=""
              onChange={(e) => handleBatchClassChange(e.target.value)}
              label="Assign Class to Selected"
            >
              <MenuItem value="">
                <em>Clear Class</em>
              </MenuItem>
              {projectClasses.map((className) => (
                <MenuItem key={className} value={className}>
                  {className}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Statistics */}
      {annotations.length > 0 && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Button
            fullWidth
            onClick={() => setShowStats(!showStats)}
            endIcon={<ExpandMoreIcon sx={{ transform: showStats ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />}
            sx={{ justifyContent: 'space-between', p: 2, textTransform: 'none' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StatsIcon fontSize="small" />
              <Typography variant="subtitle2">Statistics</Typography>
            </Box>
          </Button>
          <Collapse in={showStats}>
            <Box sx={{ p: 2, bgcolor: 'background.default' }}>
              {/* By Type */}
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                By Type:
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
                {Object.entries(stats.byType).map(([type, count]) => (
                  <Chip key={type} label={`${type}: ${count}`} size="small" variant="outlined" />
                ))}
              </Stack>

              {/* By Source */}
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                By Source:
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
                {Object.entries(stats.bySource).map(([source, count]) => (
                  <Chip key={source} label={`${source}: ${count}`} size="small" color={getSourceColor(source)} />
                ))}
              </Stack>

              {/* By Class */}
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                By Class:
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
                {Object.entries(stats.byClass).map(([className, count]) => (
                  <Chip
                    key={className}
                    label={`${className}: ${count}`}
                    size="small"
                    color={className === 'Unclassified' ? 'default' : 'success'}
                  />
                ))}
              </Stack>
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Annotations List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {annotations.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No annotations yet
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Select a tool to start annotating
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {annotations.map((annotation, index) => (
              <Box key={annotation.id}>
                <ListItem
                  disablePadding
                  sx={{ flexDirection: 'column', alignItems: 'stretch' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <ListItemButton
                      selected={selectedIds.includes(annotation.id)}
                      onClick={() => selectAnnotation(annotation.id)}
                      sx={{ flex: 1 }}
                    >
                      <ListItemText
                        primary={
                          <>
                            <Typography variant="body2" component="span">
                              {getAnnotationIcon(annotation.type)} {annotation.type}
                            </Typography>
                            {annotation.class_label && (
                              <Chip
                                label={annotation.class_label}
                                size="small"
                                color="success"
                                sx={{ ml: 1, verticalAlign: 'middle' }}
                              />
                            )}
                          </>
                        }
                        secondary={
                          <>
                            <Chip
                              label={annotation.source}
                              size="small"
                              color={getSourceColor(annotation.source)}
                              sx={{ fontSize: '0.7rem' }}
                            />
                            {annotation.confidence && (
                              <Chip
                                label={`${(annotation.confidence * 100).toFixed(0)}%`}
                                size="small"
                                sx={{ ml: 0.5, fontSize: '0.7rem' }}
                              />
                            )}
                          </>
                        }
                        primaryTypographyProps={{ component: 'div' }}
                        secondaryTypographyProps={{ component: 'div', sx: { mt: 0.5 } }}
                      />
                    </ListItemButton>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => handleDelete(annotation.id, e)}
                      sx={{ mr: 1 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  {/* Class Selector */}
                  {projectClasses.length > 0 && (
                    <Box sx={{ px: 2, pb: 1 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Class</InputLabel>
                        <Select
                          value={annotation.class_label || ''}
                          onChange={(e) => handleClassChange(annotation.id, e.target.value)}
                          label="Class"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {projectClasses.map((className) => (
                            <MenuItem key={className} value={className}>
                              {className}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  )}
                </ListItem>
                {index < annotations.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        )}
      </Box>

    </Box>
  );
}
