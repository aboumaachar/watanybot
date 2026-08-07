// PM2 Ecosystem Configuration for WatanyBot FastAPI Backend
// Usage (on production server from /home/koudama/):
//   pm2 start apps/api-backend/ecosystem.config.cjs --env production
//   pm2 save
//   pm2 startup   # to persist across reboots

module.exports = {
  apps: [
    {
      name: 'watanybot-fastapi',
      // Runs uvicorn on the locked port 8012
      script: 'uvicorn',
      args: 'apps.api.main:app --host 127.0.0.1 --port 8012 --workers 4',
      interpreter: 'python3',

      // Working directory — adjust to actual deploy path on server
      cwd: '/home/koudama/apps/api-backend',

      // Instances & mode
      instances: 1,
      exec_mode: 'fork',

      // Logging
      error_file: '/home/koudama/logs/fastapi-error.log',
      out_file: '/home/koudama/logs/fastapi-output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Restart policy
      max_restarts: 10,
      min_uptime: '15s',
      restart_delay: 5000,
      autorestart: true,

      // Memory limit
      max_memory_restart: '512M',

      watch: false,

      // Environment — production
      env_production: {
        NODE_ENV: 'production',
        FASTAPI_PORT: '8012',
        FASTAPI_HOST: '127.0.0.1',
      },
    },
  ],
};
