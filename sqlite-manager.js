// ============================================================
// sqlite-manager.js - SQL.js + OPFS Manager for ramz-App
// ============================================================

let SQL = null; // سيتم تحميله من sql-wasm.js
let db = null;  // كائن قاعدة البيانات

/**
 * تهيئة SQLite:
 * 1. تحميل sql.js (يجب أن يكون محمّلاً في index.html قبله)
 * 2. فتح قاعدة البيانات من OPFS أو إنشائها
 * 3. إنشاء جميع الجداول إذا لم تكن موجودة
 * 4. الحفظ الأولي
 */
async function initSQLite() {
    try {
        // تحقق من وجود sql-wasm
        if (typeof initSqlJs === 'undefined') {
            throw new Error('مكتبة sql.js غير محملة. تأكد من تضمين <script src="sql-wasm.js"> في index.html');
        }

        // تحميل المحرك
        SQL = await initSqlJs({
            locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.11.0/dist/${file}`
        });

        console.log('✅ SQL.js loaded');

        // فتح أو إنشاء قاعدة البيانات من OPFS
        let buffer = null;
        let useOPFS = false;

        if (navigator.storage && navigator.storage.getDirectory) {
            try {
                const opfsRoot = await navigator.storage.getDirectory();
                let fileHandle;
                try {
                    fileHandle = await opfsRoot.getFileHandle('ramzapp.db');
                } catch (e) {
                    // الملف غير موجود، سننشئه لاحقاً
                    fileHandle = await opfsRoot.getFileHandle('ramzapp.db', { create: true });
                }

                const file = await fileHandle.getFile();
                if (file.size > 0) {
                    buffer = await file.arrayBuffer();
                    console.log('✅ تم تحميل قاعدة البيانات من OPFS، الحجم:', file.size, 'بايت');
                } else {
                    console.log('ℹ️ ملف قاعدة البيانات فارغ، سيتم إنشاء جديد');
                }
                useOPFS = true;
            } catch (e) {
                console.warn('⚠️ تعذر الوصول إلى OPFS:', e.message, '- سيتم استخدام الذاكرة فقط (ستفقد البيانات عند إغلاق الصفحة)');
            }
        } else {
            console.warn('⚠️ المتصفح لا يدعم OPFS. قاعدة البيانات لن تبقى بعد إغلاق الصفحة.');
        }

        // إنشاء كائن قاعدة البيانات
        if (buffer && buffer.byteLength > 0) {
            db = new SQL.Database(new Uint8Array(buffer));
        } else {
            db = new SQL.Database();
        }

        // إنشاء الجداول الأساسية (إذا لم تكن موجودة)
        db.run(`
            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                avatar TEXT DEFAULT '',
                last_seen TEXT,
                is_online INTEGER DEFAULT 0,
                unread INTEGER DEFAULT 0,
                is_pinned INTEGER DEFAULT 0,
                bio TEXT DEFAULT '',
                last_msg TEXT DEFAULT '',
                last_time TEXT
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT,
                sender_id TEXT,
                reply_to TEXT,
                text TEXT,
                media_type TEXT,
                media_url TEXT,
                voice_duration TEXT,
                created_at TEXT,
                status TEXT DEFAULT 'sent',
                likes INTEGER DEFAULT 0,
                liked INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS stories (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                media_url TEXT,
                text_content TEXT,
                created_at TEXT,
                expires_at TEXT
            );

            CREATE TABLE IF NOT EXISTS channels (
                id TEXT PRIMARY KEY,
                name TEXT,
                avatar TEXT,
                followers INTEGER DEFAULT 0,
                update_info TEXT
            );

            CREATE TABLE IF NOT EXISTS calls (
                id TEXT PRIMARY KEY,
                caller_id TEXT,
                receiver_id TEXT,
                type TEXT,
                status TEXT,
                duration INTEGER DEFAULT 0,
                started_at TEXT
            );

            CREATE TABLE IF NOT EXISTS contacts (
                user_id TEXT,
                contact_id TEXT,
                nickname TEXT,
                is_pinned INTEGER DEFAULT 0,
                added_at TEXT,
                PRIMARY KEY (user_id, contact_id)
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS media_files (
                id TEXT PRIMARY KEY,
                blob_data BLOB,
                mime_type TEXT
            );

            CREATE TABLE IF NOT EXISTS pending_queue (
                id TEXT PRIMARY KEY,
                chat_id TEXT,
                sender_id TEXT,
                text TEXT,
                media_file_id TEXT,
                created_at TEXT,
                retries INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS catalog (
                id TEXT PRIMARY KEY,
                name TEXT,
                price TEXT,
                icon TEXT
            );
        `);

        // حفظ فوري للهيكل (إذا كنا نستخدم OPFS)
        if (useOPFS) {
            await saveDBToOPFS();
        }

        console.log('✅ SQLite database initialized with all tables');
    } catch (err) {
        console.error('❌ فشل تهيئة SQLite:', err);
        alert('حدث خطأ أثناء تحميل قاعدة البيانات. قد لا يكون المتصفح مدعوماً. حاول استخدام Chrome أو Edge.');
    }
}

/**
 * حفظ قاعدة البيانات الحالية إلى OPFS (ذاكرة الهاتف الداخلية)
 */
async function saveDBToOPFS() {
    if (!db) return;
    try {
        if (!navigator.storage || !navigator.storage.getDirectory) {
            console.warn('OPFS غير مدعوم، لا يمكن الحفظ');
            return;
        }

        const data = db.export();
        const opfsRoot = await navigator.storage.getDirectory();
        const fileHandle = await opfsRoot.getFileHandle('ramzapp.db', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
        console.log('💾 تم حفظ قاعدة البيانات إلى ذاكرة الهاتف');
    } catch (err) {
        console.error('فشل حفظ قاعدة البيانات إلى OPFS:', err);
    }
}

/**
 * تنفيذ استعلام SELECT وإرجاع النتائج كمصفوفة من الكائنات
 * @param {string} sql - استعلام SQL
 * @param {Array} params - معاملات الاستعلام
 * @returns {Array} - نتائج الاستعلام
 */
function sqlQuery(sql, params = []) {
    if (!db) {
        console.error('قاعدة البيانات غير مهيأة');
        return [];
    }
    try {
        const stmt = db.prepare(sql);
        if (params.length > 0) {
            stmt.bind(params);
        }
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
    } catch (err) {
        console.error('خطأ في الاستعلام:', sql, params, err);
        return [];
    }
}

/**
 * تنفيذ أمر SQL (INSERT, UPDATE, DELETE) مع حفظ تلقائي
 * @param {string} sql - أمر SQL
 * @param {Array} params - معاملات الأمر
 */
function sqlRun(sql, params = []) {
    if (!db) {
        console.error('قاعدة البيانات غير مهيأة');
        return;
    }
    try {
        db.run(sql, params);
        // حفظ تلقائي بعد التعديل
        saveDBToOPFS();
    } catch (err) {
        console.error('خطأ في تنفيذ الأمر:', sql, params, err);
    }
}

/**
 * تخزين ملف (صورة/فيديو/صوت) في قاعدة البيانات
 * @param {string} id - معرف فريد للملف
 * @param {Blob} blob - محتوى الملف
 * @param {string} mimeType - نوع الملف (مثل image/png)
 */
async function saveMediaFile(id, blob, mimeType) {
    if (!db) return;
    try {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        sqlRun('INSERT OR REPLACE INTO media_files (id, blob_data, mime_type) VALUES (?, ?, ?)', [id, uint8, mimeType]);
        console.log('📁 تم حفظ الوسائط:', id, mimeType);
    } catch (err) {
        console.error('فشل حفظ الوسائط:', err);
    }
}

/**
 * استرجاع ملف من قاعدة البيانات
 * @param {string} id - معرف الملف
 * @returns {Blob|null} - الملف المسترجع
 */
function getMediaFile(id) {
    if (!db || !id) return null;
    try {
        const rows = sqlQuery('SELECT blob_data, mime_type FROM media_files WHERE id = ?', [id]);
        if (rows.length > 0) {
            const uint8 = new Uint8Array(rows[0].blob_data);
            const mimeType = rows[0].mime_type || 'application/octet-stream';
            return new Blob([uint8], { type: mimeType });
        }
        return null;
    } catch (err) {
        console.error('فشل استرجاع الوسائط:', id, err);
        return null;
    }
}

/**
 * حذف ملف من قاعدة البيانات
 * @param {string} id - معرف الملف
 */
function deleteMediaFile(id) {
    sqlRun('DELETE FROM media_files WHERE id = ?', [id]);
}

/**
 * تفريغ قاعدة البيانات بالكامل (إعادة ضبط)
 */
async function resetDatabase() {
    if (!db) return;
    const tables = ['chats', 'messages', 'stories', 'channels', 'calls', 'contacts', 'settings', 'media_files', 'pending_queue', 'catalog'];
    for (const table of tables) {
        db.run(`DELETE FROM ${table}`);
    }
    await saveDBToOPFS();
    console.log('🗑️ تم تفريغ جميع الجداول');
}

/**
 * تصدير قاعدة البيانات كملف (للنسخ الاحتياطي)
 * @returns {Blob} - ملف قاعدة البيانات
 */
function exportDatabase() {
    if (!db) return null;
    const data = db.export();
    return new Blob([data], { type: 'application/octet-stream' });
}

/**
 * استيراد قاعدة البيانات من ملف
 * @param {ArrayBuffer} buffer - محتوى الملف
 */
async function importDatabase(buffer) {
    if (!SQL) return;
    db = new SQL.Database(new Uint8Array(buffer));
    await saveDBToOPFS();
    console.log('📥 تم استيراد قاعدة البيانات');
}

// جعل الدوال متاحة عالمياً
window.initSQLite = initSQLite;
window.sqlQuery = sqlQuery;
window.sqlRun = sqlRun;
window.saveMediaFile = saveMediaFile;
window.getMediaFile = getMediaFile;
window.deleteMediaFile = deleteMediaFile;
window.resetDatabase = resetDatabase;
window.exportDatabase = exportDatabase;
window.importDatabase = importDatabase;
window.saveDBToOPFS = saveDBToOPFS;
