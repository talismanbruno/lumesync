#!/bin/sh
set -eu

APP_DIR="${LUME_APP_DIR:-/home/ubuntu/lume-core}"
install -m 0755 "$APP_DIR/health-monitor.sh" /usr/local/bin/lume-health-monitor

cat >/etc/systemd/system/lume-health-monitor.service <<'EOF'
[Unit]
Description=Lume production health monitor
After=docker.service network-online.target

[Service]
Type=oneshot
Environment=LUME_APP_DIR=/home/ubuntu/lume-core
Environment=LUME_DOMAIN=lumesocial.online
EnvironmentFile=-/home/ubuntu/lume-core/.monitor.env
ExecStart=/usr/local/bin/lume-health-monitor
EOF

cat >/etc/systemd/system/lume-health-monitor.timer <<'EOF'
[Unit]
Description=Check Lume production every five minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
RandomizedDelaySec=30s
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now lume-health-monitor.timer
systemctl start lume-health-monitor.service || true
systemctl --no-pager status lume-health-monitor.timer
