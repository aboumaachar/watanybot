# NGINX_PRODUCTION_CONFIG.md

Date: 2026-05-12T17:45:30

## Generated

- ops/nginx/watany.nginx.conf

## Required server validation

\\\ash
sudo cp ops/nginx/watany.nginx.conf /etc/nginx/sites-available/watany
sudo ln -s /etc/nginx/sites-available/watany /etc/nginx/sites-enabled/watany
sudo nginx -t
sudo systemctl reload nginx
curl -I https://koudama.com/health
\\\

## Must verify behind proxy

- home
- chat
- admin protected routes
- document preview
- document download
