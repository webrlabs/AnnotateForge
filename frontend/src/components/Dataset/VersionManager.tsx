import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Box,
  Chip,
  Tooltip,
  Divider,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  CompareArrows as CompareIcon,
} from '@mui/icons-material';
import { datasetAPI, DatasetVersion } from '@/services/datasetService';

interface VersionManagerProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export default function VersionManager({ projectId, open, onClose }: VersionManagerProps) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

  const { data: versions, isLoading } = useQuery({
    queryKey: ['dataset-versions', projectId],
    queryFn: () => datasetAPI.listVersions(projectId),
    enabled: open,
  });

  const { data: diff } = useQuery({
    queryKey: ['version-diff', projectId, compareA, compareB],
    queryFn: () => datasetAPI.diffVersions(projectId, compareA!, compareB!),
    enabled: !!compareA && !!compareB,
  });

  const [createError, setCreateError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      datasetAPI.createVersion(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-versions', projectId] });
      setShowCreate(false);
      setName('');
      setDescription('');
      setCreateError(null);
    },
    onError: (err: any) => {
      setCreateError(err.response?.data?.detail || err.message || 'Failed to create version');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (versionId: string) => datasetAPI.deleteVersion(projectId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-versions', projectId] });
    },
  });

  const handleCompareClick = (versionId: string) => {
    if (!compareA) {
      setCompareA(versionId);
    } else if (!compareB && versionId !== compareA) {
      setCompareB(versionId);
    } else {
      setCompareA(versionId);
      setCompareB(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Dataset Versions
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            size="small"
            onClick={() => setShowCreate(true)}
          >
            Create Snapshot
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent>
        {isLoading && <LinearProgress />}

        {/* Create form */}
        {showCreate && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>New Version Snapshot</Typography>
            <TextField
              label="Version Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              size="small"
              fullWidth
              sx={{ mb: 1 }}
              placeholder="e.g., v1.0-initial"
            />
            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              size="small"
              fullWidth
              multiline
              rows={2}
              sx={{ mb: 1 }}
            />
            {createError && (
              <Alert severity="error" sx={{ mb: 1 }} onClose={() => setCreateError(null)}>
                {createError}
              </Alert>
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                onClick={() => createMutation.mutate({ name: name.trim(), description: description.trim() || undefined })}
                disabled={!name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
              <Button size="small" onClick={() => { setShowCreate(false); setCreateError(null); }}>Cancel</Button>
            </Box>
          </Box>
        )}

        {/* Version list */}
        {versions && versions.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No versions yet. Create a snapshot to freeze your current annotations.
          </Typography>
        )}

        <List>
          {versions?.map((v) => (
            <ListItem
              key={v.id}
              sx={{
                border: 1,
                borderColor: (compareA === v.id || compareB === v.id) ? 'primary.main' : 'divider',
                borderRadius: 1,
                mb: 1,
                bgcolor: (compareA === v.id || compareB === v.id) ? 'action.selected' : undefined,
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={`v${v.version_number}`} size="small" color="primary" />
                    <Typography variant="subtitle2">{v.name}</Typography>
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    {v.description && (
                      <Typography variant="caption" display="block">{v.description}</Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                      <Chip label={`${v.image_count} images`} size="small" variant="outlined" />
                      <Chip label={`${v.annotation_count} annotations`} size="small" variant="outlined" />
                      {Object.entries(v.class_counts).map(([cls, count]) => (
                        <Chip key={cls} label={`${cls}: ${count}`} size="small" variant="outlined" />
                      ))}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Created {new Date(v.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Tooltip title="Select for comparison">
                  <IconButton size="small" onClick={() => handleCompareClick(v.id)}>
                    <CompareIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete version">
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (confirm(`Delete version "${v.name}"?`)) {
                        deleteMutation.mutate(v.id);
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>

        {/* Diff view */}
        {diff && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Comparison: v{diff.version_a.version_number} vs v{diff.version_b.version_number}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Chip label={`+${diff.images_added} images`} color="success" size="small" />
              <Chip label={`-${diff.images_removed} images`} color="error" size="small" />
              <Chip label={`+${diff.annotations_added} annotations`} color="success" size="small" />
              <Chip label={`-${diff.annotations_removed} annotations`} color="error" size="small" />
            </Box>
            {Object.keys(diff.class_changes).length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">Class changes:</Typography>
                {Object.entries(diff.class_changes).map(([cls, counts]) => (
                  <Typography key={cls} variant="body2">
                    {cls}: {counts.a} → {counts.b} ({counts.b - counts.a >= 0 ? '+' : ''}{counts.b - counts.a})
                  </Typography>
                ))}
              </Box>
            )}
            <Button size="small" sx={{ mt: 1 }} onClick={() => { setCompareA(null); setCompareB(null); }}>
              Clear comparison
            </Button>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
