/* db.js — improved IndexedDB wrapper with validation & timeouts
   - Błąd 35: Добавлен таймаут для всех операций (withTimeout)
   - Błąd 34: Добавлена валидация структуры поста (validatePost)
   - Błąd 33: Улучшена обработка ошибок на уровне запросов (req.onerror)
*/
'use strict';

const DB_NAME = 'mini-gram';
const DB_VER = 2;
const STORE_POSTS = 'posts';
const STORE_USERS = 'users';

/* ============================================
   TIMEOUT HELPER (Błąd 35)
   ============================================ */

/**
 * Оборачивает Promise, добавляя механизм таймаута.
 * @param {Promise} promise - Промис, который нужно обернуть.
 * @param {number} ms - Время ожидания в миллисекундах.
 */
function withTimeout(promise, ms = 6000) {
    // Операция проиграет гонку, если таймаут истечёт раньше, чем выполнится промис
    return Promise.race([
        promise,
        new Promise((_, rej) => setTimeout(() => rej(new Error('IndexedDB Operation Timed out')), ms))
    ]);
}

/**
 * Открывает соединение с IndexedDB, используя таймаут.
 */
function openDb() {
    return withTimeout(new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, DB_VER);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            // Создание хранилища для постов
            if (!db.objectStoreNames.contains(STORE_POSTS)) {
                const os = db.createObjectStore(STORE_POSTS, { keyPath: 'id' });
                os.createIndex('ts', 'ts');
            }
            // Создание хранилища для пользователей (если используется)
            if (!db.objectStoreNames.contains(STORE_USERS)) {
                db.createObjectStore(STORE_USERS, { keyPath: 'username' });
            }
        };

        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error || new Error('IndexedDB open error'));
    }), 7000);
}

/* ============================================
   POSTS & USERS VALIDATION (Błąd 34)
   ============================================ */

/**
 * Błąd 34: Валидация структуры объекта поста перед записью.
 * @param {object} p - Объект поста.
 */
function validatePost(p) {
    if (!p || !p.id || !p.ts || !p.data) {
        throw new Error('Invalid post structure: missing required fields (id, ts, data)');
    }
    if (typeof p.id !== 'string') {
        throw new Error('Post id must be a string');
    }
}

/* ============================================
   USERS CRUD
   ============================================ */

async function dbAddUser(user) {
    if (!user || !user.username) throw new Error('Invalid user object');
    const db = await openDb();
    return withTimeout(new Promise((res, rej) => {
        const tx = db.transaction(STORE_USERS, 'readwrite');
        const store = tx.objectStore(STORE_USERS);
        const req = store.add(user);

        req.onsuccess = () => res(true);
        // Błąd 33: Детализированная обработка ошибок
        req.onerror = (e) => rej(e.target?.error || new Error('dbAddUser error'));
        tx.onabort = () => rej(new Error('Transaction aborted'));
    }), 5000);
}

async function dbGetUser(username) {
    if (!username) return null;
    const db = await openDb();
    return withTimeout(new Promise((res, rej) => {
        const tx = db.transaction(STORE_USERS, 'readonly');
        const req = tx.objectStore(STORE_USERS).get(username);

        req.onsuccess = () => res(req.result || null);
        // Błąd 33: Детализированная обработка ошибок
        req.onerror = (e) => rej(e.target?.error || new Error('dbGetUser error'));
    }), 5000);
}

/* ============================================
   POSTS CRUD
   ============================================ */

async function dbAdd(post) {
    validatePost(post); // Błąd 34
    const db = await openDb();
    return withTimeout(new Promise((res, rej) => {
        const tx = db.transaction(STORE_POSTS, 'readwrite');
        const store = tx.objectStore(STORE_POSTS);
        const req = store.add(post);

        req.onsuccess = () => res(true);
        // Błąd 33: Детализированная обработка ошибок (например, duplicate key)
        req.onerror = (e) => rej(e.target?.error || new Error('dbAdd error'));
    }), 7000);
}

async function dbPut(post) {
    validatePost(post); // Błąd 34
    const db = await openDb();
    return withTimeout(new Promise((res, rej) => {
        const tx = db.transaction(STORE_POSTS, 'readwrite');
        const req = tx.objectStore(STORE_POSTS).put(post);

        req.onsuccess = () => res(true);
        // Błąd 33: Детализированная обработка ошибок
        req.onerror = (e) => rej(e.target?.error || new Error('dbPut error'));
    }), 7000);
}

async function dbGetAll() {
    const db = await openDb();
    return withTimeout(new Promise((res, rej) => {
        const tx = db.transaction(STORE_POSTS, 'readonly');
        const idx = tx.objectStore(STORE_POSTS).index('ts');
        const req = idx.openCursor(null, 'prev');
        const out = [];

        req.onsuccess = (e) => {
            const cur = e.target.result;
            if (cur) { out.push(cur.value); cur.continue(); }
            else res(out);
        };
        // Błąd 33: Детализированная обработка ошибок
        req.onerror = (e) => rej(e.target?.error || new Error('dbGetAll error'));
    }), 7000);
}

async function dbDelete(id) {
    if (!id) throw new Error('dbDelete requires id');
    const db = await openDb();
    return withTimeout(new Promise((res, rej) => {
        const tx = db.transaction(STORE_POSTS, 'readwrite');
        const req = tx.objectStore(STORE_POSTS).delete(id);

        req.onsuccess = () => res(true);
        // Błąd 33: Детализированная обработка ошибок
        req.onerror = (e) => rej(e.target?.error || new Error('dbDelete error'));
    }), 5000);
}