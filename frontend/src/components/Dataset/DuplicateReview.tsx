import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardMedia,
  CardContent,
  Checkbox,
  Chip,
  LinearProgress,
  Alert,
  Grid,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { datasetAPI, DuplicateResponse, DuplicateGroup } from '@/services/datasetService';

interface DuplicateReviewProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export default function DuplicateReview({ projectId, open, onClose }: DuplicateReviewProps) {
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<DuplicateResponse | null>(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const data = await datasetAPI.findDuplicates(projectId, 10);
      setResult(data);
      setSelectedForDeletion(new Set());
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to scan for duplicates');
    } finally {
      setScanning(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: () => datasetAPI.deleteDuplicates(projectId, Array.from(selectedForDeletion)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-images'] });
      // Remove deleted from result
      if (result) {
        const newGroups = result.groups
          .map(g => ({
            ...g,
            images: g.images.filter(img => !selectedForDeletion.has(img.id)),
          }))
          .filter(g => g.images.length >= 2);
        setResult({
          ...result,
          groups: newGroups,
          total_groups: newGroups.length,
          total_duplicates: newGroups.reduce((sum, g) => sum + g.images.length - 1, 0),
        });
      }
      setSelectedForDeletion(new Set());
    },
  });

  const toggleSelect = (imageId: string) => {
    setSelectedForDeletion(prev => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  };

  const autoSelectDuplicates = () => {
    // For each group, keep the first image and select the rest for deletion
    if (!result) return;
    const toDelete = new Set<string>();
    result.groups.forEach(group => {
      group.images.slice(1).forEach(img => toDelete.add(img.id));
    });
    setSelectedForDeletion(toDelete);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Duplicate Detection
          <Button
            startIcon={<SearchIcon />}
            variant="contained"
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? 'Scanning...' : 'Scan for Duplicates'}
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent>
        {scanning && (
          <Box sx={{ py: 4 }}>
            <LinearProgress />
            <Typography sx={{ mt: 2, textAlign: 'center' }} color="text.secondary">
              Computing perceptual hashes and comparing images...
            </Typography>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {result && !scanning && (
          <>
            {/* Summary */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip label={`${result.total_groups} duplicate groups`} color="warning" />
              <Chip label={`${result.total_duplicates} potential duplicates`} color="error" />
              {selectedForDeletion.size > 0 && (
                <Chip label={`${selectedForDeletion.size} selected for deletion`} color="error" variant="outlined" />
              )}
            </Box>

            {result.groups.length === 0 && (
              <Alert severity="success" sx={{ mt: 2 }}>
                No duplicate images found in this project.
              </Alert>
            )}

            {result.groups.length > 0 && (
              <Button size="small" onClick={autoSelectDuplicates} sx={{ mb: 2 }}>
                Auto-select duplicates (keep first of each group)
              </Button>
            )}

            {/* Duplicate groups */}
            {result.groups.map((group, gi) => (
              <Box key={gi} sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Group {gi + 1} ({group.images.length} images)
                </Typography>
                <Grid container spacing={1}>
                  {group.images.map((img, ii) => (
                    <Grid item xs={6} sm={4} md={3} key={img.id}>
                      <Card
                        sx={{
                          position: 'relative',
                          border: 2,
                          borderColor: selectedForDeletion.has(img.id) ? 'error.main' : ii === 0 ? 'success.main' : 'divider',
                          opacity: selectedForDeletion.has(img.id) ? 0.6 : 1,
                        }}
                      >
                        <CardMedia
                          component="img"
                          height={120}
                          image={img.thumbnail_path || ''}
                          alt={img.filename}
                          sx={{ objectFit: 'cover' }}
                        />
                        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                          <Typography variant="caption" noWrap display="block">
                            {img.filename}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {img.width}x{img.height}
                          </Typography>
                        </CardContent>
                        <Checkbox
                          checked={selectedForDeletion.has(img.id)}
                          onChange={() => toggleSelect(img.id)}
                          sx={{ position: 'absolute', top: 0, right: 0, bgcolor: 'rgba(255,255,255,0.8)' }}
                          size="small"
                        />
                        {ii === 0 && (
                          <Chip
                            label="Keep"
                            size="small"
                            color="success"
                            sx={{ position: 'absolute', top: 4, left: 4, height: 20, fontSize: '0.65rem' }}
                          />
                        )}
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                {gi < result.groups.length - 1 && <Divider sx={{ mt: 2 }} />}
              </Box>
            ))}
          </>
        )}

        {!result && !scanning && (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            Click "Scan for Duplicates" to find near-duplicate images using perceptual hashing.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {selectedForDeletion.size > 0 && (
          <Button
            startIcon={<DeleteIcon />}
            color="error"
            variant="contained"
            onClick={() => {
              if (confirm(`Delete ${selectedForDeletion.size} duplicate images? This cannot be undone.`)) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
          >
            Delete {selectedForDeletion.size} Duplicates
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
