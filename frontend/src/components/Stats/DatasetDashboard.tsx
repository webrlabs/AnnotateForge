import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Image as ImageIcon,
  Label as LabelIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { statsAPI } from '@/services/statsService';
import { CLASS_COLORS } from '@/utils/classColors';

const SOURCE_COLORS: Record<string, string> = {
  manual: '#4caf50',
  yolo: '#2196f3',
  sam2: '#ff9800',
  simpleblob: '#9c27b0',
};

const TYPE_COLORS: Record<string, string> = {
  circle: '#e91e63',
  box: '#3f51b5',
  rectangle: '#009688',
  polygon: '#ff5722',
  line: '#795548',
};

function StatCard({ title, value, subtitle, icon, color }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card elevation={2}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{
          bgcolor: `${color}15`,
          borderRadius: 2,
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
        }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="h4" fontWeight="bold">{value}</Typography>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DatasetDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['project-stats', projectId],
    queryFn: () => statsAPI.getProjectStats(projectId!),
    enabled: !!projectId,
  });

  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ['class-distribution', projectId],
    queryFn: () => statsAPI.getClassDistribution(projectId!),
    enabled: !!projectId,
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['annotation-timeline', projectId],
    queryFn: () => statsAPI.getTimeline(projectId!, 30),
    enabled: !!projectId,
  });

  const { data: coverage, isLoading: coverageLoading } = useQuery({
    queryKey: ['annotation-coverage', projectId],
    queryFn: () => statsAPI.getCoverage(projectId!),
    enabled: !!projectId,
  });

  const isLoading = statsLoading || classLoading || timelineLoading || coverageLoading;

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading statistics...</Typography>
      </Box>
    );
  }

  if (!stats) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load project statistics.</Alert>
      </Box>
    );
  }

  const completionPercent = stats.total_images > 0
    ? Math.round((stats.annotated_images / stats.total_images) * 100)
    : 0;

  // Prepare chart data
  const classChartData = classData?.classes.map((cls, i) => ({
    name: cls.class_label,
    count: cls.annotation_count,
    images: cls.image_count,
    fill: CLASS_COLORS[i % CLASS_COLORS.length],
  })) || [];

  const typeChartData = Object.entries(stats.annotations_by_type).map(([type, count]) => ({
    name: type,
    value: count,
    fill: TYPE_COLORS[type] || '#999',
  }));

  const sourceChartData = Object.entries(stats.annotations_by_source).map(([source, count]) => ({
    name: source,
    value: count,
    fill: SOURCE_COLORS[source] || '#999',
  }));

  const coverageBucketData = coverage
    ? Object.entries(coverage.buckets).map(([bucket, count]) => ({
        name: bucket,
        count,
      }))
    : [];

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Tooltip title="Back to Project">
          <IconButton onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Typography variant="h5" fontWeight="bold">Dataset Statistics</Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Images"
            value={stats.total_images}
            icon={<ImageIcon />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Annotated"
            value={`${stats.annotated_images} (${completionPercent}%)`}
            subtitle={`${stats.unannotated_images} remaining`}
            icon={<CheckIcon />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Annotations"
            value={stats.total_annotations}
            subtitle={`Avg ${stats.avg_annotations_per_image} per image`}
            icon={<LabelIcon />}
            color="#ff9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Classes"
            value={Object.keys(stats.annotations_by_class).length}
            icon={<LabelIcon />}
            color="#9c27b0"
          />
        </Grid>
      </Grid>

      {/* Completion Progress Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" fontWeight="bold">Annotation Progress</Typography>
          <Typography variant="body2" color="text.secondary">
            {stats.annotated_images} / {stats.total_images} images
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={completionPercent}
          sx={{ height: 10, borderRadius: 5 }}
        />
      </Paper>

      <Grid container spacing={3}>
        {/* Class Distribution Bar Chart */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Class Distribution</Typography>
            {classChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={classChartData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={75} />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [value, name === 'count' ? 'Annotations' : 'Images']}
                  />
                  <Legend />
                  <Bar dataKey="count" name="Annotations" fill="#1976d2" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="images" name="Images" fill="#4caf50" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No annotations yet
              </Typography>
            )}
            {/* Low-count warnings */}
            {classData?.classes.filter(c => c.annotation_count < 10).map(cls => (
              <Chip
                key={cls.class_label}
                icon={<WarningIcon />}
                label={`"${cls.class_label}" has only ${cls.annotation_count} annotations`}
                color="warning"
                size="small"
                sx={{ mr: 1, mt: 1 }}
              />
            ))}
          </Paper>
        </Grid>

        {/* Type Pie Chart */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Annotation Types</Typography>
            {typeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={typeChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {typeChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No annotations yet
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Source Breakdown */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Source Breakdown</Typography>
            {sourceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={sourceChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {sourceChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No annotations yet
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Timeline */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Annotations Over Time (Last 30 Days)</Typography>
            {timeline && timeline.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={timeline.timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <RechartsTooltip
                    labelFormatter={(d) => new Date(d).toLocaleDateString()}
                    formatter={(value: number) => [value, 'Annotations']}
                  />
                  <Line type="monotone" dataKey="count" stroke="#1976d2" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No recent annotation activity
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Coverage Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Annotations Per Image Distribution</Typography>
            {coverage && (
              <>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Chip label={`Min: ${coverage.distribution.min}`} size="small" />
                  <Chip label={`Max: ${coverage.distribution.max}`} size="small" />
                  <Chip label={`Avg: ${coverage.distribution.avg}`} size="small" />
                  <Chip label={`Median: ${coverage.distribution.median}`} size="small" />
                </Box>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={coverageBucketData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip formatter={(value: number) => [value, 'Images']} />
                    <Bar dataKey="count" fill="#1976d2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </Paper>
        </Grid>

        {/* Class Details Table */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Class Details</Typography>
            {classData && classData.classes.length > 0 ? (
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Class</TableCell>
                      <TableCell align="right">Annotations</TableCell>
                      <TableCell align="right">Images</TableCell>
                      <TableCell align="right">Avg Conf.</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {classData.classes.map((cls, i) => (
                      <TableRow key={cls.class_label}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: CLASS_COLORS[i % CLASS_COLORS.length],
                            }} />
                            {cls.class_label}
                          </Box>
                        </TableCell>
                        <TableCell align="right">{cls.annotation_count}</TableCell>
                        <TableCell align="right">{cls.image_count}</TableCell>
                        <TableCell align="right">
                          {cls.avg_confidence !== null ? `${(cls.avg_confidence * 100).toFixed(0)}%` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No annotations yet
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
