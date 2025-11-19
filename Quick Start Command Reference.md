# Quick Start Command Reference

Copy and paste these command blocks to quickly set up your streaming relay server.

## Complete Setup (Copy/Paste All)

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs

# Install FFmpeg
apt install -y ffmpeg

# Install PM2
npm install -g pm2

# Create project directory
mkdir /var/nms
cd /var/nms

# Install NodeMediaServer
npm install node-media-server

# Configure firewall
ufw allow 1935/tcp
ufw allow 22/tcp
ufw enable

echo "Setup complete! Now edit app.js with your stream keys."
```

## Create and Start Server

```bash
# Create app.js
cd /var/nms
nano app.js
# (Paste the app.js code, add your stream keys, save with CTRL+O, exit with CTRL+X)

# Start with PM2
pm2 start app.js --name nms
pm2 startup
pm2 save
pm2 logs nms
```

## Common Commands

### Managing Server
```bash
pm2 start nms       # Start server
pm2 stop nms        # Stop server
pm2 restart nms     # Restart server
pm2 delete nms      # Remove from PM2
pm2 logs nms        # View logs
pm2 monit           # Real-time monitoring
```

### Editing Configuration
```bash
nano /var/nms/app.js
pm2 restart nms
```

### Viewing Logs
```bash
# PM2 logs
pm2 logs nms

# Platform-specific logs
cd /var/nms/logs
ls -lh
tail -f live__*--Twitch.err.log
tail -f logs/*.err.log  # All error logs
```

### System Management
```bash
# Update system
apt update && apt upgrade -y

# Update npm packages
cd /var/nms && npm update

# Check disk space
df -h

# Check memory usage
free -h

# Check running processes
htop
```

## OBS Quick Setup

```
Service: Custom
Server: rtmp://YOUR_DROPLET_IP:1935/live
Stream Key: mystream
```

## Testing Commands

### Test Server is Running
```bash
pm2 status
curl http://localhost:8000/api/server
```

### Test RTMP Locally
```bash
# Install RTMP test tools
apt install -y rtmpdump

# Test stream
ffmpeg -re -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
       -f lavfi -i sine=frequency=1000:duration=10 \
       -c:v libx264 -preset veryfast -b:v 1000k \
       -c:a aac -b:a 128k \
       -f flv rtmp://127.0.0.1:1935/live/test
```

## Troubleshooting Commands

### Check if FFmpeg is installed
```bash
ffmpeg -version
```

### Check if ports are open
```bash
netstat -tuln | grep 1935
ufw status
```

### Check PM2 status
```bash
pm2 status
pm2 info nms
```

### View system resources
```bash
top
htop  # More user-friendly (install with: apt install htop)
```

### Check logs for errors
```bash
pm2 logs nms --err --lines 100
```

### Kill stuck FFmpeg processes
```bash
killall ffmpeg
pm2 restart nms
```

## Backup Commands

### Backup Configuration
```bash
cp /var/nms/app.js ~/app.js.backup.$(date +%Y%m%d)
```

### Download to Local Machine
```bash
# Run this on your LOCAL computer (not the server)
scp root@YOUR_DROPLET_IP:/var/nms/app.js ~/Desktop/app.js.backup
```

## Security Commands

### Change SSH Port (Optional)
```bash
nano /etc/ssh/sshd_config
# Change "Port 22" to "Port 2222"
systemctl restart sshd
# Don't forget to update firewall: ufw allow 2222/tcp
```

### Create Non-Root User (Recommended)
```bash
adduser streamer
usermod -aG sudo streamer
# Login as new user: su - streamer
```

## One-Liner Status Check

```bash
echo "=== Server Status ===" && pm2 status && echo -e "\n=== Active Connections ===" && netstat -an | grep :1935 | grep ESTABLISHED && echo -e "\n=== Recent Logs ===" && pm2 logs nms --lines 10 --nostream
```

## Emergency Reset

If something goes wrong and you need to start fresh:

```bash
# Stop and remove PM2 process
pm2 delete nms

# Remove project directory
rm -rf /var/nms

# Start over from "Create project directory" section
mkdir /var/nms
cd /var/nms
npm install node-media-server
# ... etc
```
