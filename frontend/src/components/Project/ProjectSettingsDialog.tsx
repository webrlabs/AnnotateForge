import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Alert,
  Divider,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Project, ProjectUpdate } from '@/types';
import { projectAPI } from '@/services/projectService';

interface ProjectSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  project: Project;
}

export const ProjectSettingsDialog: React.FC<ProjectSettingsDialogProps> = ({
  open,
  onClose,
  project,
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [isPublic, setIsPublic] = useState(project.is_public);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (data: ProjectUpdate) => projectAPI.update(project.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to update project');
    },
  });

  const handleSave = () => {
    setError(null);
    updateMutation.mutate({
      name,
      description,
      is_public: isPublic,
    });
  };

  const handleReset = () => {
    setName(project.name);
    setDescription(project.description || '');
    setIsPublic(project.is_public);
    setError(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Project Settings</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            disabled={!project.can_manage_members}
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
            disabled={!project.can_manage_members}
          />

          <Divider sx={{ my: 1 }} />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Visibility
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  disabled={!project.can_manage_members}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">
                    {isPublic ? 'Public Project' : 'Private Project'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isPublic
                      ? 'Any logged-in user can view this project'
                      : 'Only you and invited members can view this project'}
                  </Typography>
                </Box>
              }
            />
          </Box>

          {!project.can_manage_members && (
            <Alert severity="info">
              Only the project owner can change these settings.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {project.can_manage_members && (
          <>
            <Button onClick={handleReset} disabled={updateMutation.isPending}>
              Reset
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={!name.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
