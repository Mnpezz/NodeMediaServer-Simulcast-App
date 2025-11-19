# NodeMediaServer Multi-Platform Relay

A simple, powerful RTMP relay server that simultaneously streams to multiple platforms (Twitch, YouTube, Rumble, Kick, and more) from a single input stream.

## Features

- ✅ Stream to multiple platforms simultaneously
- ✅ Automatic reconnection on failures
- ✅ Watchdog monitoring for stalled connections
- ✅ Detailed logging per destination
- ✅ Easy platform enable/disable
- ✅ Graceful shutdown handling
- ✅ PM2 process management support

## Prerequisites

- Node.js (v14 or higher)
- FFmpeg installed (`sudo apt install ffmpeg` on Ubuntu/Debian)
- PM2 for process management (optional but recommended)

## Installation

```bash
# Install dependencies
npm install node-media-server

# Install PM2 (optional)
npm install -g pm2
```

## Configuration

Edit `app.js` and update the `destinations` array with your stream keys:

```javascript
const destinations = [
  {
    name: 'Twitch',
    enabled: true,
    url: 'rtmp://live.twitch.tv/app/YOUR_TWITCH_STREAM_KEY'
  },
  {
    name: 'YouTube',
    enabled: true,
    url: 'rtmp://a.rtmp.youtube.com/live2/YOUR_YOUTUBE_STREAM_KEY'
  },
  // Add more as needed...
];
```

### Configuration Options

Each destination supports these options:

- `name` - Display name for logging
- `enabled` - Set to `false` to disable a destination
- `url` - Full RTMP/RTMPS URL with stream key
- `autoReconnect` - Auto-reconnect on disconnect (optional)
- `watchdog` - Monitor for stalls and restart (optional, default: true)

## Usage

### Running with PM2 (Recommended)

```bash
# Start the server
pm2 start app.js --name nms

# Save configuration
pm2 save

# Setup auto-start on boot
pm2 startup

# View logs
pm2 logs nms

# Stop the server
pm2 stop nms
```

### Running with Node

```bash
node app.js
```

### Streaming to the Server

Point your streaming software (OBS, Streamlabs, etc.) to:

**Server:** `rtmp://YOUR_SERVER_IP:1935/live`  
**Stream Key:** `YOUR_STREAM_KEY` (can be anything, e.g., "test123")

Example OBS settings:
- Service: Custom
- Server: `rtmp://45.55.54.155:1935/live`
- Stream Key: `mystream`

## Logs

All FFmpeg logs are saved to the `logs/` directory:

- `logs/live__STREAMKEY--PlatformName.err.log` - FFmpeg error output
- `logs/live__STREAMKEY--PlatformName.out.log` - FFmpeg standard output

View logs in real-time:
```bash
tail -f logs/*.err.log
```

## Adding New Platforms

To add a new streaming platform:

1. Find their RTMP ingest URL and get your stream key
2. Add to the `destinations` array:

```javascript
{
  name: 'Facebook',
  enabled: true,
  url: 'rtmps://live-api-s.facebook.com:443/rtmp/YOUR_FB_KEY'
}
```

Common platforms:
- **Twitch**: `rtmp://live.twitch.tv/app/STREAM_KEY`
- **YouTube**: `rtmp://a.rtmp.youtube.com/live2/STREAM_KEY`
- **Facebook**: `rtmps://live-api-s.facebook.com:443/rtmp/STREAM_KEY`
- **Kick**: `rtmps://fa723fc1b171.global-contribute.live-video.net/live/STREAM_KEY`
- **Rumble**: `rtmp://rtmp.rumble.com/live/STREAM_KEY`

## Troubleshooting

### Stream not starting
- Check FFmpeg is installed: `ffmpeg -version`
- Verify stream keys are correct
- Check logs: `pm2 logs nms` or `tail -f logs/*.err.log`

### Platform disconnecting
- Check the platform's logs for specific errors
- Verify your stream key hasn't expired
- Some platforms have bitrate/resolution limits

### Poor performance
- Ensure your server has sufficient CPU and bandwidth
- Check network connectivity to each platform
- Disable problematic platforms by setting `enabled: false`

## Performance Notes

- **CPU Usage**: Uses very little CPU since streams are copied, not re-encoded
- **Bandwidth**: Upload bandwidth = (your bitrate) × (number of enabled platforms)
- **Latency**: Adds minimal latency (~1-2 seconds) to enable multi-platform distribution

## Known Issues

- Some platforms (like Zap.stream) may have infrastructure issues causing extremely slow processing
- If a platform consistently fails, disable it with `enabled: false`

## Credits

Built with [Node-Media-Server](https://github.com/illuspas/Node-Media-Server) by illuspas.

## License

MIT License - Feel free to use and modify for your needs.
