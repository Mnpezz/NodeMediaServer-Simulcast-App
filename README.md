# NodeMediaServer Multi-Platform Relay

A simple, powerful RTMP relay server that simultaneously streams to multiple platforms (Twitch, YouTube, Rumble, Kick, and more) from a single input stream.

### **If you like this project you can send some encouragement.**

[Zap me ⚡](https://coinos.io/pay/mnpezz)


## Features

- ✅ Stream to multiple platforms simultaneously
- ✅ **HLS output with copy codecs (no re-encoding, low CPU usage)**
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
npm install

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

### HLS Output

The server automatically generates HLS streams for each active stream. HLS uses **copy codecs** (no re-encoding), keeping CPU usage very low.

**How it works:**
- HLS stream keys work exactly like RTMP - you use any stream key you want
- The HLS path is automatically derived from your RTMP stream path
- When you stream to `rtmp://server:1935/live/YOUR_KEY`, HLS is created at `http://server:8001/hls/live__YOUR_KEY/index.m3u8`

**HLS URL Format:**
```
http://YOUR_SERVER_IP:8001/hls/[STREAM_PATH]/index.m3u8
```
(Stream path has `/` replaced with `__`)

**Examples:**

When streaming with OBS settings:
- Server: `rtmp://server:1935/live`
- Stream Key: `mystream`

The full RTMP path is `/live/mystream`, which becomes HLS path `live__mystream`:

| OBS Settings | Full RTMP Path | HLS URL |
|-------------|---------------|---------|
| Server: `rtmp://server:1935/live`<br>Key: `mystream` | `/live/mystream` | `http://server:8001/hls/live__mystream/index.m3u8` |
| Server: `rtmp://server:1935/live`<br>Key: `test123` | `/live/test123` | `http://server:8001/hls/live__test123/index.m3u8` |
| Server: `rtmp://server:1935/app`<br>Key: `streamkey` | `/app/streamkey` | `http://server:8001/hls/app__streamkey/index.m3u8` |

**Note:** The format is `[APP_NAME]__[STREAM_KEY]` where `__` replaces the `/` in the full RTMP path.

**Important:** HLS uses copy codecs, so your input stream must be:
- **Video:** H.264 codec (most RTMP streams from OBS are H.264)
- **Audio:** AAC codec (most RTMP streams from OBS are AAC)

If your stream uses different codecs, the copy mode will fail. For typical OBS/Streamlabs streams, this works perfectly!

**HLS Configuration:**
You can customize HLS settings in `app.js`:
- `HLS_ENABLED`: Enable/disable HLS output (default: `true`)
- `HLS_HTTP_PORT`: HTTP port for serving HLS files (default: `8001`)
- `HLS_SEGMENT_TIME`: Segment duration in seconds (default: `2`)
- `HLS_PLAYLIST_SIZE`: Number of segments in playlist (default: `6`)

**Firewall:** Make sure port 8001 (or your configured HLS port) is open:
```bash
ufw allow 8001/tcp
```

**Testing HLS:**
You can test the HLS stream using VLC or any HLS-compatible player:
- VLC: Media → Open Network Stream → Enter the HLS URL
- Or use in an HTML5 video player:
```html
<video src="http://YOUR_SERVER_IP:8001/hls/live__mystream/index.m3u8" controls></video>
```

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
  - RTMP relays: Copy codecs (near-zero CPU)
  - HLS generation: Copy codecs (near-zero CPU, just remuxing/segmenting)
- **Bandwidth**: Upload bandwidth = (your bitrate) × (number of enabled platforms)
- **Latency**: Adds minimal latency (~1-2 seconds) to enable multi-platform distribution
- **HLS Latency**: ~2-12 seconds (depending on segment time and playlist size)

## Known Issues

- Some platforms may have infrastructure issues causing extremely slow processing
- If a platform consistently fails, disable it with `enabled: false`

## Credits

Built with [Node-Media-Server](https://github.com/illuspas/Node-Media-Server) by illuspas.

## License

MIT License - Feel free to use and modify for your needs.
