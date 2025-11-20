# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of AnnotateForge seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please Do Not

- **Do not** open a public GitHub issue for security vulnerabilities
- **Do not** disclose the vulnerability publicly until we've had a chance to address it

### Please Do

1. **Email us directly** or **open a GitHub Security Advisory** at: https://github.com/webrlabs/annotateforge/security/advisories/new

2. **Include the following information:**
   - Type of vulnerability (e.g., XSS, SQL injection, authentication bypass)
   - Full paths of source file(s) related to the vulnerability
   - Location of the affected source code (tag/branch/commit or direct URL)
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if possible)
   - Impact of the vulnerability
   - Potential fixes (if you have any ideas)

3. **Expected response time:**
   - We will acknowledge receipt of your vulnerability report within 48 hours
   - We will send you regular updates about our progress
   - We aim to issue a fix within 30 days for high-severity issues

## Security Best Practices

When using AnnotateForge, please follow these security best practices:

### Deployment

1. **Change default credentials**
   ```bash
   # Use strong passwords in .env
   POSTGRES_PASSWORD=<strong-random-password>
   SECRET_KEY=<generated-with-openssl-rand-hex-32>
   ```

2. **Use HTTPS in production**
   - Never serve the application over HTTP in production
   - Use valid SSL/TLS certificates
   - Enable HSTS (HTTP Strict Transport Security)

3. **Restrict CORS origins**
   ```bash
   # Only allow your actual frontend domain
   CORS_ORIGINS=https://yourdomain.com
   ```

4. **Keep dependencies updated**
   ```bash
   # Backend
   docker-compose exec backend pip list --outdated

   # Frontend
   cd frontend && npm outdated
   ```

5. **Use environment-specific configurations**
   - Set `DEBUG=false` in production
   - Set `ENVIRONMENT=production`
   - Enable rate limiting
   - Configure firewall rules

### Database Security

1. **Use strong PostgreSQL passwords**
2. **Restrict database access** to application containers only
3. **Enable database connection encryption**
4. **Regular database backups**
5. **Do not expose database ports** publicly

### API Security

1. **JWT tokens** are used for authentication
2. **Token expiration** is enforced (default: 24 hours)
3. **Input validation** is performed on all endpoints
4. **SQL injection protection** via SQLAlchemy ORM
5. **XSS protection** via React and Content Security Policy

### File Upload Security

1. **File type validation** is enforced
2. **File size limits** are configured (default: 100MB)
3. **Uploaded files** are stored outside web root
4. **File permissions** are restricted

### Known Security Considerations

1. **AI Model Files**
   - YOLO and SAM2 models are downloaded from Ultralytics
   - Models are verified by checksums
   - Models are cached locally to prevent repeated downloads

2. **WebSocket Connections**
   - WebSocket connections require authentication
   - Connection limits are enforced
   - Idle connections are terminated

3. **Image Processing**
   - Images are processed server-side to prevent malicious files
   - PIL/OpenCV handle image validation
   - Malformed images are rejected

## Security Updates

Security updates will be released as soon as possible after a vulnerability is confirmed. Updates will be announced via:

- GitHub Security Advisories
- Release notes
- Project documentation

## Vulnerability Disclosure Process

1. **Report received** - We acknowledge the report
2. **Triage** - We verify and assess the severity
3. **Fix development** - We develop and test a fix
4. **Release** - We release a patched version
5. **Disclosure** - We publicly disclose the vulnerability after users have had time to update

## Security Hall of Fame

We recognize security researchers who responsibly disclose vulnerabilities:

<!-- Contributors who report security issues will be listed here -->

## Contact

For security-related questions or concerns:
- GitHub Security Advisories: https://github.com/webrlabs/annotateforge/security/advisories/new
- Project maintainer: [@webrlabs](https://github.com/webrlabs)

---

Thank you for helping keep AnnotateForge and its users safe!
