/* app.js — main application logic
   - no innerHTML (Błąd 23: XSS protection)
   - no alert() (Błąd 25: UX improved)
   - safe DOM creation
   - lazy loading images
   - error handling (Błąd 26: try-catch)
   - debouncing (Błąd 28)
*/
'use strict';

/* ============================================
   UTILITIES (Błąd 25)
   ============================================ */

/**
 * Wyświetla komunikat toast, zastępując alert().
 */
function showToast(message, timeout = 3000) {
    const t = document.createElement('div');
    t.className = 'toast-notice';
    t.setAttribute('role', 'status');
    t.textContent = message;
    document.body.appendChild(t);
    // Animacja ukrycia
    setTimeout(() => t.classList.add('hide'), timeout - 200);
    // Usunięcie z DOM
    setTimeout(() => t.remove(), timeout);
}

// Funkcja pomocnicza do sprawdzania, czy URL to bezpieczny obraz base64/blob
function isDataImage(src) {
    return typeof src === 'string' && (src.startsWith('data:image/') || src.startsWith('blob:'));
}

/* ============================================
   THEME & ONLINE STATUS
   ============================================ */

(function themeInit() {
    const saved = localStorage.getItem('mg_theme') || 'light';
    document.body.setAttribute('data-theme', saved);
    const toggles = document.querySelectorAll('#theme-toggle, #theme-toggle-2');
    toggles.forEach(btn => {
        btn?.addEventListener('click', () => {
            const curr = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            document.body.setAttribute('data-theme', curr);
            localStorage.setItem('mg_theme', curr);
            showToast(`Theme: ${curr}`, 1200);
        });
    });
})();

(function onlineStatus() {
    const onlineEls = [document.getElementById('online-status'), document.getElementById('online-status-2')].filter(Boolean);
    const toastEl = document.getElementById('offline-toast');

    function updateOnline() {
        const s = navigator.onLine ? 'online' : 'offline';
        onlineEls.forEach(el => el.textContent = s);
        if (!navigator.onLine && toastEl) {
            toastEl.classList.remove('hidden');
            setTimeout(()=>toastEl.classList.add('hidden'), 4000);
        }
    }
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();
})();

/* ============================================
   POST RENDERING (Błąd 23)
   ============================================ */

/**
 * Tworzy kartę postu w DOM, używając bezpiecznych metod (createElement).
 */
function postCard(p, allowDelete = false) {
    // Błąd 23: Bezpieczne tworzenie DOM zamiast innerHTML
    const el = document.createElement('article');
    el.className = 'post';

    // Meta row (Avatar, User, Timestamp)
    const meta = document.createElement('div');
    meta.className = 'meta';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = 'Y';

    const info = document.createElement('div');
    const username = document.createElement('div');
    username.className = 'username';
    username.textContent = 'You';

    const timestamp = document.createElement('div');
    timestamp.className = 'hint';
    timestamp.textContent = new Date(p.ts).toLocaleString();

    info.appendChild(username);
    info.appendChild(timestamp);

    meta.appendChild(avatar);
    meta.appendChild(info);

    el.appendChild(meta);

    // Image
    const img = document.createElement('img');
    img.className = 'post-image';
    img.loading = 'lazy';
    img.alt = p.caption || 'User post image';

    // Błąd 23: Walidacja p.data przed użyciem
    if (isDataImage(p.data)) {
        img.src = p.data;
    } else {
        img.alt = 'Invalid image or data';
        // Użycie pustego obrazka, aby uniknąć błędów
        img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
    }
    el.appendChild(img);

    // Caption
    const caption = document.createElement('div');
    caption.className = 'caption';
    // Użycie textContent zabezpiecza przed XSS
    caption.textContent = p.caption || '';
    el.appendChild(caption);

    // Geo
    if (p.geo) {
        const geo = document.createElement('div');
        geo.className = 'hint small';
        geo.textContent = `📍 ${p.geo.lat.toFixed(4)}, ${p.geo.lon.toFixed(4)}`;
        el.appendChild(geo);
    }

    // Controls (Like/Delete)
    const controls = document.createElement('div');
    controls.style.marginTop = '8px';

    const like = document.createElement('button');
    like.className = 'small';
    like.textContent = `❤ ${p.likes || 0}`;
    like.type = 'button';
    like.onclick = async () => {
        try {
            p.likes = (p.likes || 0) + 1;
            await dbPut(p);
            like.textContent = `❤ ${p.likes}`;
        } catch (e) {
            console.error('Like error', e);
            showToast('Error updating like');
        }
    };
    controls.appendChild(like);

    if (allowDelete) {
        const del = document.createElement('button');
        del.className = 'small danger';
        del.textContent = 'Delete';
        del.type = 'button';
        del.onclick = async () => {
            try {
                await dbDelete(p.id);
                // Ponowne renderowanie po usunięciu
                await renderFeed();
                await renderMyPosts();
                showToast('Deleted');
            } catch (e) {
                console.error('Delete error', e);
                showToast('Error deleting post');
            }
        };
        controls.appendChild(del);
    }

    el.appendChild(controls);
    return el;
}

/* ============================================
   FEED & PROFILE RENDERING (Błąd 26)
   ============================================ */

/**
 * Renderuje główny feed.
 * Błąd 26: Dodano try-catch.
 */
async function renderFeed() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    try {
        const posts = await dbGetAll();
        // Bezpieczne czyszczenie listy
        while (feed.firstChild) feed.removeChild(feed.firstChild);

        const emptyEl = document.getElementById('empty');
        if (!posts || posts.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';

        posts.forEach(p => {
            try {
                feed.appendChild(postCard(p));
            }
            catch (e) {
                console.error('Render post error', e, p);
                showToast('Error rendering a post');
            }
        });
    } catch (e) {
        console.error('renderFeed error', e);
        const feed = document.getElementById('feed');
        if (feed) {
            const err = document.createElement('div');
            err.className = 'hint';
            err.textContent = 'Error loading feed. Try reloading.';
            feed.appendChild(err);
        }
    }
}

/**
 * Renderuje posty w sekcji profilu.
 * Błąd 26: Dodano try-catch.
 */
async function renderMyPosts() {
    const container = document.getElementById('my-posts');
    if (!container) return;
    try {
        const posts = await dbGetAll();
        while (container.firstChild) container.removeChild(container.firstChild);

        const emptyMy = document.getElementById('empty-my');
        if (!posts || posts.length === 0) {
            if (emptyMy) emptyMy.style.display = 'block';
            return;
        }
        if (emptyMy) emptyMy.style.display = 'none';
        posts.forEach(p => container.appendChild(postCard(p, true)));
    } catch (e) {
        console.error('renderMyPosts error', e);
    }
}

/* ============================================
   INIT & LISTENERS (Błąd 27)
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
    await renderFeed();
    await renderMyPosts();
});

// Błąd 27: Przechowywanie referencji do handlera, aby uniknąć memory leak
const focusHandler = async () => {
    await renderFeed();
    await renderMyPosts();
};
window.addEventListener('focus', focusHandler);


/* ============================================
   ADD PAGE LOGIC (Błąd 24, 28, 29)
   ============================================ */

(function addPageInit() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const snap = document.getElementById('snap');
    const file = document.getElementById('file');
    const captionInput = document.getElementById('caption');
    const publishBtn = document.getElementById('publish');
    const clearBtn = document.getElementById('clear');
    const geoEl = document.getElementById('geo');
    const camPlaceholder = document.getElementById('cam-placeholder');

    let currentPhoto = null;
    let currentGeo = null;

    // Błąd 28: Flaga dla debouncingu Geolocation
    let isGettingLocation = false;

    // Błąd 29: Walidacja przed użyciem getUserMedia
    async function startCamera() {
        if (!video) return;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('getUserMedia is not supported on this device/protocol (needs HTTPS)');
            if (camPlaceholder) camPlaceholder.style.display = 'block';
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }});
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                if (camPlaceholder) camPlaceholder.style.display = 'none';
            };
        } catch (e) {
            console.warn('Camera not available', e);
            if (camPlaceholder) camPlaceholder.style.display = 'block';
            // Błąd 25: Użycie showToast zamiast alert
            if (e.name === 'NotAllowedError') {
                showToast('Camera access denied. Please allow access in browser settings.');
            } else {
                showToast('Camera not available or error occurred.');
            }
        }
    }
    startCamera();

    if (snap) snap.addEventListener('click', () => {
        if (!video || !video.videoWidth) {
            showToast('Camera not ready'); // Błąd 25
            return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        currentPhoto = canvas.toDataURL('image/jpeg', 0.85); // Zmieniono na JPEG dla mniejszego rozmiaru
        showToast('Photo ready. Click Publish.', 1500); // Błąd 25
    });

    if (file) file.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;

        if (!f.type.startsWith('image/')) {
            showToast('Invalid file type.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            currentPhoto = reader.result;
            showToast('File uploaded. Click Publish.', 1500); // Błąd 25
        };
        reader.readAsDataURL(f);
    });

    const getLocBtn = document.getElementById('get-loc');
    if (getLocBtn) getLocBtn.addEventListener('click', () => {
        // Błąd 28: Debouncing
        if (isGettingLocation) return;
        if (!navigator.geolocation) {
            geoEl.textContent = 'Geolocation is not supported';
            showToast('Geolocation is not supported'); // Błąd 25
            return;
        }

        isGettingLocation = true;
        getLocBtn.disabled = true;
        geoEl.textContent = 'Getting location...';

        navigator.geolocation.getCurrentPosition(pos => {
            currentGeo = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            geoEl.textContent = `Coordinates: ${currentGeo.lat.toFixed(4)}, ${currentGeo.lon.toFixed(4)}`;
            isGettingLocation = false;
            getLocBtn.disabled = false;
        }, err => {
            geoEl.textContent = 'Geolocation error: ' + err.message;
            isGettingLocation = false;
            getLocBtn.disabled = false;
            // Błąd 25: Użycie showToast zamiast alert
            showToast('Geolocation error: ' + err.message);
        }, { timeout: 10000, enableHighAccuracy: true });
    });

    if (publishBtn) publishBtn.addEventListener('click', async () => {
        try {
            if (!currentPhoto) {
                showToast('Take a photo or upload a file first'); // Błąd 25
                return;
            }

            const cap = (captionInput?.value || '').trim();

            // Błąd 24: Walidacja długości podpisu
            if (cap.length > 500) {
                showToast('Caption too long (max 500)'); // Błąd 25
                return;
            }

            // Błąd 24: Walidacja rozmiaru obrazu (Base64)
            const maxBase64 = 5 * 1024 * 1024; // 5MB
            if (currentPhoto.length > maxBase64) {
                showToast('Image too large. Please use smaller image.'); // Błąd 25
                return;
            }

            const post = {
                id: 'p_' + Date.now(),
                ts: Date.now(),
                data: currentPhoto,
                caption: cap,
                geo: currentGeo,
                likes: 0
            };

            // Błąd 24: Obsługa błędu zapisu do IndexedDB
            await dbAdd(post);

            if (captionInput) captionInput.value = '';
            currentPhoto = null;
            currentGeo = null;
            if (geoEl) geoEl.textContent = '';

            showToast('Published locally'); // Błąd 25
            window.location.replace('index.html');
        } catch (e) {
            console.error('Publish error', e);
            showToast('Error publishing post. Try again.'); // Błąd 25
        }
    });

    if (clearBtn) clearBtn.addEventListener('click', () => {
        if (captionInput) captionInput.value = '';
        currentPhoto = null;
        currentGeo = null;
        if (geoEl) geoEl.textContent = '';
        showToast('Cleared', 900); // Błąd 25
    });

})();