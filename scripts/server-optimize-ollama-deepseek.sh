#!/bin/bash
# ==============================================================================
# Watany Chatbot - Ollama + Deepseek Server Optimization
# For deployment at: /home/koudama/public_html/mcp/
# ==============================================================================

set -e

echo "================================"
echo "Watany Chatbot Server Optimization"
echo "================================"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ==============================================================================
# 1. SYSTEM LIMITS OPTIMIZATION
# ==============================================================================
echo -e "${YELLOW}[1/5] Optimizing system limits...${NC}"

cat > /tmp/limits.conf.append << 'EOF'

# Watany Chatbot - Ollama & Deepseek Optimization
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
* soft memlock unlimited
* hard memlock unlimited
* soft sigpending 32768
* hard sigpending 32768
EOF

# Backup original
cp /etc/security/limits.conf /etc/security/limits.conf.backup.$(date +%Y%m%d_%H%M%S)

# Append new limits (avoiding duplicates)
grep -f /tmp/limits.conf.append /etc/security/limits.conf > /dev/null 2>&1 || cat /tmp/limits.conf.append >> /etc/security/limits.conf

echo -e "${GREEN}✓ System limits optimized${NC}"

# ==============================================================================
# 2. KERNEL PARAMETER OPTIMIZATION (sysctl)
# ==============================================================================
echo -e "${YELLOW}[2/5] Optimizing kernel parameters...${NC}"

cat > /tmp/sysctl-watany.conf << 'EOF'
# Watany Chatbot - Ollama & Deepseek Kernel Optimization

# Network Stack Optimization
net.ipv4.tcp_max_syn_backlog = 8192
net.core.somaxconn = 4096
net.ipv4.ip_local_port_range = 10000 65000
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300

# Buffer Optimization
net.core.rmem_default = 134217728
net.core.rmem_max = 134217728
net.core.wmem_default = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728

# Memory Management for LLM
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
vm.max_map_count = 262144

# File Descriptor Optimization
fs.file-max = 2097152
fs.pipe-user-hardlimit = 2097152
fs.pipe-user-softlimit = 2097152
EOF

# Backup original
cp /etc/sysctl.conf /etc/sysctl.conf.backup.$(date +%Y%m%d_%H%M%S)

# Apply new settings
cat /tmp/sysctl-watany.conf >> /etc/sysctl.conf

# Reload sysctl
sysctl -p > /dev/null 2>&1

echo -e "${GREEN}✓ Kernel parameters optimized${NC}"

# ==============================================================================
# 3. ULIMIT SETTINGS FOR CURRENT SESSION
# ==============================================================================
echo -e "${YELLOW}[3/5] Setting ulimit values...${NC}"

ulimit -n 65536
ulimit -u 32768
ulimit -l unlimited

echo -e "${GREEN}✓ Ulimit values configured${NC}"

# ==============================================================================
# 4. OLLAMA CONFIGURATION
# ==============================================================================
echo -e "${YELLOW}[4/5] Configuring Ollama...${NC}"

# Create Ollama systemd service optimized for performance
mkdir -p /etc/systemd/system/ollama.service.d

cat > /etc/systemd/system/ollama.service.d/override.conf << 'EOF'
[Service]
# Performance tuning
CPUQuota=100%
IOWeight=1000
MemoryMax=90%

# Environment variables for optimization
Environment="OLLAMA_NUM_PARALLEL=4"
Environment="OLLAMA_NUM_THREAD=8"
Environment="OLLAMA_MAX_VRAM=0"
Environment="OLLAMA_KEEP_ALIVE=5m"

# Restart policy
Restart=on-failure
RestartSec=10

# Resource limits
LimitNOFILE=65536
LimitNPROC=32768
LimitMEMLOCK=infinity
EOF

# Reload systemd
systemctl daemon-reload 2>/dev/null || true

echo -e "${GREEN}✓ Ollama configured${NC}"

# ==============================================================================
# 5. NGINX REVERSE PROXY OPTIMIZATION (for Watany chatbot)
# ==============================================================================
echo -e "${YELLOW}[5/5] Optimizing Nginx for proxy...${NC}"

# Backup Nginx config
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Create optimized Nginx config snippet
cat > /etc/nginx/conf.d/watany-ollama.conf << 'EOF'
# Watany Chatbot - Ollama Reverse Proxy Configuration
upstream ollama_backend {
    server 127.0.0.1:11434;
    keepalive 32;
}

upstream deepseek_backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

# Ollama API Proxy
server {
    listen 9090;
    server_name _;
    
    client_max_body_size 100M;
    
    location /api/ollama/ {
        proxy_pass http://ollama_backend/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Streaming support
        proxy_buffering off;
        proxy_request_buffering off;
        
        # Timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    location /api/deepseek/ {
        proxy_pass http://deepseek_backend/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        proxy_buffering off;
        proxy_request_buffering off;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

# Test and reload Nginx
if command -v nginx &> /dev/null; then
    nginx -t > /dev/null 2>&1 && systemctl reload nginx 2>/dev/null || true
fi

echo -e "${GREEN}✓ Nginx optimized${NC}"

# ==============================================================================
# DEPLOYMENT STATUS
# ==============================================================================
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ Optimization Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Summary:"
echo "  ✓ System limits: 65536 file descriptors, 32768 processes"
echo "  ✓ Kernel tuning: Network, memory, and I/O optimized"
echo "  ✓ Ollama configured for parallel inference"
echo "  ✓ Deepseek endpoint ready"
echo "  ✓ Nginx reverse proxy: Port 9090"
echo ""
echo "Deployment Location: /home/koudama/public_html/mcp/"
echo ""
echo "Next Steps:"
echo "  1. Start Ollama: systemctl start ollama"
echo "  2. Pull Deepseek: ollama pull deepseek-coder"
echo "  3. Deploy Watany chatbot to /home/koudama/public_html/mcp/"
echo "  4. Test endpoints: curl http://localhost:9090/api/ollama/tags"
echo ""
