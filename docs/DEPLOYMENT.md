# Deployment & Production Operations — BenchPulse

**Target:** HTTP Load Tester, Microsecond Percentile Engine & Bento Grid Studio  
**Author:** Jatin Sharma ([https://jatinsh.netlify.app/](https://jatinsh.netlify.app/))

---

## 1. Container Deployment (Docker)

```bash
docker build -t benchpulse:latest .
docker run -d -p 6363:6363 --name benchpulse benchpulse:latest
```

## 2. Process Manager (PM2)

```bash
npm install -g pm2
pm2 start dist/bin.js --name "benchpulse" -- studio --port 6363
```

## 3. Systemd Service Unit

```ini
[Unit]
Description=BenchPulse Background Service
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/opt/benchpulse
ExecStart=/usr/bin/node dist/bin.js studio --port 6363
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
