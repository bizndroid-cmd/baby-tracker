#!/bin/bash
set -e

# Install Node.js 18
dnf install -y nodejs git

# Clone app
cd /home/ec2-user
git clone https://github.com/bizndroid-cmd/baby-tracker.git
cd baby-tracker

# Install deps
npm install
cd client && npm install && npm run build && cd ..

# Create data dir
mkdir -p data

# Create systemd service
cat > /etc/systemd/system/baby-tracker.service << 'EOF'
[Unit]
Description=Baby Tracker App
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/baby-tracker
Environment=NODE_ENV=production
Environment=PORT=80
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Fix permissions
chown -R ec2-user:ec2-user /home/ec2-user/baby-tracker

# Allow Node to bind port 80
setcap 'cap_net_bind_service=+ep' /usr/bin/node

# Start service
systemctl daemon-reload
systemctl enable baby-tracker
systemctl start baby-tracker
