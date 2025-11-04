const DB_NAME = 'mini-gram';
const DB_VER = 2;
const STORE_POSTS = 'posts';
const STORE_USERS = 'users';

function openDb() {
    return new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_POSTS)) {
                const os = db.createObjectStore(STORE_POSTS, { keyPath: 'id' });
                os.createIndex('ts', 'ts');
            }
            if (!db.objectStoreNames.contains(STORE_USERS)) {
                const us = db.createObjectStore(STORE_USERS, { keyPath: 'username' });
            }
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}

// ---- USERS ----
async function dbAddUser(user) {
    const db = await openDb();
    return new Promise((res, rej) => {
        const tx = db.transaction(STORE_USERS, 'readwrite');
        tx.objectStore(STORE_USERS).add(user);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
    });
}

async function dbGetUser(username) {
    const db = await openDb();
    return new Promise((res, rej) => {
        const tx = db.transaction(STORE_USERS, 'readonly');
        const req = tx.objectStore(STORE_USERS).get(username);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}

// ---- POSTS ----
async function dbAdd(post) {
    const db = await openDb();
    return new Promise((res, rej) => {
        const tx = db.transaction(STORE_POSTS, 'readwrite');
        tx.objectStore(STORE_POSTS).add(post);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
    });
}

async function dbPut(post) {
    const db = await openDb();
    return new Promise((res, rej) => {
        const tx = db.transaction(STORE_POSTS, 'readwrite');
        tx.objectStore(STORE_POSTS).put(post);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
    });
}

async function dbGetAll() {
    const db = await openDb();
    return new Promise((res, rej) => {
        const tx = db.transaction(STORE_POSTS, 'readonly');
        const req = tx.objectStore(STORE_POSTS).index('ts').openCursor(null, 'prev');
        const out = [];
        req.onsuccess = e => {
            const cur = e.target.result;
            if (cur) { out.push(cur.value); cur.continue(); } else res(out);
        };
        req.onerror = () => rej(req.error);
    });
}

async function dbDelete(id) {
    const db = await openDb();
    return new Promise((res, rej) => {
        const tx = db.transaction(STORE_POSTS, 'readwrite');
        tx.objectStore(STORE_POSTS).delete(id);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
    });
}
