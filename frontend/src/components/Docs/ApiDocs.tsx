/**
 * API Documentation page with inference examples
 */
import { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Divider,
  Chip,
  Alert,
} from '@mui/material';
import { Code as CodeIcon } from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`api-tabpanel-${index}`}
      aria-labelledby={`api-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const CodeBlock = ({ code, language = 'python' }: { code: string; language?: string }) => (
  <Box
    component="pre"
    sx={{
      bgcolor: '#1e1e1e',
      color: '#d4d4d4',
      p: 2,
      borderRadius: 1,
      overflow: 'auto',
      fontSize: '0.875rem',
      fontFamily: 'monospace',
    }}
  >
    <code>{code}</code>
  </Box>
);

export const ApiDocs = () => {
  const [tabValue, setTabValue] = useState(0);

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          API Documentation
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Learn how to use the AnnotateForge API for inference and model predictions
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>API Base URL:</strong> <code>{baseUrl}</code>
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          All API requests require authentication using a JWT token in the Authorization header:
          <code style={{ marginLeft: '0.5rem' }}>Authorization: Bearer YOUR_TOKEN</code>
        </Typography>
      </Alert>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="API documentation tabs">
          <Tab label="Authentication" />
          <Tab label="YOLO Detection" />
          <Tab label="SAM2 Segmentation" />
          <Tab label="SimpleBlob Detection" />
          <Tab label="Trained Models" />
        </Tabs>
      </Box>

      {/* Authentication Tab */}
      <TabPanel value={tabValue} index={0}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Authentication
            </Typography>
            <Typography variant="body2" paragraph>
              All API endpoints require JWT authentication. First, obtain a token by logging in.
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Login and Get Token
            </Typography>
            <Chip label="POST" color="success" size="small" sx={{ mb: 1 }} />
            <Typography variant="body2" sx={{ mb: 2 }}>
              <code>{baseUrl}/auth/login</code>
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Python Example:
            </Typography>
            <CodeBlock
              code={`import requests

# Login and get token
response = requests.post("${baseUrl}/auth/login", json={
    "username": "your_username",
    "password": "your_password"
})

token = response.json()["access_token"]
print(f"Token: {token}")

# Use token in subsequent requests
headers = {"Authorization": f"Bearer {token}"}
`}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
              JavaScript/TypeScript Example:
            </Typography>
            <CodeBlock
              language="javascript"
              code={`// Login and get token
const response = await fetch("${baseUrl}/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "your_username",
    password: "your_password"
  })
});

const { access_token } = await response.json();
console.log("Token:", access_token);

// Use token in subsequent requests
const headers = { "Authorization": \`Bearer \${access_token}\` };
`}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
              cURL Example:
            </Typography>
            <CodeBlock
              language="bash"
              code={`# Login
curl -X POST "${baseUrl}/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"username": "your_username", "password": "your_password"}'

# Use the returned token
TOKEN="your_token_here"
`}
            />
          </CardContent>
        </Card>
      </TabPanel>

      {/* YOLO Detection Tab */}
      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              YOLO Object Detection
            </Typography>
            <Typography variant="body2" paragraph>
              Detect objects in images using YOLO models. Returns bounding boxes with class labels and confidence scores.
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Run YOLO Detection
            </Typography>
            <Chip label="POST" color="success" size="small" sx={{ mb: 1 }} />
            <Typography variant="body2" sx={{ mb: 2 }}>
              <code>{baseUrl}/inference/yolo</code>
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Request Body:
            </Typography>
            <CodeBlock
              language="json"
              code={`{
  "image_id": "uuid-of-your-image",
  "confidence": 0.25,  // Optional, default: 0.25
  "iou_threshold": 0.45,  // Optional, default: 0.45
  "max_detections": 300  // Optional, default: 300
}`}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Python Example:
            </Typography>
            <CodeBlock
              code={`import requests

# Your authentication token
headers = {"Authorization": f"Bearer {token}"}

# Run YOLO detection
response = requests.post(
    "${baseUrl}/inference/yolo",
    headers=headers,
    json={
        "image_id": "your-image-uuid",
        "confidence": 0.3,
        "iou_threshold": 0.5
    }
)

detections = response.json()

# Process results
for detection in detections["annotations"]:
    print(f"Class: {detection['label']}")
    print(f"Confidence: {detection['confidence']:.2f}")
    print(f"Box: {detection['data']}")
`}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
              Response Format:
            </Typography>
            <CodeBlock
              language="json"
              code={`{
  "annotations": [
    {
      "type": "box",
      "label": "particle",
      "confidence": 0.89,
      "data": {
        "x": 150,
        "y": 200,
        "width": 50,
        "height": 50
      }
    }
  ],
  "model_info": {
    "model": "yolov8n.pt",
    "inference_time_ms": 45.2
  }
}`}
            />
          </CardContent>
        </Card>
      </TabPanel>

      {/* SAM2 Segmentation Tab */}
      <TabPanel value={tabValue} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              SAM2 Segmentation
            </Typography>
            <Typography variant="body2" paragraph>
              Segment objects using Segment Anything Model 2 (SAM2) with point prompts or bounding box prompts.
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Run SAM2 Segmentation
            </Typography>
            <Chip label="POST" color="success" size="small" sx={{ mb: 1 }} />
            <Typography variant="body2" sx={{ mb: 2 }}>
              <code>{baseUrl}/inference/sam2</code>
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Request Body (Point Prompts):
            </Typography>
            <CodeBlock
              language="json"
              code={`{
  "image_id": "uuid-of-your-image",
  "prompts": {
    "points": [[100, 150], [200, 250]],
    "labels": [1, 1]  // 1 = positive, 0 = negative
  }
}`}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Request Body (Box Prompt):
            </Typography>
            <CodeBlock
              language="json"
              code={`{
  "image_id": "uuid-of-your-image",
  "prompts": {
    "boxes": [[50, 50, 150, 150]]  // [x1, y1, x2, y2]
  }
}`}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Python Example:
            </Typography>
            <CodeBlock
              code={`import requests
import numpy as np

headers = {"Authorization": f"Bearer {token}"}

# SAM2 with point prompts
response = requests.post(
    "${baseUrl}/inference/sam2",
    headers=headers,
    json={
        "image_id": "your-image-uuid",
        "prompts": {
            "points": [[100, 150]],
            "labels": [1]
        }
    }
)

result = response.json()

# Get the segmentation mask
mask = result["masks"][0]  # Binary mask as list of lists
print(f"Mask shape: {len(mask)}x{len(mask[0])}")

# Convert to numpy array
mask_array = np.array(mask, dtype=np.uint8)
`}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
              Response Format:
            </Typography>
            <CodeBlock
              language="json"
              code={`{
  "masks": [
    [[0, 0, 1, 1, ...], [0, 1, 1, 1, ...], ...]
  ],
  "scores": [0.95],
  "model_info": {
    "model": "sam2.1_b.pt",
    "inference_time_ms": 123.4
  }
}`}
            />
          </CardContent>
        </Card>
      </TabPanel>

      {/* SimpleBlob Detection Tab */}
      <TabPanel value={tabValue} index={3}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              SimpleBlob Particle Detection
            </Typography>
            <Typography variant="body2" paragraph>
              Detect circular particles using OpenCV's SimpleBlob detector. Fast and effective for particle analysis.
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Run SimpleBlob Detection
            </Typography>
            <Chip label="POST" color="success" size="small" sx={{ mb: 1 }} />
            <Typography variant="body2" sx={{ mb: 2 }}>
              <code>{baseUrl}/inference/simpleblob</code>
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Request Body:
            </Typography>
            <CodeBlock
              language="json"
              code={`{
  "image_id": "uuid-of-your-image",
  "min_size": 5,  // Minimum particle radius in pixels
  "max_size": 50,  // Maximum particle radius in pixels
  "threshold": 127  // Binary threshold (0-255)
}`}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Python Example:
            </Typography>
            <CodeBlock
              code={`import requests

headers = {"Authorization": f"Bearer {token}"}

# Run SimpleBlob detection
response = requests.post(
    "${baseUrl}/inference/simpleblob",
    headers=headers,
    json={
        "image_id": "your-image-uuid",
        "min_size": 10,
        "max_size": 40,
        "threshold": 100
    }
)

particles = response.json()

# Process particles
for particle in particles["annotations"]:
    x, y = particle["data"]["x"], particle["data"]["y"]
    size = particle["data"]["size"]
    print(f"Particle at ({x}, {y}) with radius {size}")
`}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
              Response Format:
            </Typography>
            <CodeBlock
              language="json"
              code={`{
  "annotations": [
    {
      "type": "circle",
      "label": "particle",
      "confidence": 1.0,
      "data": {
        "x": 125,
        "y": 240,
        "size": 15
      }
    }
  ],
  "count": 142,
  "inference_time_ms": 12.3
}`}
            />
          </CardContent>
        </Card>
      </TabPanel>

      {/* Trained Models Tab */}
      <TabPanel value={tabValue} index={4}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Using Your Trained Models
            </Typography>
            <Typography variant="body2" paragraph>
              Use your custom-trained YOLO models for inference on new images.
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              List Your Trained Models
            </Typography>
            <Chip label="GET" color="primary" size="small" sx={{ mb: 1 }} />
            <Typography variant="body2" sx={{ mb: 2 }}>
              <code>{baseUrl}/training/models</code>
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Python Example:
            </Typography>
            <CodeBlock
              code={`import requests

headers = {"Authorization": f"Bearer {token}"}

# Get all trained models
response = requests.get(
    "${baseUrl}/training/models",
    headers=headers,
    params={"is_active": True}  # Get only active models
)

models = response.json()

for model in models:
    print(f"Model: {model['name']}")
    print(f"  Task: {model['task_type']}")
    print(f"  Classes: {model['num_classes']}")
    print(f"  mAP: {model['performance_metrics'].get('map', 'N/A')}")
`}
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Run Inference with Trained Model
            </Typography>
            <Chip label="POST" color="success" size="small" sx={{ mb: 1 }} />
            <Typography variant="body2" sx={{ mb: 2 }}>
              <code>{baseUrl}/training/models/MODEL_ID/predict</code>
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Python Example:
            </Typography>
            <CodeBlock
              code={`import requests

headers = {"Authorization": f"Bearer {token}"}
model_id = "your-model-uuid"

# Run prediction
response = requests.post(
    f"${baseUrl}/training/models/{model_id}/predict",
    headers=headers,
    json={
        "image_id": "your-image-uuid",
        "confidence": 0.3,
        "iou_threshold": 0.5
    }
)

predictions = response.json()

# Process predictions
for pred in predictions["predictions"]:
    print(f"Class: {pred['class']}")
    print(f"Confidence: {pred['confidence']:.2f}")
    print(f"Box: {pred['bbox']}")
`}
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Download Trained Model
            </Typography>
            <Chip label="GET" color="primary" size="small" sx={{ mb: 1 }} />
            <Typography variant="body2" sx={{ mb: 2 }}>
              <code>{baseUrl}/training/models/MODEL_ID/download</code>
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Python Example:
            </Typography>
            <CodeBlock
              code={`import requests

headers = {"Authorization": f"Bearer {token}"}
model_id = "your-model-uuid"

# Download model file
response = requests.get(
    f"${baseUrl}/training/models/{model_id}/download",
    headers=headers,
    stream=True
)

# Save to file
with open("my_model.pt", "wb") as f:
    for chunk in response.iter_content(chunk_size=8192):
        f.write(chunk)

print("Model downloaded successfully!")
`}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
              Using Downloaded Model Locally:
            </Typography>
            <CodeBlock
              code={`from ultralytics import YOLO

# Load your downloaded model
model = YOLO("my_model.pt")

# Run inference on a local image
results = model.predict("test_image.jpg", conf=0.3)

# Process results
for result in results:
    boxes = result.boxes
    for box in boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        xyxy = box.xyxy[0].cpu().numpy()
        print(f"Class {cls}, Conf: {conf:.2f}, Box: {xyxy}")
`}
            />
          </CardContent>
        </Card>
      </TabPanel>

      {/* Additional Resources */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Additional Resources
          </Typography>
          <Typography variant="body2" paragraph>
            • <strong>Interactive API Docs:</strong> Visit <code>{baseUrl.replace('/api/v1', '')}/docs</code> for Swagger UI
          </Typography>
          <Typography variant="body2" paragraph>
            • <strong>API Schema:</strong> Visit <code>{baseUrl.replace('/api/v1', '')}/redoc</code> for ReDoc documentation
          </Typography>
          <Typography variant="body2">
            • <strong>GitHub Repository:</strong> Check out the{' '}
            <a href="https://github.com/webrlabs/annotateforge" target="_blank" rel="noopener noreferrer">
              AnnotateForge repository
            </a>{' '}
            for more examples and updates
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
};
