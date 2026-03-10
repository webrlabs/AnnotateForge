import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Slider,
  Typography,
  Box,
  Chip,
  Switch,
  FormControlLabel,
  TextField,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { Shuffle as ShuffleIcon } from '@mui/icons-material';
import { datasetAPI, SplitConfig } from '@/services/datasetService';

interface SplitManagerProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export default function SplitManager({ projectId, open, onClose }: SplitManagerProps) {
  const queryClient = useQueryClient();
  const [trainRatio, setTrainRatio] = useState(0.7);
  const [valRatio, setValRatio] = useState(0.15);
  const [testRatio, setTestRatio] = useState(0.15);
  const [seed, setSeed] = useState(42);
  const [stratify, setStratify] = useState(true);

  const { data: split, isLoading } = useQuery({
    queryKey: ['dataset-split', projectId],
    queryFn: () => datasetAPI.getSplit(projectId),
    enabled: open,
  });

  // Sync local state from server
  useEffect(() => {
    if (split) {
      setTrainRatio(split.train_ratio);
      setValRatio(split.val_ratio);
      setTestRatio(split.test_ratio);
      setSeed(split.random_seed);
      setStratify(split.stratify_by_class);
    }
  }, [split]);

  const { data: preview } = useQuery({
    queryKey: ['split-preview', projectId, trainRatio, valRatio, testRatio, seed, stratify],
    queryFn: () => datasetAPI.previewSplit(projectId, {
      train_ratio: trainRatio,
      val_ratio: valRatio,
      test_ratio: testRatio,
      random_seed: seed,
      stratify_by_class: stratify,
    }),
    enabled: open && Math.abs(trainRatio + valRatio + testRatio - 1.0) < 0.02,
  });

  const updateMutation = useMutation({
    mutationFn: () => datasetAPI.updateSplit(projectId, {
      train_ratio: trainRatio,
      val_ratio: valRatio,
      test_ratio: testRatio,
      random_seed: seed,
      stratify_by_class: stratify,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-split', projectId] });
      onClose();
    },
  });

  const reshuffleMutation = useMutation({
    mutationFn: () => datasetAPI.reshuffleSplit(projectId),
    onSuccess: (data) => {
      setSeed(data.random_seed);
      queryClient.invalidateQueries({ queryKey: ['dataset-split', projectId] });
    },
  });

  const handleTrainChange = (_: any, value: number | number[]) => {
    const v = value as number;
    setTrainRatio(v);
    // Auto-adjust val and test to maintain sum of 1.0
    const remaining = 1.0 - v;
    const ratio = valRatio / (valRatio + testRatio || 1);
    setValRatio(Math.round(remaining * ratio * 100) / 100);
    setTestRatio(Math.round(remaining * (1 - ratio) * 100) / 100);
  };

  const handleValChange = (_: any, value: number | number[]) => {
    const v = value as number;
    setValRatio(v);
    setTestRatio(Math.round((1.0 - trainRatio - v) * 100) / 100);
  };

  const ratioSum = trainRatio + valRatio + testRatio;
  const isValid = Math.abs(ratioSum - 1.0) < 0.02;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Train / Val / Test Split</DialogTitle>
      <DialogContent>
        {isLoading && <LinearProgress />}

        {!isValid && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Ratios must sum to 1.0 (current: {ratioSum.toFixed(2)})
          </Alert>
        )}

        {/* Sliders */}
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">Train: {Math.round(trainRatio * 100)}%</Typography>
            <Chip label={preview ? `${preview.train_count} images` : '...'} size="small" color="success" />
          </Box>
          <Slider
            value={trainRatio}
            onChange={handleTrainChange}
            min={0.1}
            max={0.95}
            step={0.05}
            sx={{ color: '#4caf50' }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">Validation: {Math.round(valRatio * 100)}%</Typography>
            <Chip label={preview ? `${preview.val_count} images` : '...'} size="small" color="primary" />
          </Box>
          <Slider
            value={valRatio}
            onChange={handleValChange}
            min={0.0}
            max={Math.max(0, 1.0 - trainRatio - 0.05)}
            step={0.05}
            sx={{ color: '#1976d2' }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">Test: {Math.round(testRatio * 100)}%</Typography>
            <Chip label={preview ? `${preview.test_count} images` : '...'} size="small" color="warning" />
          </Box>
          <Slider value={testRatio} disabled min={0} max={1} step={0.05} sx={{ color: '#ff9800' }} />
        </Box>

        {/* Options */}
        <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControlLabel
            control={<Switch checked={stratify} onChange={(e) => setStratify(e.target.checked)} />}
            label="Stratify by class"
          />
          <TextField
            label="Random seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value) || 42)}
            size="small"
            sx={{ width: 120 }}
          />
        </Box>

        {/* Per-class preview */}
        {preview && Object.keys(preview.per_class).length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Per-Class Distribution</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Class</TableCell>
                    <TableCell align="right">Train</TableCell>
                    <TableCell align="right">Val</TableCell>
                    <TableCell align="right">Test</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(preview.per_class).map(([cls, counts]) => (
                    <TableRow key={cls}>
                      <TableCell>{cls}</TableCell>
                      <TableCell align="right">{counts.train}</TableCell>
                      <TableCell align="right">{counts.val}</TableCell>
                      <TableCell align="right">{counts.test}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {split && split.assignments && Object.keys(split.assignments).length > 0 && (
          <Button
            startIcon={<ShuffleIcon />}
            onClick={() => reshuffleMutation.mutate()}
            disabled={reshuffleMutation.isPending}
          >
            Reshuffle
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => updateMutation.mutate()}
          disabled={!isValid || updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Applying...' : 'Apply Split'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
