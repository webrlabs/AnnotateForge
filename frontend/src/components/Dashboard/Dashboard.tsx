import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, FolderOpen as FolderIcon, Edit as EditIcon } from '@mui/icons-material';
import { projectAPI } from '@/services/projectService';
import { ProjectCreate } from '@/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [error, setError] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<{ id: string; name: string; description?: string } | null>(null);

  // Fetch projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectAPI.getAll,
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: (data: ProjectCreate) => projectAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCreateDialogOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create project');
    },
  });

  // Update project mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
      projectAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditDialogOpen(false);
      setEditingProject(null);
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to update project');
    },
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }
    createMutation.mutate({
      name: newProjectName,
      description: newProjectDescription || undefined,
    });
  };

  const handleEditProject = (project: { id: string; name: string; description?: string }) => {
    setEditingProject(project);
    setEditDialogOpen(true);
    setError('');
  };

  const handleUpdateProject = () => {
    if (!editingProject) return;
    if (!editingProject.name.trim()) {
      setError('Project name is required');
      return;
    }
    updateMutation.mutate({
      id: editingProject.id,
      data: {
        name: editingProject.name,
        description: editingProject.description || undefined,
      },
    });
  };

  const handleDeleteProject = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete project "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Projects</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            New Project
          </Button>
        </Box>

        {isLoading ? (
          <Typography>Loading projects...</Typography>
        ) : projects.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No projects yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create your first project to start annotating images
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Project
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {projects.map((project) => (
              <Grid item xs={12} sm={6} md={4} key={project.id}>
                <Card>
                  {/* Thumbnail preview grid */}
                  {project.thumbnails && project.thumbnails.length > 0 ? (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns:
                          project.thumbnails.length === 1 ? '1fr' :
                          project.thumbnails.length === 2 ? '1fr 1fr' :
                          project.thumbnails.length === 3 ? '1fr 1fr' :
                          '1fr 1fr',
                        gridTemplateRows:
                          project.thumbnails.length === 1 ? '1fr' :
                          project.thumbnails.length === 2 ? '1fr' :
                          project.thumbnails.length === 3 ? '1fr 1fr' :
                          '1fr 1fr',
                        height: 200,
                        bgcolor: 'grey.200',
                        overflow: 'hidden',
                      }}
                    >
                      {project.thumbnails.slice(0, 4).map((thumb, idx) => (
                        <Box
                          key={idx}
                          component="img"
                          src={`http://localhost:8000${thumb}`}
                          alt={`Preview ${idx + 1}`}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            // For 3 images, make the first one span 2 columns
                            ...(project.thumbnails.length === 3 && idx === 0 && {
                              gridColumn: '1 / 3',
                            }),
                          }}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        height: 200,
                        bgcolor: 'grey.200',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FolderIcon sx={{ fontSize: 64, color: 'grey.400' }} />
                    </Box>
                  )}
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {project.name}
                    </Typography>
                    {project.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {project.description}
                      </Typography>
                    )}
                    <Chip
                      label={`${project.image_count || 0} images`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<FolderIcon />}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      Open
                    </Button>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleEditProject({ id: project.id, name: project.name, description: project.description })}
                      sx={{ ml: 'auto' }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteProject(project.id, project.name)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Create Project Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            label="Project Name"
            fullWidth
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateProject}
            variant="contained"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            label="Project Name"
            fullWidth
            value={editingProject?.name || ''}
            onChange={(e) => setEditingProject(prev => prev ? { ...prev, name: e.target.value } : null)}
            margin="normal"
            required
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={editingProject?.description || ''}
            onChange={(e) => setEditingProject(prev => prev ? { ...prev, description: e.target.value } : null)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUpdateProject}
            variant="contained"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
