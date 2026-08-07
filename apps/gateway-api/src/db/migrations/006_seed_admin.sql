-- 006_seed_admin.sql — Create a test admin user for development

-- Password: admin123 (bcrypt hash)
INSERT INTO users (email, password_hash, name, role, status)
VALUES (
  'admin@watany.test',
  '$2b$10$Vvfu0NLlqD6tDiC/8WCY0Oaipd1npkCm1JkA6Uchsf8LFMcX124o.',
  'Test Admin',
  'superadmin',
  'active'
)
ON CONFLICT (email) DO NOTHING;
