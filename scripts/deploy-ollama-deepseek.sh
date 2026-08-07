#!/bin/bash
# Quick Deployment Script for Watany Chatbot on 54.39.157.227
# This script automates the entire setup process

set -e

REMOTE_HOST="root@54.39.157.227"
DEPLOY_PATH="/home/koudama/public_html/mcp"
OLLAMA_MODEL="deepseek-coder:33b-instruct-q4_K_M"  # Quantized for faster startup

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==============================================================================
# STEP 1: Upload Optimization Scripts
# ==============================================================================
log_info "Step 1: Uploading optimization scripts..."

scp scripts/server-optimize-ollama-deepseek.sh $REMOTE_HOST:/tmp/
scp scripts/.env.ollama-deepseek $REMOTE_HOST:/tmp/

log_info "✓ Scripts uploaded"

# ==============================================================================
# STEP 2: Run System Optimization
# ==============================================================================
log_info "Step 2: Running system optimization..."

ssh $REMOTE_HOST <<'SSHCMD'
chmod +x /tmp/server-optimize-ollama-deepseek.sh
/tmp/server-optimize-ollama-deepseek.sh
SSHCMD

log_info "✓ System optimized"

# ==============================================================================
# STEP 3: Install Ollama
# ==============================================================================
log_info "Step 3: Installing Ollama..."

ssh $REMOTE_HOST <<'SSHCMD'
# Check if already installed
if ! command -v ollama &> /dev/null; then
    curl https://ollama.ai/install.sh | sh
    log "✓ Ollama installed"
else
    echo "Ollama already installed"
fi

# Start service
systemctl enable ollama
systemctl start ollama
sleep 5

# Verify
systemctl status ollama || true
SSHCMD

log_info "✓ Ollama installed"

# ==============================================================================
# STEP 4: Pull Deepseek Model
# ==============================================================================
log_info "Step 4: Pulling Deepseek model (this may take 5-10 minutes)..."

ssh $REMOTE_HOST <<SSHCMD
echo "Pulling Deepseek model..."
ollama pull $OLLAMA_MODEL

echo "Model ready! Available models:"
ollama list
SSHCMD

log_info "✓ Deepseek model ready"

# ==============================================================================
# STEP 5: Deploy Watany Chatbot
# ==============================================================================
log_info "Step 5: Deploying Watany Chatbot..."

ssh $REMOTE_HOST <<SSHCMD
mkdir -p $DEPLOY_PATH
cd $DEPLOY_PATH

# Clone or verify deployment
if [ ! -f package.json ]; then
    log_warn "⚠ Watany not found at $DEPLOY_PATH"
    log_warn "Please upload Watany files to: $DEPLOY_PATH"
else
    # Install dependencies
    npm install --production
    
    # Build if needed
    if [ -f vite.config.ts ]; then
        npm run build
    fi
    
    # Setup PM2
    npm install -g pm2
    pm2 start npm --name "watany-chatbot" -- start || true
    pm2 startup
    pm2 save
fi
SSHCMD

log_info "✓ Watany Chatbot deployment prepared"

# ==============================================================================
# STEP 6: Verification
# ==============================================================================
log_info "Step 6: Verifying deployment..."

ssh $REMOTE_HOST <<'SSHCMD'
echo "Verifying services..."

# Check Ollama
echo -n "Ollama API... "
curl -s http://127.0.0.1:11434/api/tags > /dev/null && echo "✓" || echo "✗"

# Check Ollama model
echo -n "Ollama model inference... "
curl -s -X POST http://127.0.0.1:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"'$OLLAMA_MODEL'","prompt":"test","stream":false}' \
  | grep -q "response" && echo "✓" || echo "✗"

# Check system limits
echo ""
echo "System Configuration:"
echo "  File descriptors: $(ulimit -n)"
echo "  Memory: $(free -h | grep Mem | awk '{print $2}')"
echo "  CPU cores: $(nproc)"
echo "  Swap: $(free -h | grep Swap | awk '{print $2}')"

echo ""
echo "Service Status:"
systemctl status ollama --no-pager | head -5
SSHCMD

log_info "✓ Verification complete"

# ==============================================================================
# SUMMARY
# ==============================================================================
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Deployment Summary:"
echo "  Server: $REMOTE_HOST"
echo "  Location: $DEPLOY_PATH"
echo "  Ollama Model: $OLLAMA_MODEL"
echo ""
echo "Service Endpoints:"
echo "  Ollama: http://54.39.157.227:11434"
echo "  Nginx Proxy: http://54.39.157.227:9090"
echo ""
echo "Next Steps:"
echo "  1. Upload Watany application to: /home/koudama/public_html/mcp/"
echo "  2. Run: npm install && npm run build"
echo "  3. Start: pm2 start npm -- start"
echo "  4. Configure SSL certificate for production"
echo "  5. Test endpoints: curl http://54.39.157.227:9090/api/ollama/tags"
echo ""
echo "Documentation: See DEPLOYMENT_OLLAMA_DEEPSEEK.md"
echo ""
