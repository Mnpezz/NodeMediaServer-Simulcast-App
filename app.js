// app.js - NodeMediaServer Multi-Platform Stream Relay
// A simple RTMP relay server that streams to multiple platforms simultaneously
// https://github.com/illuspas/Node-Media-Server

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const NodeMediaServer = require('node-media-server');

//------------------------------------------------------------------------------
// CONFIGURATION
//------------------------------------------------------------------------------
const config = {
  logType: 2,
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*'
  }
};

//------------------------------------------------------------------------------
// STREAM DESTINATIONS
// Add your stream keys here. Set enabled: false to disable a destination.
//------------------------------------------------------------------------------
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
  {
    name: 'Rumble',
    enabled: true,
    url: 'rtmp://rtmp.rumble.com/live/YOUR_RUMBLE_STREAM_KEY'
  },
  {
    name: 'Kick',
    enabled: true,
    url: 'rtmps://fa723fc1b171.global-contribute.live-video.net/live/YOUR_KICK_STREAM_KEY'
  },
  {
    name: 'Zap.stream',
    enabled: false, // Disabled by default - has performance issues -  Critical 1.90 FPS 212 kbps
    url: 'rtmp://in.core.zap.stream:1935/Basic/YOUR_ZAP_STREAM_KEY'
  }
  // Add more destinations as needed:
  // {
  //   name: 'Facebook',
  //   enabled: true,
  //   url: 'rtmps://live-api-s.facebook.com:443/rtmp/YOUR_FB_STREAM_KEY'
  // }
];

//------------------------------------------------------------------------------
// SETUP
//------------------------------------------------------------------------------
const LOG_DIR = path.resolve(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const ffmpegProcesses = {}; // streamKey → { destName: { proc } }
const nms = new NodeMediaServer(config);
nms.run();

//------------------------------------------------------------------------------
// HELPER FUNCTIONS
//------------------------------------------------------------------------------
function getStreamPathFromSession(sessionOrId) {
  let session = sessionOrId;
  
  if (typeof sessionOrId === 'string') {
    if (nms.nrs && nms.nrs.sessions) {
      session = nms.nrs.sessions.get(sessionOrId);
    }
  }
  
  if (session) {
    if (session.publishStreamPath) return session.publishStreamPath;
    if (session.streamPath) return session.streamPath;
    if (session.rtmp && session.rtmp.streamName) {
      const app = session.streamApp || session.rtmp.streamApp || 'live';
      return `/${app}/${session.rtmp.streamName}`;
    }
  }
  
  return null;
}

function normalizeStreamPath(p) {
  if (!p) return null;
  return p.replace(/^\/+|\/+$/g, '');
}

function inputUrlFromStream(streamNormalized) {
  if (!streamNormalized) return null;
  
  if (streamNormalized.includes('/')) {
    return `rtmp://127.0.0.1:1935/${streamNormalized}`;
  }
  
  return `rtmp://127.0.0.1:1935/live/${streamNormalized}`;
}

function openLogFiles(streamKey, destName) {
  const base = path.join(LOG_DIR, `${streamKey}--${destName}`);
  return {
    out: fs.createWriteStream(`${base}.out.log`, { flags: 'a' }),
    err: fs.createWriteStream(`${base}.err.log`, { flags: 'a' })
  };
}

//------------------------------------------------------------------------------
// START SINGLE RELAY
//------------------------------------------------------------------------------
function startSingleRelay(streamKey, inputUrl, dest) {
  if (!ffmpegProcesses[streamKey]) {
    ffmpegProcesses[streamKey] = {};
  }
  
  if (ffmpegProcesses[streamKey][dest.name]) {
    console.log(`[INFO] Relay to ${dest.name} already running`);
    return;
  }

  console.log(`[INFO] Starting FFmpeg → ${dest.name}`);

  const ffArgs = [
    '-hide_banner',
    '-loglevel', 'info',
    '-re',
    '-i', inputUrl,
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-f', 'flv',
    '-bufsize', '3000k',
    dest.url
  ];

  const logs = openLogFiles(streamKey, dest.name);
  const ff = spawn('/usr/bin/ffmpeg', ffArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

  let lastDataTime = Date.now();
  let watchdogTimer = null;

  // Watchdog: restart if no data for 30 seconds (helps with stalled connections)
  if (dest.watchdog !== false) {
    watchdogTimer = setInterval(() => {
      const timeSinceData = Date.now() - lastDataTime;
      if (timeSinceData > 30000) {
        console.log(`[WARN] ${dest.name} appears stalled (no data for 30s). Restarting...`);
        clearInterval(watchdogTimer);
        ff.kill('SIGKILL');
      }
    }, 10000);
  }

  ff.stdout.on('data', d => {
    logs.out.write(d);
    lastDataTime = Date.now();
  });
  
  ff.stderr.on('data', d => {
    logs.err.write(d);
    lastDataTime = Date.now();
  });

  ff.on('close', code => {
    if (watchdogTimer) clearInterval(watchdogTimer);
    console.log(`[INFO] FFmpeg for ${dest.name} exited (code: ${code})`);
    logs.out.end();
    logs.err.end();
    
    if (ffmpegProcesses[streamKey] && ffmpegProcesses[streamKey][dest.name]) {
      delete ffmpegProcesses[streamKey][dest.name];
      
      // Auto-reconnect if stream is still active
      const otherRelaysActive = Object.keys(ffmpegProcesses[streamKey]).length > 0;
      
      if (dest.autoReconnect && otherRelaysActive) {
        console.log(`[INFO] ${dest.name} disconnected but stream still active. Auto-reconnecting in 5 seconds...`);
        setTimeout(() => {
          if (ffmpegProcesses[streamKey]) {
            console.log(`[INFO] Attempting reconnection to ${dest.name}`);
            startSingleRelay(streamKey, inputUrl, dest);
          }
        }, 5000);
      }
      
      if (Object.keys(ffmpegProcesses[streamKey]).length === 0) {
        delete ffmpegProcesses[streamKey];
      }
    }
  });

  ff.on('error', err => {
    if (watchdogTimer) clearInterval(watchdogTimer);
    console.error(`[ERROR] FFmpeg spawn error for ${dest.name}:`, err);
    logs.err.write(`Spawn error: ${err.message}\n`);
    logs.out.end();
    logs.err.end();
  });

  ffmpegProcesses[streamKey][dest.name] = { proc: ff };
}

//------------------------------------------------------------------------------
// START ALL RELAYS
//------------------------------------------------------------------------------
function startFFmpegRelay(rawPath) {
  const normalized = normalizeStreamPath(rawPath);
  if (!normalized) {
    console.error('[ERROR] startFFmpegRelay() invalid streamPath:', rawPath);
    return;
  }

  const streamKey = normalized.replace(/\//g, '__');
  if (!ffmpegProcesses[streamKey]) ffmpegProcesses[streamKey] = {};

  const inputUrl = inputUrlFromStream(normalized);
  console.log(`[INFO] Starting relays for stream: ${rawPath}`);

  const enabledDestinations = destinations.filter(d => d.enabled);
  console.log(`[INFO] Enabled destinations: ${enabledDestinations.map(d => d.name).join(', ')}`);

  enabledDestinations.forEach((dest, index) => {
    if (ffmpegProcesses[streamKey][dest.name]) {
      console.log(`[INFO] Relay to ${dest.name} already running`);
      return;
    }

    // Stagger connections slightly to avoid overwhelming the input
    const delay = index * 500;
    
    setTimeout(() => {
      if (!ffmpegProcesses[streamKey]) {
        console.log(`[WARN] Stream ${streamKey} no longer active, skipping ${dest.name}`);
        return;
      }

      startSingleRelay(streamKey, inputUrl, dest);
    }, delay);
  });
}

//------------------------------------------------------------------------------
// STOP RELAY
//------------------------------------------------------------------------------
function stopFFmpegRelay(rawPath) {
  const normalized = normalizeStreamPath(rawPath);
  if (!normalized) {
    console.warn('[WARN] stopFFmpegRelay() invalid streamPath:', rawPath);
    return;
  }

  const streamKey = normalized.replace(/\//g, '__');

  if (!ffmpegProcesses[streamKey]) {
    console.log(`[INFO] No active relays for stream: ${streamKey}`);
    return;
  }

  console.log(`[INFO] Stopping FFmpeg relays for stream: ${streamKey}`);

  Object.entries(ffmpegProcesses[streamKey]).forEach(([destName, info]) => {
    try {
      console.log(`[INFO] Killing relay to ${destName}`);
      info.proc.kill('SIGINT');
    } catch (e) {
      console.error(`[ERROR] Failed to kill ${destName}:`, e);
    }
  });

  delete ffmpegProcesses[streamKey];
}

//------------------------------------------------------------------------------
// NMS EVENT HOOKS
//------------------------------------------------------------------------------
nms.on('postPublish', (id, streamPath, args) => {
  let actualPath = streamPath || getStreamPathFromSession(id);

  if (!actualPath) {
    console.error('[ERROR] Could not determine stream path');
    return;
  }

  console.log('[INFO] Stream started:', actualPath);
  startFFmpegRelay(actualPath);
});

nms.on('donePublish', (id, streamPath, args) => {
  let actualPath = streamPath || getStreamPathFromSession(id);

  if (!actualPath) {
    console.error('[ERROR] Could not determine stream path');
    return;
  }

  console.log('[INFO] Stream stopped:', actualPath);
  stopFFmpegRelay(actualPath);
});

//------------------------------------------------------------------------------
// GRACEFUL SHUTDOWN
//------------------------------------------------------------------------------
process.on('SIGINT', () => {
  console.log('[INFO] SIGINT received — shutting down FFmpeg relays');
  Object.keys(ffmpegProcesses).forEach(key => {
    Object.values(ffmpegProcesses[key]).forEach(info => {
      try {
        info.proc.kill('SIGINT');
      } catch (e) {
        console.error('[ERROR] Failed to kill process:', e);
      }
    });
  });
  setTimeout(() => process.exit(0), 2000);
});

process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM received — shutting down FFmpeg relays');
  Object.keys(ffmpegProcesses).forEach(key => {
    Object.values(ffmpegProcesses[key]).forEach(info => {
      try {
        info.proc.kill('SIGTERM');
      } catch (e) {
        console.error('[ERROR] Failed to kill process:', e);
      }
    });
  });
  setTimeout(() => process.exit(0), 2000);
});

//------------------------------------------------------------------------------
console.log('[INFO] NodeMediaServer Multi-Platform Relay started');
console.log('[INFO] RTMP input: rtmp://YOUR_SERVER_IP:1935/live/YOUR_STREAM_KEY');
console.log('[INFO] Enabled destinations:', destinations.filter(d => d.enabled).map(d => d.name).join(', '));
console.log('[INFO] Logs directory:', LOG_DIR);
