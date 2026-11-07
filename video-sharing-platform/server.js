const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CONFIG ============
// Admin password change koro (production e env use koro)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '@admin@';
const SESSION_SECRET = 'video-share-secret-key-change-me';

// Data files
const DATA_DIR = path.join(__dirname, 'data');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data dir
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Default data
function loadJSON(file, defaultVal) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {}
  return defaultVal;
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

let videos = loadJSON(VIDEOS_FILE, []);
let settings = loadJSON(SETTINGS_FILE, {
  siteName: 'Drive Video Share',
  siteDescription: 'Free Google Drive video sharing platform',
  adsterra: {
    // Global default ad codes (Adsterra theke copy kore paste koro)
    topBanner: '',
    bottomBanner: '',
    playerTop: '',
    playerBottom: '',
    sidebar: '',
    popup: '',
    native: ''
  }
});

// Middleware
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function isAdmin(req, res, next) {
  if (req.signedCookies && req.signedCookies.admin === 'true') {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// ============ HELPERS ============
function extractDriveId(url) {
  if (!url) return null;
  // Various Google Drive link formats
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /([a-zA-Z0-9_-]{25,})/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

function getEmbedUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

function getDownloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function getViewUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

// ============ PUBLIC API ============
app.get('/api/videos', (req, res) => {
  const published = videos.filter(v => v.published !== false);
  res.json(published);
});

app.get('/api/video/:id', (req, res) => {
  const video = videos.find(v => v.id === req.params.id);
  if (!video || video.published === false) {
    return res.status(404).json({ error: 'Video not found' });
  }
  res.json(video);
});

app.get('/api/settings', (req, res) => {
  res.json({
    siteName: settings.siteName,
    siteDescription: settings.siteDescription,
    homeTopBanner: settings.adsterra?.topBanner || ''
  });
});

// ============ ADMIN API ============
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.cookie('admin', 'true', {
      signed: true,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Wrong password' });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin');
  res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
  if (req.signedCookies && req.signedCookies.admin === 'true') {
    return res.json({ loggedIn: true });
  }
  res.json({ loggedIn: false });
});

app.get('/api/admin/videos', isAdmin, (req, res) => {
  res.json(videos);
});

app.post('/api/admin/videos', isAdmin, (req, res) => {
  const {
    title,
    description,
    driveLink,
    thumbnail,
    category,
    published,
    unlockWithAds,
    ads  // object: { topBanner, bottomBanner, playerTop, playerBottom, sidebar, popup, native }
  } = req.body;

  const fileId = extractDriveId(driveLink);
  if (!fileId) {
    return res.status(400).json({ error: 'Valid Google Drive link required' });
  }

  const video = {
    id: uuidv4(),
    title: title || 'Untitled',
    description: description || '',
    driveLink,
    fileId,
    embedUrl: getEmbedUrl(fileId),
    downloadUrl: getDownloadUrl(fileId),
    viewUrl: getViewUrl(fileId),
    thumbnail: thumbnail || `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
    category: category || 'General',
    published: published !== false,
    unlockWithAds: unlockWithAds === true,
    ads: ads || {},
    createdAt: new Date().toISOString(),
    views: 0
  };

  videos.unshift(video);
  saveJSON(VIDEOS_FILE, videos);
  res.json(video);
});

app.put('/api/admin/videos/:id', isAdmin, (req, res) => {
  const idx = videos.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const body = req.body;
  const fileId = body.driveLink ? extractDriveId(body.driveLink) : videos[idx].fileId;

  if (body.driveLink && !fileId) {
    return res.status(400).json({ error: 'Valid Google Drive link required' });
  }

  videos[idx] = {
    ...videos[idx],
    title: body.title ?? videos[idx].title,
    description: body.description ?? videos[idx].description,
    driveLink: body.driveLink ?? videos[idx].driveLink,
    fileId: fileId || videos[idx].fileId,
    embedUrl: getEmbedUrl(fileId || videos[idx].fileId),
    downloadUrl: getDownloadUrl(fileId || videos[idx].fileId),
    viewUrl: getViewUrl(fileId || videos[idx].fileId),
    thumbnail: body.thumbnail ?? videos[idx].thumbnail,
    category: body.category ?? videos[idx].category,
    published: body.published !== undefined ? body.published : videos[idx].published,
    unlockWithAds: body.unlockWithAds !== undefined ? body.unlockWithAds === true : videos[idx].unlockWithAds === true,
    ads: body.ads ?? videos[idx].ads,
    updatedAt: new Date().toISOString()
  };

  saveJSON(VIDEOS_FILE, videos);
  res.json(videos[idx]);
});

app.delete('/api/admin/videos/:id', isAdmin, (req, res) => {
  const idx = videos.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  videos.splice(idx, 1);
  saveJSON(VIDEOS_FILE, videos);
  res.json({ success: true });
});

app.get('/api/admin/settings', isAdmin, (req, res) => {
  res.json(settings);
});

app.put('/api/admin/settings', isAdmin, (req, res) => {
  settings = { ...settings, ...req.body };
  saveJSON(SETTINGS_FILE, settings);
  res.json(settings);
});

// Increment view count
app.post('/api/video/:id/view', (req, res) => {
  const video = videos.find(v => v.id === req.params.id);
  if (video) {
    video.views = (video.views || 0) + 1;
    saveJSON(VIDEOS_FILE, videos);
  }
  res.json({ success: true });
});

// SPA fallback for frontend routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  // Serve index for all non-api routes (frontend handles routing)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`🔑 Default Admin Password: ${ADMIN_PASSWORD}`);
  console.log(`   (Change it with ADMIN_PASSWORD env variable)\n`);
});
