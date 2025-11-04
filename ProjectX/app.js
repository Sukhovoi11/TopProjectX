(async function(){
    // --- Install prompt
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const btn = document.getElementById('install-btn');
        if (btn) {
            btn.hidden = false;
            btn.onclick = async () => {
                btn.hidden = true;
                deferredPrompt.prompt();
                const choice = await deferredPrompt.userChoice;
                console.log('Install choice', choice);
                deferredPrompt = null;
            };
        }
    });

    // --- Theme toggle
    const themeToggle = document.querySelector('#theme-toggle') || document.querySelector('#theme-toggle-2');
    function applyTheme(name){
        document.body.setAttribute('data-theme', name);
        localStorage.setItem('mg_theme', name);
    }
    const savedTheme = localStorage.getItem('mg_theme') || 'light';
    applyTheme(savedTheme);
    if (themeToggle) themeToggle.onclick = () =>
        applyTheme(document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light');

    // --- Online/offline status
    const onlineEls = [document.getElementById('online-status'), document.getElementById('online-status-2')].filter(Boolean);
    function updateOnline(){
        const s = navigator.onLine ? 'online' : 'offline';
        onlineEls.forEach(el => el.textContent = s);
        const toast = document.getElementById('offline-toast');
        if (!navigator.onLine && toast) {
            toast.classList.remove('hidden');
            setTimeout(()=>toast.classList.add('hidden'), 4000);
        }
    }
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();

    // --- Rendering helpers (feed & profile)
    async function renderFeed() {
        const feed = document.getElementById('feed');
        if (!feed) return;
        const posts = await dbGetAll();
        feed.innerHTML = '';
        if (!posts.length) { document.getElementById('empty').style.display='block'; return; }
        document.getElementById('empty').style.display='none';
        posts.forEach(p => feed.appendChild(postCard(p)));
    }
    async function renderMyPosts(){
        const container = document.getElementById('my-posts');
        if (!container) return;
        const posts = await dbGetAll();
        container.innerHTML = '';
        if (!posts.length) { document.getElementById('empty-my').style.display='block'; return; }
        document.getElementById('empty-my').style.display='none';
        posts.forEach(p => container.appendChild(postCard(p, true)));
    }

    function postCard(p, allowDelete=false){
        const el = document.createElement('article');
        el.className = 'post';
        el.innerHTML = `
          <div class="meta">
            <div class="avatar">Y</div>
            <div>
              <div class="username">You</div>
              <div class="hint">${new Date(p.ts).toLocaleString()}</div>
            </div>
          </div>
          <img class="post-image" src="${p.data}" alt="post image" />
          <div class="caption">${escapeHtml(p.caption || '')}</div>
          <div class="hint small">${p.geo ? `📍 ${p.geo.lat.toFixed(4)}, ${p.geo.lon.toFixed(4)}` : ''}</div>
        `;
        const controls = document.createElement('div');
        controls.style.marginTop = '8px';
        const like = document.createElement('button');
        like.className = 'small';
        like.textContent = `❤ ${p.likes||0}`;
        like.onclick = async () => {
            p.likes = (p.likes||0)+1;
            await dbPut(p);
            like.textContent = `❤ ${p.likes}`;
        };
        controls.appendChild(like);

        if (allowDelete){
            const del = document.createElement('button');
            del.className='small';
            del.textContent='Delete';
            del.onclick = async () => {
                await dbDelete(p.id);
                await renderFeed();
                await renderMyPosts();
            };
            controls.appendChild(del);
        }
        el.appendChild(controls);
        return el;
    }

    function escapeHtml(text=''){
        return text.replace(/[&<>"']/g,
            m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])
        );
    }

    // --- Render feed/profile
    await renderFeed();
    await renderMyPosts();

    // --- Add page: camera + upload + geo + publish
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const snap = document.getElementById('snap');
    const file = document.getElementById('file');
    const caption = document.getElementById('caption');
    const publish = document.getElementById('publish');
    const clear = document.getElementById('clear');
    const geoEl = document.getElementById('geo');
    const camPlaceholder = document.getElementById('cam-placeholder');

    let currentPhoto = null;
    let currentGeo = null;

    // Try to start camera
    async function startCamera(){
        if (!video) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            video.onloadedmetadata = () => { camPlaceholder && (camPlaceholder.style.display='none'); };
        } catch(e){
            console.warn('Camera not available', e);
            camPlaceholder && (camPlaceholder.style.display='block');
        }
    }
    startCamera();

    if (snap) snap.onclick = () => {
        if (!video || !video.videoWidth) { alert('Camera is not ready'); return; }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video,0,0);
        currentPhoto = canvas.toDataURL('image/png');
        alert('Photo ready. Click Publish.');
    };

    if (file) file.onchange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
            currentPhoto = reader.result;
            alert('File uploaded. Click Publish.');
        };
        reader.readAsDataURL(f);
    };

    if (document.getElementById('get-loc')) {
        document.getElementById('get-loc').onclick = () => {
            if (!navigator.geolocation) { geoEl.textContent = 'Geolocation is not supported'; return; }
            geoEl.textContent = 'Getting location...';
            navigator.geolocation.getCurrentPosition(pos => {
                currentGeo = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                geoEl.textContent = `Coordinates: ${currentGeo.lat.toFixed(4)}, ${currentGeo.lon.toFixed(4)}`;
            }, err => {
                geoEl.textContent = 'Geolocation error: ' + err.message;
            }, { timeout:10000, enableHighAccuracy:true });
        };
    }

    if (publish) publish.onclick = async () => {
        if (!currentPhoto) { alert('Take a photo or upload a file first'); return; }
        const post = {
            id: 'p_'+Date.now(),
            ts: Date.now(),
            data: currentPhoto,
            caption: caption.value || '',
            geo: currentGeo,
            likes: 0
        };
        await dbAdd(post);
        caption.value='';
        currentPhoto=null;
        currentGeo=null;
        if (geoEl) geoEl.textContent='';
        alert('Published locally');
        location.href = 'index.html';
    };

    if (clear) clear.onclick = () => {
        caption.value='';
        currentPhoto=null;
        currentGeo=null;
        if (geoEl) geoEl.textContent='';
    };

    window.addEventListener('focus', async ()=>{ await renderFeed(); await renderMyPosts(); });
})();
