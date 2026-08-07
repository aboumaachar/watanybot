# Security Guide

Security best practices for deploying and operating WatanBot in production.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Data Protection](#data-protection)
3. [Network Security](#network-security)
4. [Secrets Management](#secrets-management)
5. [Audit & Compliance](#audit--compliance)
6. [Incident Response](#incident-response)

## Authentication & Authorization

### JWT Token Security

**Token Configuration:**
```bash
# Generate strong secret (32+ bytes)
JWT_SECRET=$(openssl rand -hex 32)

# Set appropriate expiration
JWT_EXPIRES_MINUTES=60  # 1 hour for production
```

**Best Practices:**
- ✅ Rotate JWT_SECRET every 90 days
- ✅ Use short token lifetimes (60-120 minutes)
- ✅ Implement token refresh mechanism
- ✅ Invalidate tokens on logout (track revoked tokens)
- ❌ Never expose JWT_SECRET in logs or error messages

### Role-Based Access Control (RBAC)

**Roles:**
1. **Public (unauthenticated)**
   - `/health`
   - `/kb/search`
   - `/kb/card/{id}`
   - `/chat/ask`

2. **Admin**
   - All public endpoints
   - `/admin/*` endpoints
   - Cannot access `/superadmin/*`

3. **Superadmin**
   - All endpoints including:
   - `/superadmin/doctor`
   - `/superadmin/backup`
   - `/superadmin/metrics`
   - `/superadmin/audit`

**Implementation:**
```python
# Enforce in code
@router.get("/admin/kb/cards")
async def list_kb_cards(current_user: User = Depends(require_admin)):
    # Only admin and superadmin can access
    ...

@router.get("/superadmin/doctor")
async def doctor(current_user: User = Depends(require_superadmin)):
    # Only superadmin can access
    ...
```

### Password Security

**Requirements:**
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Not in common password lists
- Different from previous passwords

**Storage:**
- Passwords hashed with bcrypt (cost factor 12)
- Never store plaintext
- Never log passwords

**Initial Setup:**
```bash
# Change default password immediately
1. Login with default credentials
2. Navigate to Profile/Settings
3. Change password
4. Logout and login with new password
```

## Data Protection

### Database Security

**Connection:**
```bash
# Use SSL/TLS for database connections in production
POSTGRES_SSL=require

# Restrict database access by IP
# Configure PostgreSQL pg_hba.conf:
host    watanbot    watanbot    10.0.0.0/8    md5
```

**Encryption:**
- ✅ Database encryption at rest (EBS encryption, RDS encryption)
- ✅ Backup encryption (encrypt backup files before off-site storage)
- ✅ TLS for data in transit

**Access Control:**
```sql
-- Principle of least privilege
-- API user should NOT be a superuser
CREATE USER watanbot_api WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE watanbot TO watanbot_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO watanbot_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO watanbot_api;
```

### Sensitive Data

**PII Handling:**
- Chat logs may contain user information
- Implement data retention policy (default 180 days)
- Anonymize data when possible
- Comply with GDPR/local regulations

**Data Minimization:**
```python
# Only log necessary information
logger.info("user_login", user_id=user.id)  # ✅ Good
logger.info("user_login", user=user)        # ❌ Bad (logs all fields)
```

## Network Security

### HTTPS/TLS

**Production Requirements:**
- ✅ HTTPS only (no HTTP)
- ✅ TLS 1.2 or 1.3
- ✅ Valid SSL certificate (Let's Encrypt, commercial CA)
- ❌ No self-signed certificates in production

**Nginx Configuration Example:**
```nginx
server {
    listen 443 ssl http2;
    server_name api.municipality.gov;
    
    ssl_certificate /etc/letsencrypt/live/api.municipality.gov/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.municipality.gov/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    
    # Redirect API requests
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.municipality.gov;
    return 301 https://$server_name$request_uri;
}
```

### CORS Configuration

**Strict CORS:**
```bash
# Only allow specific origins
CORS_ORIGINS=https://admin.municipality.gov,https://portal.municipality.gov

# Never use * in production
# CORS_ORIGINS=*  ❌ NEVER DO THIS
```

### Rate Limiting

**API Level:**
```bash
# Adjust based on expected traffic
RATE_LIMIT_PER_MINUTE=60

# For distributed rate limiting
RATE_LIMIT_BACKEND=redis
RATE_LIMIT_REDIS_URL=redis://redis:6379/0

# For high-traffic endpoints, use external rate limiter
# (Redis + FastAPI-Limiter, AWS API Gateway, Cloudflare)
```

**Infrastructure Level:**
```nginx
# Nginx rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location / {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://localhost:8000;
}
```

### Firewall Rules

**Inbound:**
```bash
# Only expose necessary ports
- 443 (HTTPS) - from Internet
- 22 (SSH) - from management subnet only
- 5432 (PostgreSQL) - from API subnet only
```

**Outbound:**
```bash
# Restrict outbound if possible
- 443 (HTTPS) - for external API calls
- 53 (DNS)
- 123 (NTP)
```

## Secrets Management

### Environment Variables

**Never commit `.env` to git:**
```bash
# .gitignore
.env
.env.local
.env.*.local
```

**Use secret management service:**

**AWS Secrets Manager:**
```bash
# Store secret
aws secretsmanager create-secret \
  --name watanbot/jwt-secret \
  --secret-string "your-jwt-secret"

# Retrieve in deployment
JWT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id watanbot/jwt-secret \
  --query SecretString --output text)
```

**Azure Key Vault:**
```bash
# Store secret
az keyvault secret set \
  --vault-name watanbot-vault \
  --name jwt-secret \
  --value "your-jwt-secret"

# Retrieve in deployment
JWT_SECRET=$(az keyvault secret show \
  --vault-name watanbot-vault \
  --name jwt-secret \
  --query value -o tsv)
```

**Kubernetes Secrets:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: watanbot-secrets
type: Opaque
data:
  jwt-secret: <base64-encoded-secret>
  postgres-password: <base64-encoded-password>
```

### Secret Rotation

**Schedule:**
- JWT_SECRET: Every 90 days
- Database passwords: Every 180 days
- API keys: As recommended by provider

**Rotation Process:**
1. Generate new secret
2. Update in secret manager
3. Deploy new configuration
4. Restart services
5. Verify functionality
6. Remove old secret after grace period

## Audit & Compliance

### Audit Logging

**What to Log:**
- ✅ Authentication attempts (success/failure)
- ✅ Authorization failures
- ✅ Data modifications (create/update/delete)
- ✅ Privilege escalations
- ✅ Configuration changes
- ✅ Backup/restore operations

**What NOT to Log:**
- ❌ Passwords or tokens
- ❌ Full credit card numbers
- ❌ Personal identification numbers
- ❌ Sensitive user data

**Audit Log Access:**
```bash
# Superadmin only
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/superadmin/audit?limit=100"

# Filter by action
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/superadmin/audit?action=kb_card_delete"
```

### Compliance Requirements

**Data Retention:**
```bash
# Configure retention periods
RETENTION_DAYS_CHAT=180      # 6 months
RETENTION_DAYS_AUDIT=2555    # 7 years (for compliance)
```

**User Rights:**
- Right to access: Provide user data export
- Right to deletion: Implement data deletion workflow
- Right to portability: Export in standard format (JSON)

**Backups:**
- Retain backups for compliance period
- Encrypt backups at rest
- Test restore procedures quarterly

## Incident Response

### Security Incident Checklist

**Phase 1: Detection & Analysis**
1. Monitor audit logs for suspicious activity
2. Check for unusual API usage patterns
3. Review failed authentication attempts
4. Examine unexpected data changes

**Phase 2: Containment**
1. Isolate affected systems
2. Revoke compromised credentials
3. Block malicious IP addresses
4. Preserve evidence for investigation

**Phase 3: Eradication**
1. Remove malware/unauthorized access
2. Patch vulnerabilities
3. Update configurations
4. Rotate all secrets

**Phase 4: Recovery**
1. Restore from clean backup if needed
2. Verify system integrity
3. Monitor for re-infection
4. Document lessons learned

**Phase 5: Post-Incident**
1. Conduct post-mortem review
2. Update security procedures
3. Improve monitoring/alerting
4. Train team on findings

### Common Attack Vectors

**SQL Injection:**
- ✅ Protected: Using SQLAlchemy ORM with parameterized queries
- ✅ Never concatenate user input into SQL

**XSS (Cross-Site Scripting):**
- ✅ React escapes output by default
- ✅ Validate and sanitize KB card content

**CSRF (Cross-Site Request Forgery):**
- ✅ JWT tokens in Authorization header (not cookies)
- ✅ CORS restrictions

**Brute Force:**
- ✅ Rate limiting on login endpoint
- ✅ Account lockout after N failed attempts (implement if needed)

**DDoS:**
- ✅ Rate limiting
- ✅ Use CDN/DDoS protection (Cloudflare, AWS Shield)

### Monitoring & Alerting

**Security Alerts:**
```bash
# Alert on:
- Multiple failed login attempts (> 5 in 5 minutes)
- Access from unusual locations
- Privilege escalation attempts
- Unexpected database schema changes
- Backup failures
- Certificate expiration (< 30 days)
```

**Security Dashboard:**
```bash
# Key metrics to monitor:
- Failed authentication rate
- API error rate (5xx responses)
- Unusual traffic patterns
- Database query latency
- Disk usage (backup directory)
```

## Security Checklist

### Before Production

- [ ] Changed all default passwords
- [ ] Generated strong JWT_SECRET
- [ ] Configured HTTPS with valid certificate
- [ ] Restricted CORS to specific domains
- [ ] Enabled database encryption at rest
- [ ] Configured firewall rules
- [ ] Set up secrets management
- [ ] Configured audit logging
- [ ] Tested backup and restore
- [ ] Implemented rate limiting
- [ ] Reviewed and minimized exposed endpoints
- [ ] Configured log aggregation
- [ ] Set up monitoring and alerting
- [ ] Documented incident response plan
- [ ] Trained team on security procedures

### Ongoing

- [ ] Review audit logs weekly
- [ ] Rotate secrets quarterly
- [ ] Update dependencies monthly
- [ ] Conduct security assessments annually
- [ ] Test backups monthly
- [ ] Review access controls quarterly
- [ ] Update incident response plan annually

## Reporting Security Issues

**Internal:**
- Email: security@municipality.gov
- Escalation: CIO, CISO

**Response Time:**
- Critical: 4 hours
- High: 24 hours
- Medium: 7 days
- Low: 30 days

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Controls](https://www.cisecurity.org/controls/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
