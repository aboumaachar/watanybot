// PM2 Ecosystem Configuration for WatanyBot Gateway API
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 start ecosystem.config.cjs --env production

module.exports = {
  apps: [
    {
      name: 'watany-gateway',
      script: './start.sh',
      interpreter: '/bin/bash',
      cwd: __dirname,

      // Instances & mode
      instances: 1,
      exec_mode: 'fork',

      // Logging
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      autorestart: true,

      // Memory limit (restart if exceeded)
      max_memory_restart: '512M',

      // Watch (disabled in production; enable for dev)
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],

      // Environment
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        OTP_PROVIDER: 'whatsapp',
        WHATSAPP_OUTBOUND_MODE: 'live',
        WHATSAPP_ACCOUNT_NUMBER: '+96181396332',
      },
    },
  ],
};
