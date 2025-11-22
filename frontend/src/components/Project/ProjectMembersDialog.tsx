import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Chip,
  TextField,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Project, ProjectMember, MemberRole } from '@/types';
import { projectAPI } from '@/services/projectService';

interface ProjectMembersDialogProps {
  open: boolean;
  onClose: () => void;
  project: Project;
}

export const ProjectMembersDialog: React.FC<ProjectMembersDialogProps> = ({
  open,
  onClose,
  project,
}) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>(MemberRole.VIEWER);

  // Fetch members
  const {
    data: members = [],
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ['projectMembers', project.id],
    queryFn: () => projectAPI.getMembers(project.id),
    enabled: open && project.can_manage_members,
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: (data: { email: string; role: MemberRole }) =>
      projectAPI.addMember(project.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMembers', project.id] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      setShowAddMember(false);
      setNewMemberEmail('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to add member');
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: MemberRole }) =>
      projectAPI.updateMember(project.id, memberId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMembers', project.id] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to update member');
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => projectAPI.removeMember(project.id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMembers', project.id] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to remove member');
    },
  });

  const handleAddMember = () => {
    setError(null);
    if (!newMemberEmail.trim() || !newMemberEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    addMemberMutation.mutate({
      email: newMemberEmail.trim(),
      role: newMemberRole,
    });
  };

  if (!project.can_manage_members) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Project Members</DialogTitle>
        <DialogContent>
          <Alert severity="info">
            Only the project owner can manage members.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Project Members</Typography>
          <Chip label={`${members.length} members`} size="small" />
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {fetchError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load members
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {!showAddMember ? (
              <Button
                startIcon={<PersonAddIcon />}
                onClick={() => setShowAddMember(true)}
                variant="outlined"
                fullWidth
                sx={{ mb: 2 }}
              >
                Add Member
              </Button>
            ) : (
              <Box sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Add New Member
                </Typography>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Enter the email address of the user you want to add. They must have an account.
                </Typography>
                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                  sx={{ mt: 1, mb: 2 }}
                />
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as MemberRole)}
                    label="Role"
                  >
                    <MenuItem value={MemberRole.VIEWER}>
                      Viewer - Can view project and annotations
                    </MenuItem>
                    <MenuItem value={MemberRole.EDITOR}>
                      Editor - Can edit annotations
                    </MenuItem>
                  </Select>
                </FormControl>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    onClick={() => {
                      setShowAddMember(false);
                      setNewMemberEmail('');
                      setError(null);
                    }}
                    variant="outlined"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddMember}
                    variant="contained"
                    disabled={!newMemberEmail || addMemberMutation.isPending}
                  >
                    {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
                  </Button>
                </Box>
              </Box>
            )}

            <List>
              {members.map((member) => (
                <ListItem key={member.id} divider>
                  <ListItemText
                    primary={member.username}
                    secondary={member.email}
                  />
                  <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={member.role}
                        onChange={(e) =>
                          updateRoleMutation.mutate({
                            memberId: member.id,
                            role: e.target.value as MemberRole,
                          })
                        }
                        disabled={updateRoleMutation.isPending}
                      >
                        <MenuItem value={MemberRole.VIEWER}>Viewer</MenuItem>
                        <MenuItem value={MemberRole.EDITOR}>Editor</MenuItem>
                      </Select>
                    </FormControl>
                    <IconButton
                      edge="end"
                      onClick={() => removeMemberMutation.mutate(member.id)}
                      disabled={removeMemberMutation.isPending}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            {members.length === 0 && !showAddMember && (
              <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                No members yet. Add members to collaborate on this project.
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
