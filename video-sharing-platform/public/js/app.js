// ==================== STATE & HELPERS ====================
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

let currentVideos = [];
let siteSettings = { siteName: 'Drive Video Share', siteDescription: '' };
let activeUnlockObserver = null;
let activeUnlockCleanup = null;
const unlockedVideos = new Set();

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function getPath() {
  return window.location.pathname;
}

function navigate(path) {
  window.history.pushState({}, '', path);
  render();
}

// Simple client-side router
window.addEventListener('popstate', render);

// ==================== API ====================
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ==================== RENDER PAGES ====================
async function render() {
  const path = getPath();
  const main = $('#mainContent');

  try {
    // Load site settings once
    if (!siteSettings._loaded) {
      try {
        const s = await api('/api/settings');
        siteSettings = { ...siteSettings, ...s, _loaded: true };
        $('#siteLogo').textContent = siteSettings.siteName || 'Drive Video Share';
        document.title = siteSettings.siteName || 'Drive Video Share';
      } catch (e) {}
    }

    if (path.startsWith('/admin')) {
      await renderAdmin(path);
    } else if (path.startsWith('/video/')) {
      const id = path.split('/video/')[1];
      await renderVideoPage(id);
    } else {
      await renderHome();
    }
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

// ==================== HOME ====================
async function renderHome() {
  const main = $('#mainContent');
  main.innerHTML = `<div class="container"><div class="loading">ভিডিও লোড হচ্ছে...</div></div>`;

  try {
    currentVideos = await api('/api/videos');
  } catch (e) {
    currentVideos = [];
  }

  const categories = [...new Set(currentVideos.map(v => v.category).filter(Boolean))];

  main.innerHTML = `
    <div class="container">
      <h1 class="page-title">${siteSettings.siteName || 'Drive Video Share'}</h1>
      <p class="page-desc">${siteSettings.siteDescription || 'Google Drive থেকে ভিডিও শেয়ার ও ডাউনলোড করুন'}</p>

      <div class="ad-slot top home-ad" id="home-top-ad">${siteSettings.homeTopBanner || ''}</div>

      <div class="search-bar">
        <input type="text" id="searchInput" placeholder="ভিডিও খুঁজুন..." />
        <select id="categoryFilter">
          <option value="">সব ক্যাটাগরি</option>
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>

      <div class="video-grid" id="videoGrid">
        ${renderVideoCards(currentVideos)}
      </div>
    </div>
  `;

  activateAdScripts($('#home-top-ad'));
  $('#searchInput').addEventListener('input', filterVideos);
  $('#categoryFilter').addEventListener('change', filterVideos);

  // Card click
  $$('.video-card').forEach(card => {
    card.addEventListener('click', () => navigate(`/video/${card.dataset.id}`));
  });
}

function renderVideoCards(videos) {
  if (!videos.length) {
    return `<div class="empty-state" style="grid-column:1/-1"><h3>কোনো ভিডিও নেই</h3><p>Admin panel থেকে ভিডিও যোগ করুন</p></div>`;
  }
  return videos.map(v => `
    <div class="video-card" data-id="${v.id}">
      ${v.thumbnail ? `<img src="${v.thumbnail}" alt="${escapeHtml(v.title)}" loading="lazy" onerror="showThumbnailFallback(this)" />` : ''}
      <div class="video-thumbnail-fallback" ${v.thumbnail ? 'hidden' : ''} aria-hidden="true"><span>▶</span><small>ভিডিও</small></div>
      <div class="video-card-body">
        <div class="video-card-title">${escapeHtml(v.title)}</div>
        <div class="video-card-meta">
          <span>${v.category || 'General'}</span>
          <span>👁️ ${v.views || 0}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function showThumbnailFallback(image) {
  image.hidden = true;
  const fallback = image.nextElementSibling;
  if (fallback) fallback.hidden = false;
}

function filterVideos() {
  const q = ($('#searchInput')?.value || '').toLowerCase();
  const cat = $('#categoryFilter')?.value || '';
  const filtered = currentVideos.filter(v => {
    const matchQ = !q || (v.title + ' ' + (v.description || '')).toLowerCase().includes(q);
    const matchC = !cat || v.category === cat;
    return matchQ && matchC;
  });
  const grid = $('#videoGrid');
  if (grid) {
    grid.innerHTML = renderVideoCards(filtered);
    $$('.video-card').forEach(card => {
      card.addEventListener('click', () => navigate(`/video/${card.dataset.id}`));
    });
  }
}

// ==================== VIDEO PAGE ====================
async function renderVideoPage(id, countView = true) {
  const main = $('#mainContent');
  if (activeUnlockCleanup) {
    activeUnlockCleanup();
    activeUnlockCleanup = null;
  }
  main.innerHTML = `<div class="container"><div class="loading">ভিডিও লোড হচ্ছে...</div></div>`;

  let video;
  try {
    video = await api(`/api/video/${id}`);
    if (countView) {
      api(`/api/video/${id}/view`, { method: 'POST' }).catch(() => {});
    }
  } catch (e) {
    main.innerHTML = `<div class="container"><div class="empty-state"><h3>ভিডিও পাওয়া যায়নি</h3><p><a href="/" style="color:var(--primary)">হোমে ফিরে যান</a></p></div></div>`;
    return;
  }

  // Get global settings for fallback ads
  let globalAds = {};
  try {
    // We need admin settings only for ads, but public can't access full settings.
    // So we embed ads from the video itself (per-video ads) + we can put global in video if empty.
    // For simplicity: use video.ads, if empty use nothing (admin must set per video or we can improve later)
  } catch (e) {}

  const ads = video.ads || {};
  const isLocked = video.unlockWithAds === true && !isVideoUnlocked(id);
  const unlockAdsConfigured = Boolean(ads.playerTop && ads.playerBottom);

  main.innerHTML = `
    <div class="container">
      <div class="video-page">
        <div class="player-section">
          <!-- Top Banner Ad -->
          <div class="ad-slot top" id="ad-top">${ads.topBanner || ''}</div>

          <!-- Player Top Ad -->
          ${isLocked ? '' : `<div class="ad-slot" id="ad-player-top">${ads.playerTop || ''}</div>`}

          ${isLocked ? `
            <section class="video-unlock" id="videoUnlock">
              <h2>ভিডিও আনলক করুন</h2>
              <p>ভিডিও দেখতে ও ডাউনলোড করতে নিচের দুটি বিজ্ঞাপন দেখুন। বিজ্ঞাপনে ক্লিক করার প্রয়োজন নেই।</p>
              <div class="unlock-ad-slots">
                <div class="unlock-ad-item">
                  <h3>বিজ্ঞাপন ১</h3>
                  <div class="unlock-ad-slot" id="unlock-ad-one">${ads.playerTop || '<p>এই বিজ্ঞাপনটি সেট করা নেই।</p>'}</div>
                </div>
                <div class="unlock-ad-item">
                  <h3>বিজ্ঞাপন ২</h3>
                  <div class="unlock-ad-slot" id="unlock-ad-two">${ads.playerBottom || '<p>এই বিজ্ঞাপনটি সেট করা নেই।</p>'}</div>
                </div>
              </div>
              <p class="unlock-progress" id="unlockProgress">${unlockAdsConfigured ? 'বিজ্ঞাপন দেখা হয়েছে: ০/২' : 'এই ভিডিওর জন্য Player-এর উপরে ও নিচে—দুটি Ad Code সেট করতে হবে।'}</p>
              <button class="btn btn-primary" id="unlockVideoBtn" disabled>ভিডিও আনলক করুন</button>
            </section>
          ` : `
            <div class="player-wrapper">
              <iframe src="${video.embedUrl}" allow="autoplay; encrypted-media" allowfullscreen></iframe>
            </div>
          `}

          <!-- Player Bottom Ad -->
          ${isLocked ? '' : `<div class="ad-slot" id="ad-player-bottom">${ads.playerBottom || ''}</div>`}

          <div class="video-info">
            <h1>${escapeHtml(video.title)}</h1>
            <div class="video-meta">
              <span>📁 ${escapeHtml(video.category || 'General')}</span>
              <span>👁️ ${video.views || 0} views</span>
             <!-- <span>📅 ${new Date(video.createdAt).toLocaleDateString('bn-BD')}</span> -->
            </div>
            <div class="video-desc">${escapeHtml(video.description || '')}</div>
            <div class="action-buttons">
              ${isLocked ? '<span class="btn btn-disabled" aria-disabled="true">🔒 আনলক করলে ডাউনলোড করতে পারবেন</span>' : `<a href="${video.downloadUrl}" class="btn btn-success" target="_blank" rel="noopener">⬇️ ডাউনলোড</a>`}
              <!-- <a href="${video.viewUrl}" class="btn btn-secondary" target="_blank" rel="noopener">🔗 Google Drive এ খুলুন</a> -->
              <button class="btn btn-secondary" onclick="shareVideo('${video.id}', '${escapeHtml(video.title)}')">📤 শেয়ার</button>
              <a href="/" class="btn btn-secondary">← ফিরে যান</a>
            </div>
          </div>

          <!-- Bottom Banner Ad -->
          <div class="ad-slot bottom" id="ad-bottom">${ads.bottomBanner || ''}</div>
        </div>

        <aside class="sidebar">
          <div class="ad-slot sidebar-card" id="ad-sidebar">${ads.sidebar || ''}</div>
          <div class="sidebar-card">
            <h3>অন্যান্য ভিডিও</h3>
            <div id="relatedVideos">লোড হচ্ছে...</div>
          </div>
        </aside>
      </div>
    </div>
  `;

  $$('.ad-slot', main).forEach(activateAdScripts);
  if (isLocked && unlockAdsConfigured) {
    setupVideoUnlock(id);
  }

  // Load related
  try {
    const all = await api('/api/videos');
    const related = all.filter(v => v.id !== id).slice(0, 5);
    const relEl = $('#relatedVideos');
    if (related.length) {
      relEl.innerHTML = related.map(v => `
        <div style="display:flex;gap:10px;margin-bottom:12px;cursor:pointer" onclick="navigate('/video/${v.id}')">
          <img src="${v.thumbnail}" style="width:80px;height:50px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'" />
          <div style="font-size:0.9rem;line-height:1.3">${escapeHtml(v.title)}</div>
        </div>
      `).join('');
    } else {
      relEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">আর কোনো ভিডিও নেই</p>';
    }
  } catch (e) {}

  // If native or popup ads exist, inject them carefully
  if (ads.native) {
    const nativeDiv = document.createElement('div');
    nativeDiv.innerHTML = ads.native;
    main.appendChild(nativeDiv);
  }
  if (ads.popup) {
    // Popup/popunder usually self-execute, just inject script
    const div = document.createElement('div');
    div.innerHTML = ads.popup;
    document.body.appendChild(div);
  }
}

function isVideoUnlocked(id) {
  if (unlockedVideos.has(id)) return true;
  try {
    return localStorage.getItem(`video-unlocked-${id}`) === 'true';
  } catch (e) {
    return false;
  }
}

function setupVideoUnlock(id) {
  const progress = $('#unlockProgress');
  const unlockButton = $('#unlockVideoBtn');
  const seenAds = new Set();
  const timers = new Map();
  const adSlots = [$('#unlock-ad-one'), $('#unlock-ad-two')];

  adSlots.forEach(activateAdScripts);

  if (!('IntersectionObserver' in window)) {
    progress.textContent = 'আপনার ব্রাউজার বিজ্ঞাপন দেখা যাচাই করতে পারছে না। একটি আধুনিক ব্রাউজার ব্যবহার করুন।';
    return;
  }

  activeUnlockObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const slot = entry.target;
      if (seenAds.has(slot)) return;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!timers.has(slot)) {
          timers.set(slot, setTimeout(() => {
            seenAds.add(slot);
            timers.delete(slot);
            progress.textContent = `বিজ্ঞাপন দেখা হয়েছে: ${seenAds.size}/২`;
            unlockButton.disabled = seenAds.size < 2;
          }, 1000));
        }
      } else if (timers.has(slot)) {
        clearTimeout(timers.get(slot));
        timers.delete(slot);
      }
    });
  }, { threshold: 0.5 });

  activeUnlockCleanup = () => {
    activeUnlockObserver?.disconnect();
    timers.forEach(timer => clearTimeout(timer));
    timers.clear();
    activeUnlockObserver = null;
  };

  adSlots.forEach(slot => activeUnlockObserver.observe(slot));
  unlockButton.addEventListener('click', () => {
    unlockedVideos.add(id);
    try {
      localStorage.setItem(`video-unlocked-${id}`, 'true');
    } catch (e) {
      toast('এই ব্রাউজারে আনলক সংরক্ষণ করা যায়নি; পেজ খোলা থাকা পর্যন্ত চালু থাকবে।', 'error');
    }
    renderVideoPage(id, false);
  });
}

function activateAdScripts(container) {
  $$('script', container).forEach(oldScript => {
    const script = document.createElement('script');
    [...oldScript.attributes].forEach(attribute => script.setAttribute(attribute.name, attribute.value));
    script.textContent = oldScript.textContent;
    oldScript.replaceWith(script);
  });
}

function shareVideo(id, title) {
  const url = window.location.origin + '/video/' + id;
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => toast('লিংক কপি হয়েছে!'));
  }
}

// ==================== ADMIN ====================
async function renderAdmin(path) {
  const main = $('#mainContent');

  // Check login
  let loggedIn = false;
  try {
    const check = await api('/api/admin/check');
    loggedIn = check.loggedIn;
  } catch (e) {}

  if (!loggedIn) {
    main.innerHTML = `
      <div class="container">
        <div class="login-box">
          <h1>🔐 Admin Login</h1>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="adminPassword" placeholder="Admin password" />
          </div>
          <button class="btn btn-primary" style="width:100%" onclick="adminLogin()">Login</button>
          <!-- <p class="hint" style="text-align:center;margin-top:16px">Default: ddsdsd</p> -->
        </div>
      </div>
    `;
    $('#adminPassword')?.addEventListener('keypress', e => {
      if (e.key === 'Enter') adminLogin();
    });
    return;
  }

  // Admin layout
  const subPath = path.replace('/admin', '') || '/';
  main.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar" id="adminSidebar">
        <a href="/admin" class="${subPath === '/' || subPath === '' ? 'active' : ''}" data-nav="/admin">📹 Videos</a>
        <a href="/admin/add" class="${subPath === '/add' ? 'active' : ''}" data-nav="/admin/add">➕ Add Video</a>
        <a href="/admin/settings" class="${subPath === '/settings' ? 'active' : ''}" data-nav="/admin/settings">⚙️ Settings & Ads</a>
        <a href="/" data-nav="/">🌐 View Site</a>
        <a href="#" onclick="adminLogout(); return false;">🚪 Logout</a>
      </aside>
      <div class="admin-content" id="adminContent">
        <div class="loading">লোড হচ্ছে...</div>
      </div>
    </div>
  `;

  // Sidebar nav
  $$('#adminSidebar a[data-nav]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.dataset.nav);
    });
  });

  if (subPath === '/add' || subPath.startsWith('/edit/')) {
    const editId = subPath.startsWith('/edit/') ? subPath.split('/edit/')[1] : null;
    await renderAdminForm(editId);
  } else if (subPath === '/settings') {
    await renderAdminSettings();
  } else {
    await renderAdminVideos();
  }
}

async function adminLogin() {
  const password = $('#adminPassword')?.value;
  if (!password) return toast('Password দিন', 'error');
  try {
    await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
    toast('Login successful!');
    render();
  } catch (e) {
    toast(e.message || 'Wrong password', 'error');
  }
}

async function adminLogout() {
  await api('/api/admin/logout', { method: 'POST' });
  toast('Logged out');
  navigate('/admin');
}

async function renderAdminVideos() {
  const content = $('#adminContent');
  let videos = [];
  try {
    videos = await api('/api/admin/videos');
  } catch (e) {
    content.innerHTML = `<p>Error loading videos</p>`;
    return;
  }

  content.innerHTML = `
    <div class="admin-header">
      <h1>সব ভিডিও (${videos.length})</h1>
      <button class="btn btn-primary" onclick="navigate('/admin/add')">➕ নতুন ভিডিও</button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Views</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${videos.length ? videos.map(v => `
            <tr>
              <td><strong>${escapeHtml(v.title)}</strong></td>
              <td>${escapeHtml(v.category || '-')}</td>
              <td>${v.views || 0}</td>
              <td>
                <span class="badge ${v.published !== false ? 'badge-success' : 'badge-danger'}">
                  ${v.published !== false ? 'Published' : 'Draft'}
                </span>
              </td>
              <td class="actions">
                <button class="btn btn-secondary" style="padding:6px 10px;font-size:0.85rem" onclick="navigate('/admin/edit/${v.id}')">Edit</button>
                <button class="btn btn-danger" style="padding:6px 10px;font-size:0.85rem" onclick="deleteVideo('${v.id}')">Delete</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="5" style="text-align:center;padding:40px">কোনো ভিডিও নেই</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

async function deleteVideo(id) {
  if (!confirm('এই ভিডিও ডিলিট করতে চান?')) return;
  try {
    await api(`/api/admin/videos/${id}`, { method: 'DELETE' });
    toast('ভিডিও ডিলিট হয়েছে');
    renderAdminVideos();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function renderAdminForm(editId = null) {
  const content = $('#adminContent');
  let video = null;

  if (editId) {
    try {
      const all = await api('/api/admin/videos');
      video = all.find(v => v.id === editId);
      if (!video) throw new Error('Not found');
    } catch (e) {
      content.innerHTML = `<p>Video not found</p>`;
      return;
    }
  }

  const ads = video?.ads || {};

  content.innerHTML = `
    <div class="admin-header">
      <h1>${editId ? 'ভিডিও এডিট' : 'নতুন ভিডিও যোগ করুন'}</h1>
      <button class="btn btn-secondary" onclick="navigate('/admin')">← ফিরে যান</button>
    </div>

    <form id="videoForm" onsubmit="saveVideo(event, '${editId || ''}')">
      <div class="form-group">
        <label>ভিডিও টাইটেল *</label>
        <input type="text" name="title" required value="${escapeHtml(video?.title || '')}" placeholder="ভিডিওর নাম" />
      </div>

      <div class="form-group">
        <label>Google Drive Link *</label>
        <input type="url" name="driveLink" required value="${escapeHtml(video?.driveLink || '')}" placeholder="https://drive.google.com/file/d/xxxxx/view" />
        <p class="hint">Google Drive এ ভিডিও আপলোড করে "Anyone with the link" করে লিংক দিন</p>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>ক্যাটাগরি</label>
          <input type="text" name="category" value="${escapeHtml(video?.category || 'General')}" placeholder="General, Movie, Tutorial..." />
        </div>
        <div class="form-group">
          <label>Thumbnail URL (optional)</label>
          <input type="url" name="thumbnail" value="${escapeHtml(video?.thumbnail || '')}" placeholder="খালি রাখলে auto thumbnail হবে" />
        </div>
      </div>

      <div class="form-group">
        <label>Description</label>
        <textarea name="description" placeholder="ভিডিওর বিবরণ...">${escapeHtml(video?.description || '')}</textarea>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" name="published" ${video?.published !== false ? 'checked' : ''} style="width:auto;margin-right:8px" />
          Published (সাইটে দেখাবে)
        </label>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" name="unlockWithAds" ${video?.unlockWithAds === true ? 'checked' : ''} style="width:auto;margin-right:8px" />
          দুটি বিজ্ঞাপন দেখার পর ভিডিও ও ডাউনলোড আনলক করুন
        </label>
        <p class="hint">চালু করলে Player-এর উপরে ও নিচে—দুটি Ad Code দিতে হবে। দুটো স্লট অন্তত ১ সেকেন্ড দৃশ্যমান হলে আনলক হবে; বিজ্ঞাপনে ক্লিক বাধ্যতামূলক নয়।</p>
      </div>

      <!-- Per-video Ads -->
      <div class="ads-section">
        <h4>📢 Adsterra Ads (এই ভিডিওর জন্য আলাদা)</h4>
        <p class="hint" style="margin-bottom:14px">Adsterra থেকে ad code কপি করে নিচে পেস্ট করুন। যে যে জায়গায় কোড দিবেন, শুধু সেখানেই ad চলবে।</p>

        <div class="form-group">
          <label>Top Banner Ad Code</label>
          <textarea name="ad_topBanner" placeholder="<script> ... Adsterra code ... </script>">${escapeHtml(ads.topBanner || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Player এর উপরে Ad Code</label>
          <textarea name="ad_playerTop" placeholder="Player top ad code">${escapeHtml(ads.playerTop || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Player এর নিচে Ad Code</label>
          <textarea name="ad_playerBottom" placeholder="Player bottom ad code">${escapeHtml(ads.playerBottom || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Bottom Banner Ad Code</label>
          <textarea name="ad_bottomBanner" placeholder="Bottom banner code">${escapeHtml(ads.bottomBanner || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Sidebar Ad Code</label>
          <textarea name="ad_sidebar" placeholder="Sidebar ad code">${escapeHtml(ads.sidebar || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Native / In-page Ad Code</label>
          <textarea name="ad_native" placeholder="Native ad code">${escapeHtml(ads.native || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Popup / Popunder Code (সাবধানে ব্যবহার করুন)</label>
          <textarea name="ad_popup" placeholder="Popup code">${escapeHtml(ads.popup || '')}</textarea>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${editId ? 'আপডেট করুন' : 'সেভ করুন'}</button>
        <button type="button" class="btn btn-secondary" onclick="navigate('/admin')">বাতিল</button>
      </div>
    </form>
  `;
}

async function saveVideo(e, editId) {
  e.preventDefault();
  const form = e.target;
  const data = {
    title: form.title.value.trim(),
    driveLink: form.driveLink.value.trim(),
    category: form.category.value.trim() || 'General',
    thumbnail: form.thumbnail.value.trim(),
    description: form.description.value.trim(),
    published: form.published.checked,
    unlockWithAds: form.unlockWithAds.checked,
    ads: {
      topBanner: form.ad_topBanner.value.trim(),
      playerTop: form.ad_playerTop.value.trim(),
      playerBottom: form.ad_playerBottom.value.trim(),
      bottomBanner: form.ad_bottomBanner.value.trim(),
      sidebar: form.ad_sidebar.value.trim(),
      native: form.ad_native.value.trim(),
      popup: form.ad_popup.value.trim()
    }
  };

  try {
    if (editId) {
      await api(`/api/admin/videos/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
      toast('ভিডিও আপডেট হয়েছে!');
    } else {
      await api('/api/admin/videos', { method: 'POST', body: JSON.stringify(data) });
      toast('ভিডিও যোগ হয়েছে!');
    }
    navigate('/admin');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function renderAdminSettings() {
  const content = $('#adminContent');
  let settings = {};
  try {
    settings = await api('/api/admin/settings');
  } catch (e) {
    content.innerHTML = `<p>Error</p>`;
    return;
  }

  content.innerHTML = `
    <div class="admin-header">
      <h1>⚙️ Settings & Global Ads</h1>
    </div>

    <form id="settingsForm" onsubmit="saveSettings(event)">
      <div class="form-group">
        <label>সাইটের নাম</label>
        <input type="text" name="siteName" value="${escapeHtml(settings.siteName || '')}" />
      </div>
      <div class="form-group">
        <label>সাইটের বিবরণ</label>
        <input type="text" name="siteDescription" value="${escapeHtml(settings.siteDescription || '')}" />
      </div>

      <div class="ads-section">
        <h4>📢 Global Default Ad Codes (optional)</h4>
        <p class="hint">Default Top Banner হোমপেজের উপরে দেখাবে। অন্য global code ভিডিও পেজের জন্য fallback হিসেবে ব্যবহার হবে না।</p>
        <div class="form-group">
          <label>হোমপেজের উপরের বিজ্ঞাপন (Default Top Banner)</label>
          <textarea name="ad_topBanner">${escapeHtml(settings.adsterra?.topBanner || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Default Player Top</label>
          <textarea name="ad_playerTop">${escapeHtml(settings.adsterra?.playerTop || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Default Player Bottom</label>
          <textarea name="ad_playerBottom">${escapeHtml(settings.adsterra?.playerBottom || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Default Bottom Banner</label>
          <textarea name="ad_bottomBanner">${escapeHtml(settings.adsterra?.bottomBanner || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Default Sidebar</label>
          <textarea name="ad_sidebar">${escapeHtml(settings.adsterra?.sidebar || '')}</textarea>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">সেভ Settings</button>
      </div>
    </form>
  `;
}

async function saveSettings(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    siteName: form.siteName.value.trim(),
    siteDescription: form.siteDescription.value.trim(),
    adsterra: {
      topBanner: form.ad_topBanner.value.trim(),
      playerTop: form.ad_playerTop.value.trim(),
      playerBottom: form.ad_playerBottom.value.trim(),
      bottomBanner: form.ad_bottomBanner.value.trim(),
      sidebar: form.ad_sidebar.value.trim()
    }
  };
  try {
    await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) });
    siteSettings = { ...siteSettings, ...data, _loaded: true };
    siteSettings.homeTopBanner = data.adsterra.topBanner;
    $('#siteLogo').textContent = data.siteName;
    toast('Settings সেভ হয়েছে!');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ==================== UTILS ====================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Make some functions global for onclick
window.navigate = navigate;
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.deleteVideo = deleteVideo;
window.saveVideo = saveVideo;
window.saveSettings = saveSettings;
window.shareVideo = shareVideo;

// Initial render
render();
