import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Grid,
  Card,
  CardMedia,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  TextField,
  Chip,
  Stack,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Pagination,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Tooltip,
  Container,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
  Label as LabelIcon,
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  CloudUpload as CloudUploadIcon,
  SkipNext as SkipNextIcon,
  BarChart as BarChartIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  Public as PublicIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { projectAPI } from '@/services/projectService';
import { imageAPI } from '@/services/imageService';
import { exportAPI, type ExportFormat } from '@/services/exportService';
import { importAPI, type ImportFormat, type ImportResult } from '@/services/importService';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { ProjectMembersDialog } from './ProjectMembersDialog';

export default function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterAnnotationClass, setFilterAnnotationClass] = useState('');
  const [filterAnnotations, setFilterAnnotations] = useState('all');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('detection');
  const [isExporting, setIsExporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<ImportFormat>('yolo_detection');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [page, setPage] = useState(1);
  const imagesPerPage = 50;
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  // Fetch project details
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectAPI.getById(projectId!),
    enabled: !!projectId,
  });

  // Fetch images in project
  const { data: images = [], isLoading } = useQuery({
    queryKey: ['images', projectId],
    queryFn: () => imageAPI.getByProject(projectId!),
    enabled: !!projectId,
  });

  // Upload image mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return imageAPI.upload(projectId!, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.detail || 'Upload failed');
    },
  });

  // Delete image mutation
  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => imageAPI.delete(imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  // Update project classes mutation
  const updateClassesMutation = useMutation({
    mutationFn: (classes: string[]) => projectAPI.update(projectId!, { classes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const handleUploadFiles = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setUploadError('Please select at least one file');
      return;
    }

    setUploadError('');

    // Upload files sequentially
    for (let i = 0; i < selectedFiles.length; i++) {
      await uploadMutation.mutateAsync(selectedFiles[i]);
    }

    // Close dialog and reset
    setUploadDialogOpen(false);
    setSelectedFiles(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files);
    setUploadError('');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Filter for image files only
      const imageFiles = Array.from(e.dataTransfer.files).filter(file =>
        file.type.startsWith('image/')
      );

      if (imageFiles.length === 0) {
        setUploadError('Please drop image files only');
        return;
      }

      // Create a FileList-like object
      const dataTransfer = new DataTransfer();
      imageFiles.forEach(file => dataTransfer.items.add(file));
      setSelectedFiles(dataTransfer.files);
      setUploadError('');
    }
  };

  const handleDeleteImage = (imageId: string, filename: string) => {
    if (window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      deleteMutation.mutate(imageId);
    }
  };

  const handleOpenImage = (imageId: string) => {
    navigate(`/projects/${projectId}/images/${imageId}`);
  };

  const handleAddClass = () => {
    if (!newClassName.trim() || !project) return;

    const classes = project.classes || [];
    if (classes.includes(newClassName.trim())) {
      alert('Class already exists');
      return;
    }

    updateClassesMutation.mutate([...classes, newClassName.trim()]);
    setNewClassName('');
  };

  const handleRemoveClass = (className: string) => {
    if (!project) return;
    if (window.confirm(`Remove class "${className}"?`)) {
      const classes = (project.classes || []).filter(c => c !== className);
      updateClassesMutation.mutate(classes);
    }
  };

  const handleExport = async () => {
    if (!projectId || !project) return;

    // Check if project has classes
    if (!project.classes || project.classes.length === 0) {
      alert('Please add classes to the project before exporting.');
      return;
    }

    setIsExporting(true);
    try {
      let blob: Blob;
      let filename: string;

      if (exportFormat === 'coco') {
        blob = await exportAPI.exportCOCO(projectId);
        filename = `${project.name}_coco.zip`;
      } else {
        blob = await exportAPI.exportYOLO(projectId, exportFormat);
        filename = `${project.name}_yolo_${exportFormat}.zip`;
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportDialogOpen(false);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!projectId || !importFile) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await importAPI.importDataset(projectId, importFile, importFormat);
      setImportResult(result);

      // Refresh project and images
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['images', projectId] });
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false);
    setImportFile(null);
    setImportResult(null);
  };

  const handleJumpToUnannotated = () => {
    // Find first image with no annotations
    const unannotatedImage = images.find(img => img.annotation_count === 0);
    if (unannotatedImage) {
      navigate(`/projects/${projectId}/images/${unannotatedImage.id}`);
    } else {
      alert('All images have been annotated!');
    }
  };

  // Filter images
  const filteredImages = images.filter(image => {
    // Search by filename
    if (searchQuery && !image.filename.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Filter by image class
    if (filterClass && image.image_class !== filterClass) {
      return false;
    }

    // Filter by annotation class
    if (filterAnnotationClass && !image.annotation_classes.includes(filterAnnotationClass)) {
      return false;
    }

    // Filter by annotation count
    if (filterAnnotations === 'no_annotations' && image.annotation_count > 0) {
      return false;
    }
    if (filterAnnotations === 'has_annotations' && image.annotation_count === 0) {
      return false;
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredImages.length / imagesPerPage);
  const startIndex = (page - 1) * imagesPerPage;
  const endIndex = startIndex + imagesPerPage;
  const paginatedImages = filteredImages.slice(startIndex, endIndex);

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Page Header with Actions */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h4">
                {project?.name || 'Project'}
              </Typography>
              {project && (
                <Chip
                  icon={project.is_public ? <PublicIcon /> : <LockIcon />}
                  label={project.is_public ? 'Public' : 'Private'}
                  size="small"
                  variant="outlined"
                  color={project.is_public ? 'success' : 'default'}
                />
              )}
              {project && project.member_count > 0 && (
                <Chip
                  icon={<PeopleIcon />}
                  label={`${project.member_count} member${project.member_count > 1 ? 's' : ''}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
            {project?.description && (
              <Typography variant="body1" color="text.secondary">
                {project.description}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            {project?.can_manage_members && (
              <>
                <Tooltip title="Project Settings">
                  <Button
                    variant="outlined"
                    startIcon={<SettingsIcon />}
                    onClick={() => setSettingsDialogOpen(true)}
                  >
                    Settings
                  </Button>
                </Tooltip>
                <Tooltip title="Manage Members">
                  <Button
                    variant="outlined"
                    startIcon={<PeopleIcon />}
                    onClick={() => setMembersDialogOpen(true)}
                  >
                    Members
                  </Button>
                </Tooltip>
              </>
            )}
            <Tooltip title="Manage Classes">
              <Button
                variant="outlined"
                startIcon={<LabelIcon />}
                onClick={() => setClassDialogOpen(true)}
                disabled={!project?.can_edit}
              >
                Classes
              </Button>
            </Tooltip>
            <Tooltip title="Import Dataset">
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => setImportDialogOpen(true)}
                disabled={!project?.can_edit}
              >
                Import
              </Button>
            </Tooltip>
            <Tooltip title="Export Dataset">
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => setExportDialogOpen(true)}
              >
                Export
              </Button>
            </Tooltip>
            <Tooltip title="Jump to First Unannotated Image">
              <IconButton
                color="primary"
                onClick={handleJumpToUnannotated}
              >
                <SkipNextIcon />
              </IconButton>
            </Tooltip>
            {project?.can_edit && (
              <Tooltip title="Upload Images">
                <Button
                  variant="contained"
                  startIcon={<UploadIcon />}
                  onClick={() => setUploadDialogOpen(true)}
                >
                  Upload
                </Button>
              </Tooltip>
            )}
          </Stack>
        </Box>
      </Box>

      {/* Project Statistics Dashboard */}
      <Box>
        {images.length > 0 && (
          <Accordion sx={{ mb: 2, border: 1, borderColor: 'divider' }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ bgcolor: 'background.paper' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChartIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  Project Statistics
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ bgcolor: 'background.default' }}>
              <Grid container spacing={3}>
                {/* Overview Statistics */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                      Overview
                    </Typography>
                    <Stack spacing={1.5}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Total Images:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{images.length}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Total Annotations:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {images.reduce((sum, img) => sum + img.annotation_count, 0)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Images Annotated:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {images.filter(img => img.annotation_count > 0).length}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Images Not Annotated:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {images.filter(img => img.annotation_count === 0).length}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Avg. Annotations/Image:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {(images.reduce((sum, img) => sum + img.annotation_count, 0) / images.length).toFixed(1)}
                        </Typography>
                      </Box>
                      <Divider sx={{ my: 1 }} />
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">Completion:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {((images.filter(img => img.annotation_count > 0).length / images.length) * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(images.filter(img => img.annotation_count > 0).length / images.length) * 100}
                          sx={{ height: 8, borderRadius: 1 }}
                        />
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>

                {/* Class Distribution */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                      Class Distribution
                    </Typography>
                    {project?.classes && project.classes.length > 0 ? (
                      <Stack spacing={1.5}>
                        {(() => {
                          // Calculate class counts from images
                          const classCounts: Record<string, number> = {};
                          images.forEach(img => {
                            img.annotation_classes.forEach(cls => {
                              classCounts[cls] = (classCounts[cls] || 0) + 1;
                            });
                          });
                          const maxCount = Math.max(...Object.values(classCounts), 1);

                          return project.classes.map(className => {
                            const count = classCounts[className] || 0;
                            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                            return (
                              <Box key={className}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="body2" color="text.secondary">{className}</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{count}</Typography>
                                </Box>
                                <LinearProgress
                                  variant="determinate"
                                  value={percentage}
                                  sx={{ height: 6, borderRadius: 1 }}
                                />
                              </Box>
                            );
                          });
                        })()}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No classes defined yet
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Compact Classes and Filters */}
        {project && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            {/* Classes row */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', minWidth: 60 }}>
                Classes:
              </Typography>
              {project.classes && project.classes.length > 0 ? (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
                  {project.classes.map((className) => (
                    <Chip
                      key={className}
                      label={className}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  ))}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  None
                </Typography>
              )}
              <Button
                size="small"
                startIcon={<LabelIcon fontSize="small" />}
                onClick={() => setClassDialogOpen(true)}
                sx={{ fontSize: '0.7rem', py: 0.5, px: 1, minWidth: 'auto' }}
              >
                Manage
              </Button>
            </Box>

            {/* Filters row */}
            {images.length > 0 && (
              <>
                <Divider sx={{ mb: 1.5 }} />
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Search filename..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Image Class</InputLabel>
                      <Select
                        value={filterClass}
                        onChange={(e) => setFilterClass(e.target.value)}
                        label="Image Class"
                      >
                        <MenuItem value="">All</MenuItem>
                        {project.classes?.map((className) => (
                          <MenuItem key={className} value={className}>
                            {className}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Annotation Class</InputLabel>
                      <Select
                        value={filterAnnotationClass}
                        onChange={(e) => setFilterAnnotationClass(e.target.value)}
                        label="Annotation Class"
                      >
                        <MenuItem value="">All</MenuItem>
                        {project.classes?.map((className) => (
                          <MenuItem key={className} value={className}>
                            {className}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Annotations</InputLabel>
                      <Select
                        value={filterAnnotations}
                        onChange={(e) => setFilterAnnotations(e.target.value)}
                        label="Annotations"
                      >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="no_annotations">None</MenuItem>
                        <MenuItem value="has_annotations">Has</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Showing {filteredImages.length} of {images.length} images
                </Typography>
              </>
            )}
          </Box>
        )}

        {isLoading ? (
          <Typography>Loading images...</Typography>
        ) : images.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <ImageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No images yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload images to start annotating
            </Typography>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Images
            </Button>
          </Box>
        ) : filteredImages.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No images match the current filters
            </Typography>
            <Button
              size="small"
              onClick={() => {
                setSearchQuery('');
                setFilterClass('');
                setFilterAnnotationClass('');
                setFilterAnnotations('all');
              }}
              sx={{ mt: 2 }}
            >
              Clear Filters
            </Button>
          </Box>
        ) : (
          <>
            <Grid container spacing={2}>
              {paginatedImages.map((image) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={image.id}>
                  <Card>
                    <CardMedia
                      component="img"
                      height="200"
                      image={`http://localhost:8000${image.thumbnail_path}`}
                      alt={image.filename}
                      sx={{ objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => handleOpenImage(image.id)}
                    />
                    <CardActions>
                      <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                        {image.filename}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteImage(image.id, image.filename)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Pagination */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                  size="large"
                  showFirstButton
                  showLastButton
                />
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload Images</DialogTitle>
        <DialogContent>
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {uploadError}
            </Alert>
          )}

          {/* Drag and Drop Zone */}
          <Box
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            sx={{
              mt: 2,
              p: 4,
              border: '2px dashed',
              borderColor: dragActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              bgcolor: dragActive ? 'action.hover' : 'background.paper',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {dragActive ? 'Drop images here' : 'Drag & drop images here'}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              or click to browse
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supports: JPG, PNG, BMP, GIF
            </Typography>
          </Box>

          <input
            id="file-upload-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {selectedFiles && selectedFiles.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Selected Files ({selectedFiles.length})
              </Typography>
              <Box sx={{
                maxHeight: 200,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1
              }}>
                {Array.from(selectedFiles).map((file, idx) => (
                  <Chip
                    key={idx}
                    label={file.name}
                    size="small"
                    sx={{ m: 0.5 }}
                    onDelete={() => {
                      const dt = new DataTransfer();
                      Array.from(selectedFiles).forEach((f, i) => {
                        if (i !== idx) dt.items.add(f);
                      });
                      setSelectedFiles(dt.files.length > 0 ? dt.files : null);
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {uploadMutation.isPending && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Uploading images...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUploadFiles}
            variant="contained"
            disabled={uploadMutation.isPending || !selectedFiles}
            startIcon={<UploadIcon />}
          >
            Upload {selectedFiles && selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Classes Dialog */}
      <Dialog open={classDialogOpen} onClose={() => setClassDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Classes</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Define the object classes for this project. You can assign these classes to annotations later.
          </Typography>

          {/* Current Classes */}
          {project?.classes && project.classes.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Current Classes:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {project.classes.map((className) => (
                  <Chip
                    key={className}
                    label={className}
                    onDelete={() => handleRemoveClass(className)}
                    color="primary"
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Add New Class */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <TextField
              label="New Class Name"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddClass()}
              size="small"
              fullWidth
              placeholder="e.g., penguin, rock, water"
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddClass}
              disabled={!newClassName.trim()}
            >
              Add
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Project</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Export your annotations in YOLO or COCO format. Choose the format based on your target model type.
          </Typography>

          <FormControl fullWidth>
            <InputLabel>Export Format</InputLabel>
            <Select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              label="Export Format"
            >
              <MenuItem value="detection">
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>YOLO Detection (Bounding Boxes)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    For YOLO object detection. Converts all annotations to bounding boxes.
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="segmentation">
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>YOLO Segmentation (Polygons)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    For YOLO segmentation. Converts circles and rectangles to polygons.
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="classification">
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>YOLO Classification</Typography>
                  <Typography variant="caption" color="text.secondary">
                    For image classification. Uses image-level classes only.
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="coco">
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>COCO Format</Typography>
                  <Typography variant="caption" color="text.secondary">
                    For COCO-compatible models. Includes bounding boxes and segmentation masks.
                  </Typography>
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

          {project && project.classes && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Classes to export ({project.classes.length}):
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {project.classes.map((className) => (
                  <Chip key={className} label={className} size="small" />
                ))}
              </Stack>
            </Box>
          )}

          {(!project?.classes || project.classes.length === 0) && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No classes defined. Please add classes to the project before exporting.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleExport}
            variant="contained"
            startIcon={<DownloadIcon />}
            disabled={isExporting || !project?.classes || project.classes.length === 0}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={handleCloseImportDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Import Dataset</DialogTitle>
        <DialogContent>
          {!importResult ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Import an existing dataset in YOLO or COCO format. Upload a ZIP file containing images and annotations.
              </Typography>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Import Format</InputLabel>
                <Select
                  value={importFormat}
                  onChange={(e) => setImportFormat(e.target.value as ImportFormat)}
                  label="Import Format"
                  disabled={isImporting}
                >
                  <MenuItem value="yolo_detection">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>YOLO Detection</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Bounding box annotations (class_id x y w h format)
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="yolo_segmentation">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>YOLO Segmentation</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Polygon annotations (class_id x1 y1 x2 y2... format)
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="coco">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>COCO Format</Typography>
                      <Typography variant="caption" color="text.secondary">
                        COCO JSON with annotations and images
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <Box
                sx={{
                  border: 2,
                  borderColor: 'divider',
                  borderStyle: 'dashed',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  bgcolor: 'background.default',
                }}
              >
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleImportFileChange}
                  style={{ display: 'none' }}
                  id="import-file-input"
                  disabled={isImporting}
                />
                <label htmlFor="import-file-input">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<CloudUploadIcon />}
                    disabled={isImporting}
                  >
                    Choose ZIP File
                  </Button>
                </label>
                {importFile && (
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    Selected: {importFile.name}
                  </Typography>
                )}
              </Box>

              {isImporting && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                    Importing dataset...
                  </Typography>
                </Box>
              )}

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="caption">
                  <strong>Expected structure:</strong><br />
                  • YOLO: images/, labels/, classes.txt<br />
                  • COCO: images/, annotations.json
                </Typography>
              </Alert>
            </>
          ) : (
            <Box>
              <Alert severity={importResult.status === 'partial_success' ? 'warning' : 'success'} sx={{ mb: 2 }}>
                {importResult.status === 'partial_success'
                  ? 'Dataset imported with some errors'
                  : 'Dataset imported successfully!'}
              </Alert>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Import Summary:
                </Typography>
                <Typography variant="body2">
                  • Images imported: {importResult.imported_images}
                </Typography>
                <Typography variant="body2">
                  • Annotations imported: {importResult.imported_annotations}
                </Typography>
                <Typography variant="body2">
                  • Total classes: {importResult.classes.length}
                </Typography>
              </Box>

              {importResult.new_classes.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    New classes added:
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {importResult.new_classes.map((className) => (
                      <Chip key={className} label={className} size="small" color="primary" />
                    ))}
                  </Stack>
                </Box>
              )}

              {importResult.failed_images && importResult.failed_images.length > 0 && (
                <Box>
                  <Alert severity="error" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Failed to import {importResult.failed_images.length} images:
                    </Typography>
                  </Alert>
                  <Box sx={{ maxHeight: 200, overflow: 'auto', p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                    {importResult.failed_images.map((error, idx) => (
                      <Typography key={idx} variant="caption" display="block">
                        • {error}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImportDialog}>
            {importResult ? 'Close' : 'Cancel'}
          </Button>
          {!importResult && (
            <Button
              onClick={handleImport}
              variant="contained"
              startIcon={<CloudUploadIcon />}
              disabled={isImporting || !importFile}
            >
              {isImporting ? 'Importing...' : 'Import'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Project Settings Dialog */}
      {project && (
        <ProjectSettingsDialog
          open={settingsDialogOpen}
          onClose={() => setSettingsDialogOpen(false)}
          project={project}
        />
      )}

      {/* Project Members Dialog */}
      {project && (
        <ProjectMembersDialog
          open={membersDialogOpen}
          onClose={() => setMembersDialogOpen(false)}
          project={project}
        />
      )}
    </Container>
  );
}
