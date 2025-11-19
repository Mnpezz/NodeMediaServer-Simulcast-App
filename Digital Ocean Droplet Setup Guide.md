# Digital Ocean Droplet Setup Guide

Complete step-by-step guide to set up a multi-platform streaming relay server on Digital Ocean.

## Prerequisites

- Digital Ocean account
- Stream keys from your platforms (Twitch, YouTube, etc.)
- OBS or other streaming software

## Part 1: Create and Configure Droplet

### Step 1: Create Droplet

1. Log into Digital Ocean
2. Click **Create** → **Droplets**
3. Choose settings:
   - **Image**: Ubuntu 22.04 (LTS) x64
   - **Plan**: Basic
   - **CPU Options**: Regular - $6/month (1GB RAM, 1 vCPU) is sufficient for most streams
     - For higher bitrate streams (>3000 kbps) or more platforms, consider $12/month (2GB RAM)
   - **Datacenter Region**: Choose closest to you for lowest latency
   - **Authentication**: SSH key (recommended) or Password
   - **Hostname**: Something memorable like "stream-relay"
4. Click **Create Droplet**
5. Wait ~60 seconds for droplet to be created

### Step 2: Connect to Droplet

**Option A: Using Digital Ocean Console (Easiest)**
1. Click on your droplet name
2. Click **Console** button (top right)
3. You're now logged in as root

**Option B: Using SSH from your computer**
```bash
ssh root@YOUR_DROPLET_IP
```

## Part 2: Install Required Software

### Step 1: Update System
```bash
apt update && apt upgrade -y
```

### Step 2: Install Node.js (LTS)
```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -

# Install Node.js
apt install -y nodejs

# Verify installation
node -v
npm -v
```

You should see version numbers (e.g., v20.x.x for Node, 10.x.x for npm).

### Step 3: Install FFmpeg
```bash
apt install -y ffmpeg

# Verify installation
ffmpeg -version
```

### Step 4: Install PM2 (Process Manager)
```bash
npm install -g pm2
```

## Part 3: Set Up NodeMediaServer

### Step 1: Create Project Directory
```bash
mkdir /var/nms
cd /var/nms
```

### Step 2: Install NodeMediaServer
```bash
npm install node-media-server
```

### Step 3: Create Server File
```bash
nano app.js
```

Paste the complete `app.js` code (see the app.js artifact), then:
- Press `CTRL + O` to save
- Press `Enter` to confirm filename
- Press `CTRL + X` to exit

### Step 4: Configure Your Stream Keys

Edit the destinations section in app.js:
```bash
nano app.js
```

Find this section and replace with your actual stream keys:
```javascript
const destinations = [
  {
    name: 'Twitch',
    enabled: true,
    url: 'rtmp://live.twitch.tv/app/YOUR_ACTUAL_TWITCH_KEY'
  },
  // ... etc
];
```

Save and exit (`CTRL + O`, `Enter`, `CTRL + X`).

### Step 5: Test the Server
```bash
node app.js
```

You should see:
```
[INFO] NodeMediaServer Multi-Platform Relay started
[INFO] RTMP input: rtmp://YOUR_SERVER_IP:1935/live/YOUR_STREAM_KEY
[INFO] Enabled destinations: Twitch, YouTube, Rumble, Kick
```

Press `CTRL + C` to stop the test.

### Step 6: Run with PM2 (Permanent)
```bash
# Start the server
pm2 start app.js --name nms

# Enable auto-start on reboot
pm2 startup
pm2 save

# View logs
pm2 logs nms
```

## Part 4: Configure Firewall

Allow RTMP traffic:
```bash
# Allow RTMP port
ufw allow 1935/tcp

# Allow SSH (if not already allowed)
ufw allow 22/tcp

# Enable firewall
ufw enable
```

## Part 5: Configure OBS

1. Open OBS
2. Go to **Settings** → **Stream**
3. Set:
   - **Service**: Custom
   - **Server**: `rtmp://YOUR_DROPLET_IP:1935/live`
   - **Stream Key**: Anything you want (e.g., `mystream`, `test123`)
4. Click **OK**
5. Click **Start Streaming**

Your stream should now be relaying to all enabled platforms!

## Monitoring and Management

### View Logs
```bash
# View PM2 logs
pm2 logs nms

# View specific platform logs
cd /var/nms/logs
tail -f live__YOUR_STREAM_KEY--Twitch.err.log
```

### Restart Server
```bash
pm2 restart nms
```

### Stop Server
```bash
pm2 stop nms
```

### Update Configuration
```bash
nano /var/nms/app.js
pm2 restart nms
```

### Check Server Status
```bash
pm2 status
pm2 monit  # Real-time monitoring
```

## Troubleshooting

### Can't connect from OBS
- Verify firewall is allowing port 1935: `ufw status`
- Check server is running: `pm2 status`
- Test locally: `ffmpeg -re -i test.mp4 -c copy -f flv rtmp://127.0.0.1:1935/live/test`

### Stream not reaching platforms
- Check logs: `pm2 logs nms`
- Verify stream keys are correct
- Check platform-specific logs in `/var/nms/logs/`

### High CPU usage
- Check you're using `-c:v copy -c:a copy` (no re-encoding)
- Consider upgrading to a larger droplet
- Disable problematic platforms

### Out of memory
- Upgrade to larger droplet (2GB+ RAM recommended)
- Check for FFmpeg memory leaks: `pm2 monit`

## Bandwidth Considerations

Your droplet needs upload bandwidth for:
- **Upload per platform** = Your stream bitrate
- **Total upload** = Bitrate × Number of enabled platforms

Example with 3000 kbps stream to 4 platforms:
- Total upload needed: 3000 × 4 = 12,000 kbps (12 Mbps)

Most Digital Ocean droplets have 1-2 TB/month bandwidth, which is typically sufficient.

## Cost Estimate

- **Droplet**: $6-12/month
- **Bandwidth**: Usually included (1-2 TB/month)
- **Total**: ~$6-12/month for unlimited multi-platform streaming

## Security Best Practices

1. **Change default SSH port** (optional):
```bash
nano /etc/ssh/sshd_config
# Change Port 22 to another number
systemctl restart sshd
```

2. **Add authentication to RTMP** (optional):
Edit `app.js` and add auth configuration (see NodeMediaServer docs).

3. **Use SSH keys** instead of passwords

4. **Keep system updated**:
```bash
apt update && apt upgrade -y
```

## Upgrading

### Update Node packages
```bash
cd /var/nms
npm update
pm2 restart nms
```

### Update system packages
```bash
apt update && apt upgrade -y
```

## Backing Up

Save your configuration:
```bash
# Backup app.js
cp /var/nms/app.js ~/app.js.backup

# Or download to your computer
scp root@YOUR_DROPLET_IP:/var/nms/app.js ~/Desktop/
```

## Additional Resources

- [Digital Ocean Tutorials](https://www.digitalocean.com/community/tutorials)
- [NodeMediaServer Documentation](https://github.com/illuspas/Node-Media-Server)
- [OBS Studio](https://obsproject.com/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)

## Support

If you encounter issues:
1. Check logs: `pm2 logs nms`
2. Check platform-specific logs in `/var/nms/logs/`
3. Verify FFmpeg is working: `ffmpeg -version`
4. Test local connection: `ffmpeg -re -i test.mp4 -c copy -f flv rtmp://127.0.0.1:1935/live/test`
