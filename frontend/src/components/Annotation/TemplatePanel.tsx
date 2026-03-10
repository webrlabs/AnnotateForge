import { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  TextField,
  Divider,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ContentPaste as PasteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templateAPI, AnnotationTemplate } from '@/services/templateService';
import { Annotation } from '@/types';

interface TemplatePanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  selectedAnnotations: Annotation[];
  onApplyTemplate: (annotations: Array<Record<string, any>>) => void;
}

export default function TemplatePanel({
  open,
  onClose,
  projectId,
  selectedAnnotations,
  onApplyTemplate,
}: TemplatePanelProps) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['templates', projectId],
    queryFn: () => templateAPI.getByProject(projectId),
    enabled: open && !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; annotations: Array<Record<string, any>> }) =>
      templateAPI.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', projectId] });
      setNewName('');
      setNewDescription('');
      setShowCreateForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templateAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', projectId] });
    },
  });

  const handleSaveTemplate = () => {
    if (!newName.trim() || selectedAnnotations.length === 0) return;

    // Strip image-specific fields, keep type/data/class_label
    const templateAnnotations = selectedAnnotations.map(ann => ({
      type: ann.type,
      data: ann.data,
      class_label: ann.class_label || null,
    }));

    createMutation.mutate({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      annotations: templateAnnotations,
    });
  };

  const handleApply = (template: AnnotationTemplate) => {
    onApplyTemplate(template.annotations);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 320 } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>Annotation Templates</Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Save from selection */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          {!showCreateForm ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateForm(true)}
              disabled={selectedAnnotations.length === 0}
              fullWidth
            >
              Save selected as template ({selectedAnnotations.length})
            </Button>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField
                size="small"
                label="Template name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
              />
              <TextField
                size="small"
                label="Description (optional)"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                multiline
                maxRows={2}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSaveTemplate}
                  disabled={!newName.trim() || createMutation.isPending}
                >
                  Save
                </Button>
                <Button
                  size="small"
                  onClick={() => { setShowCreateForm(false); setNewName(''); setNewDescription(''); }}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
        </Box>

        <Divider />

        {/* Template list */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {templates.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No templates yet. Select annotations and save them as a template.
              </Typography>
            </Box>
          ) : (
            <List dense>
              {templates.map(template => (
                <ListItem
                  key={template.id}
                  sx={{
                    '&:hover': { bgcolor: 'action.hover' },
                    pr: 10,
                  }}
                >
                  <ListItemText
                    primary={template.name}
                    secondary={
                      <Box component="span" sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={`${template.annotations.length} annotation${template.annotations.length !== 1 ? 's' : ''}`}
                          size="small"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        {template.description && (
                          <Typography variant="caption" color="text.secondary" component="span">
                            {template.description}
                          </Typography>
                        )}
                      </Box>
                    }
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Apply to current image">
                      <IconButton size="small" onClick={() => handleApply(template)}>
                        <PasteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete template">
                      <IconButton
                        size="small"
                        onClick={() => deleteMutation.mutate(template.id)}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
