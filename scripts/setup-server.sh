#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <deploy-path>"
  exit 1
fi

DEPLOY_PATH="$1"

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo mkdir -p "$DEPLOY_PATH"
sudo chown "$USER":"$USER" "$DEPLOY_PATH"

echo "Server setup complete."
echo "Next:"
echo "1. Copy .env.production.example to $DEPLOY_PATH/.env and fill it out."
echo "2. Make sure the GitHub Actions SSH key can access this server."
echo "3. Push to main to trigger deployment."
