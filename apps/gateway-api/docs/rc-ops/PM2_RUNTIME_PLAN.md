# PM2_RUNTIME_PLAN.md

Date: 2026-05-12T17:45:30

## Generated

- ecosystem.watany.config.cjs

## Commands (run on server)

\\\ash
pm2 startOrReload ecosystem.watany.config.cjs --env production
pm2 status
pm2 logs watany-gateway-api
pm2 restart watany-gateway-api
\\\

See summary table for status.
