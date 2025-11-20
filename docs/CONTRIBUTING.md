# Contributing to AnnotateForge

Thank you for your interest in contributing to AnnotateForge! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We expect everyone to:

- Be respectful and considerate in communication
- Accept constructive feedback gracefully
- Focus on what is best for the community and project
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Personal attacks or trolling
- Publishing others' private information
- Any conduct that would be inappropriate in a professional setting

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Docker & Docker Compose** (recommended) OR native Python 3.11+ and Node.js 18+
- **Git** for version control
- **A GitHub account**
- Familiarity with the technology stack (see README.md)

### Setting Up Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/annotateforge.git
   cd annotateforge
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/annotateforge.git
   ```

4. **Start development environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   docker-compose up -d
   ```

5. **Verify setup**
   ```bash
   # Check all services are running
   docker-compose ps

   # View logs
   docker-compose logs -f
   ```

### Development Guidelines

See `CLAUDE.md` for detailed development conventions including:
- Code style and formatting
- File organization
- Naming conventions
- Common patterns

## Development Workflow

### Branching Strategy

We use a simplified Git flow:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

### Creating a Feature Branch

```bash
# Update your fork
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
```

### Making Changes

1. **Make your changes** following coding standards
2. **Test your changes** thoroughly
3. **Commit with clear messages**
   ```bash
   git add .
   git commit -m "feat(component): add new feature"
   ```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, no logic change)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples:**
```
feat(frontend): add polygon drawing tool

Implement polygon annotation with vertex editing.
Users can click to add points and press Enter to complete.

Closes #42
```

```
fix(backend): resolve SAM2 memory leak

SAM2 models were not released after inference.
Added explicit cleanup in finally block.

Fixes #87
```

## Coding Standards

### Python (Backend)

**Style:** PEP 8 with Black formatting

```python
# Always use type hints
async def get_annotations(
    image_id: UUID,
    db: Session = Depends(get_db)
) -> List[AnnotationResponse]:
    """Get all annotations for an image."""
    pass

# Use async for I/O operations
async def create_annotation(annotation: AnnotationCreate) -> Annotation:
    pass

# Not async for CPU-bound tasks
def run_sam2_inference(image: np.ndarray) -> List[dict]:
    pass
```

**Format code:**
```bash
docker-compose exec backend black app/
docker-compose exec backend isort app/
```

### TypeScript (Frontend)

**Style:** Airbnb + Prettier

```typescript
// Always type your components
interface AnnotationProps {
  annotation: Annotation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const AnnotationShape: React.FC<AnnotationProps> = ({
  annotation,
  isSelected,
  onSelect,
}) => {
  // Use useCallback for event handlers
  const handleClick = useCallback(() => {
    onSelect(annotation.id);
  }, [annotation.id, onSelect]);

  return (
    <Shape
      onClick={handleClick}
      fill={isSelected ? 'red' : 'blue'}
    />
  );
};
```

**Format code:**
```bash
cd frontend
npm run lint
npm run format
```

## Testing Requirements

### Backend Tests

**Location:** `backend/tests/`

**Coverage:** Aim for >80% code coverage

```bash
# Run tests
docker-compose exec backend pytest

# Run with coverage
docker-compose exec backend pytest --cov=app --cov-report=html

# Run specific test
docker-compose exec backend pytest tests/test_annotations.py
```

**Example test:**
```python
def test_create_annotation(client: TestClient, auth_headers):
    response = client.post(
        "/api/v1/images/test-uuid/annotations",
        json={
            "type": "circle",
            "data": {"x": 100, "y": 100, "size": 50}
        },
        headers=auth_headers
    )
    assert response.status_code == 201
    assert response.json()["type"] == "circle"
```

### Frontend Tests

**Location:** `frontend/src/__tests__/`

```bash
cd frontend
npm test
```

**Example test:**
```typescript
import { render, fireEvent } from '@testing-library/react';
import { ImageCanvas } from '../components/ImageCanvas';

test('creates circle on drag', async () => {
  const { container } = render(<ImageCanvas />);
  const canvas = container.querySelector('canvas');

  fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
  fireEvent.mouseUp(canvas, { clientX: 150, clientY: 150 });

  expect(screen.getByTestId('circle-annotation')).toBeInTheDocument();
});
```

## Submitting Changes

### Pull Request Process

1. **Update your branch** with latest changes
   ```bash
   git checkout main
   git pull upstream main
   git checkout feature/your-feature
   git rebase main
   ```

2. **Push to your fork**
   ```bash
   git push origin feature/your-feature
   ```

3. **Create Pull Request** on GitHub

4. **Fill out PR template** with:
   - Description of changes
   - Related issues
   - Testing performed
   - Screenshots (if UI changes)

5. **Address review feedback** if requested

### Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review of code completed
- [ ] Comments added for complex logic
- [ ] Documentation updated (if needed)
- [ ] Tests added/updated and passing
- [ ] No new warnings or errors
- [ ] Commit messages follow convention
- [ ] Branch is up to date with main

### Review Process

- Maintainers will review your PR within 3-5 business days
- Address any requested changes
- Once approved, a maintainer will merge your PR

## Reporting Issues

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Update to latest version** to see if issue persists
3. **Gather relevant information** (logs, screenshots, steps to reproduce)

### Creating a Bug Report

Use the bug report template and include:

- **Description:** Clear description of the bug
- **Steps to Reproduce:** Detailed steps
- **Expected Behavior:** What should happen
- **Actual Behavior:** What actually happens
- **Environment:** OS, browser, Docker version, etc.
- **Logs:** Relevant error messages or logs
- **Screenshots:** If applicable

### Feature Requests

Use the feature request template and include:

- **Problem:** What problem does this solve?
- **Proposed Solution:** How should it work?
- **Alternatives:** Other approaches considered
- **Additional Context:** Mockups, examples, etc.

## Areas for Contribution

We welcome contributions in these areas:

### High Priority
- Bug fixes
- Performance improvements
- Documentation improvements
- Test coverage

### Features
- New annotation shapes
- Export format support
- Keyboard shortcuts
- AI model integrations

### Documentation
- Tutorial videos
- API examples
- Deployment guides
- Translation

## Getting Help

- **Documentation:** See `README.md` and `CLAUDE.md`
- **Questions:** Create a GitHub Discussion
- **Bugs:** Create a GitHub Issue
- **Chat:** Join our community (link TBD)

## Recognition

Contributors will be:
- Listed in the README
- Credited in release notes
- Invited to join the contributors team (for consistent contributors)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to AnnotateForge! 🎨✨
