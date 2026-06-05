// ============================================================
// common.js - ramz-App Main Logic (SQLite + Supabase + PWA + WebSocket)
// الإصدار النهائي الكامل - جميع الميزات مفعّلة
// ============================================================

// ---------- إعداد Supabase ----------
const SUPABASE_URL = 'https://serlegwdzjulfcxabxzv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4_c97KxnG_7HTvfv-pKeNQ_FTlnK6Yx';
const STORAGE_BUCKET = 'ramz-images';

let supabase = null;
try {
    if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase connected');
    } else {
        console.warn('⚠️ Supabase client not loaded, cloud sync disabled');
    }
} catch (e) {
    console.error('Supabase init error:', e);
}

// ---------- نظام الأيقونات الاحتياطي ----------
function handleIconFail() {
    console.warn('⚠️ Font Awesome failed - activating fallback');
    document.body.classList.add('icons-failed');
    setTimeout(() => {
        const alt = document.createElement('link');
        alt.rel = 'stylesheet';
        alt.href = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css';
        alt.onload = () => {
            document.body.classList.remove('icons-failed');
            console.log('✅ Icons loaded from alternative source');
        };
        alt.onerror = () => console.warn('❌ Alternative icon source also failed');
        document.head.appendChild(alt);
    }, 1500);
}
window.addEventListener('load', () => {
    setTimeout(() => {
        const test = document.querySelector('.fa-cog');
        if (test) {
            const style = window.getComputedStyle(test, '::before');
            const content = style.getPropertyValue('content');
            if (!content || content === 'none' || content === '""') {
                document.body.classList.add('icons-failed');
            }
        }
    }, 800);
});

// ---------- اختصارات DOM ----------
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ---------- دوال مساعدة ----------
const timeAgo = d => {
    const df = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (df < 60) return 'الآن';
    if (df < 3600) return Math.floor(df / 60) + ' د';
    if (df < 86400) return Math.floor(df / 3600) + ' س';
    return Math.floor(df / 86400) + ' يوم';
};
const fmtTime = d => {
    try { return new Date(d).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
};
const fmtDate = d => {
    try { return new Date(d).toLocaleDateString('ar-SA', { weekday: 'long', month: 'long', day: 'numeric' }); } catch (e) { return ''; }
};
const esc = s => s ? s.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]) : '';
const genId = () => 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
const toast = (m, d = 2000) => {
    const t = $('#toast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), d);
};

// ---------- حالة التطبيق ----------
let DB = {
    user: null,
    chats: [],
    messages: {},
    stories: [],
    channels: [],
    calls: [],
    catalog: [],
    theme: 'dark',
    notifications: true,
    cloudSyncEnabled: false,
    lastCloudSync: null
};

// ---------- دوال تحميل/حفظ من SQLite ----------
async function loadFromSQLite() {
    const userRows = sqlQuery("SELECT value FROM settings WHERE key='user'");
    if (userRows.length) {
        try { DB.user = JSON.parse(userRows[0].value); } catch (e) { DB.user = null; }
    }
    const themeRows = sqlQuery("SELECT value FROM settings WHERE key='theme'");
    if (themeRows.length) DB.theme = themeRows[0].value;
    const notifRows = sqlQuery("SELECT value FROM settings WHERE key='notifications'");
    if (notifRows.length) DB.notifications = JSON.parse(notifRows[0].value);
    const cloudRows = sqlQuery("SELECT value FROM settings WHERE key='cloudSyncEnabled'");
    if (cloudRows.length) DB.cloudSyncEnabled = JSON.parse(cloudRows[0].value);

    DB.chats = sqlQuery("SELECT * FROM chats ORDER BY is_pinned DESC, last_time DESC");

    DB.messages = {};
    for (let c of DB.chats) {
        DB.messages[c.id] = [];
    }

    DB.stories = sqlQuery("SELECT * FROM stories WHERE expires_at > datetime('now')");
    DB.channels = sqlQuery("SELECT * FROM channels");
    DB.calls = sqlQuery("SELECT * FROM calls ORDER BY started_at DESC");
    DB.catalog = sqlQuery("SELECT * FROM catalog");
}

async function saveUserToSQLite() {
    if (DB.user) {
        sqlRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('user', ?)", [JSON.stringify(DB.user)]);
    }
}
async function saveSettingsToSQLite() {
    sqlRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)", [DB.theme]);
    sqlRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('notifications', ?)", [JSON.stringify(DB.notifications)]);
    sqlRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('cloudSyncEnabled', ?)", [JSON.stringify(DB.cloudSyncEnabled)]);
}
async function saveDB() {
    await saveSettingsToSQLite();
    if (DB.user) await saveUserToSQLite();
}

async function loadMessagesForChat(chatId) {
    if (!chatId) return;
    DB.messages[chatId] = sqlQuery("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC", [chatId]);
}

// ---------- بذر البيانات ----------
async function seedSQLiteIfEmpty() {
    const count = sqlQuery("SELECT COUNT(*) as cnt FROM chats")[0]?.cnt || 0;
    if (count > 0) return;

    const now = new Date().toISOString();
    const chats = [
        { id: 'c1', name: 'شعلان', avatar: 'ش', is_online: 1, last_seen: 'الآن', unread: 2, is_pinned: 1, bio: 'صديق قديم 🌟', last_msg: 'أراك لاحقاً', last_time: new Date(Date.now() - 1800000).toISOString() },
        { id: 'c2', name: 'ترف', avatar: 'ت', is_online: 0, last_seen: 'آخر ظهور 10:30', unread: 0, is_pinned: 0, bio: 'مهندسة 💼', last_msg: 'تم إرسال الملف', last_time: new Date(Date.now() - 7200000).toISOString() },
        { id: 'c3', name: 'زينة', avatar: 'ز', is_online: 1, last_seen: 'الآن', unread: 1, is_pinned: 0, bio: 'أختي 🌸', last_msg: 'بابا ينتظرك', last_time: now },
        { id: 'c4', name: 'وليد', avatar: 'و', is_online: 0, last_seen: 'أمس', unread: 0, is_pinned: 0, bio: '+966715303132', last_msg: 'موعد الغداء غداً', last_time: new Date(Date.now() - 86400000).toISOString() }
    ];
    for (let c of chats) {
        sqlRun("INSERT INTO chats VALUES (?,?,?,?,?,?,?,?,?,?)", [c.id, c.name, c.avatar, c.last_seen, c.is_online, c.unread, c.is_pinned, c.bio, c.last_msg, c.last_time]);
    }
    const msgs = [
        { id: 'm1', chat_id: 'c1', sender_id: 'c1', text: 'السلام عليكم أكرم', created_at: '2026-06-05T10:20:00', status: 'read' },
        { id: 'm2', chat_id: 'c1', sender_id: 'me', text: 'وعليكم السلام شعلان', created_at: '2026-06-05T10:21:00', status: 'read' },
        { id: 'm3', chat_id: 'c1', sender_id: 'c1', text: 'أراك لاحقاً', created_at: '2026-06-05T10:30:00', status: 'delivered' },
        { id: 'm4', chat_id: 'c2', sender_id: 'me', text: 'أرسلي الملف لو سمحتِ', created_at: '2026-06-05T09:10:00', status: 'read' },
        { id: 'm5', chat_id: 'c2', sender_id: 'c2', text: 'تم إرسال الملف', created_at: '2026-06-05T09:15:00', status: 'delivered' },
        { id: 'm6', chat_id: 'c3', sender_id: 'c3', text: 'أكرم، بابا ينتظرك في البيت', created_at: now, status: 'read' },
        { id: 'm7', chat_id: 'c4', sender_id: 'me', text: 'الغداء غداً الساعة 2؟', created_at: new Date(Date.now() - 90000000).toISOString(), status: 'read' },
        { id: 'm8', chat_id: 'c4', sender_id: 'c4', text: 'نعم، موعد الغداء غداً', created_at: new Date(Date.now() - 86400000).toISOString(), status: 'delivered' }
    ];
    for (let m of msgs) {
        sqlRun("INSERT INTO messages (id, chat_id, sender_id, text, created_at, status) VALUES (?,?,?,?,?,?)", [m.id, m.chat_id, m.sender_id, m.text, m.created_at, m.status]);
    }
    sqlRun("INSERT INTO stories (id, user_id, text_content, created_at, expires_at) VALUES ('s1','شعلان','صباح الخير ☀️',datetime('now'),datetime('now','+1 day'))");
    sqlRun("INSERT INTO stories (id, user_id, text_content, created_at, expires_at) VALUES ('s2','ترف','يوم جديد 🏙️',datetime('now'),datetime('now','+1 day'))");
    sqlRun("INSERT INTO channels (id, name, avatar, followers, update_info) VALUES ('ch1','أخبار التقنية','📰',1240,'منذ ساعة')");
    sqlRun("INSERT INTO channels (id, name, avatar, followers, update_info) VALUES ('ch2','رياضة اليوم','⚽',892,'منذ 3 ساعات')");
    sqlRun("INSERT INTO calls (id, caller_id, receiver_id, type, status, duration, started_at) VALUES ('ca1','c1','me','voice','answered',120,'2026-06-05T10:35:00')");
    sqlRun("INSERT INTO calls (id, caller_id, receiver_id, type, status, duration, started_at) VALUES ('ca2','me','c2','voice','missed',0,'2026-06-04T18:15:00')");
    sqlRun("INSERT INTO catalog (id, name, price, icon) VALUES ('cat1','تصميم واجهات','50 ر.س','🎨')");
    sqlRun("INSERT INTO catalog (id, name, price, icon) VALUES ('cat2','تطوير مواقع','200 ر.س','💻')");
    sqlRun("INSERT INTO catalog (id, name, price, icon) VALUES ('cat3','استشارة تقنية','100 ر.س','📋')");
    sqlRun("INSERT INTO catalog (id, name, price, icon) VALUES ('cat4','تدريب خاص','150 ر.س','🎓')");

    console.log('🌱 تم بذر البيانات الأولية');
}

// ---------- تطبيق الثيم ----------
function applyTheme() {
    document.body.classList.toggle('light-theme', DB.theme === 'light');
    const ts = $('#themeSwitch');
    if (ts) ts.classList.toggle('active', DB.theme === 'dark');
}

// ---------- مصادقة Supabase ----------
let authUser = null;

async function checkSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
        authUser = data.session.user;
        return authUser;
    }
    return null;
}
async function signUp(email, password, name) {
    if (!supabase) return { error: 'Supabase غير متصل' };
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
    return { data, error };
}
async function signIn(email, password) {
    if (!supabase) return { error: 'Supabase غير متصل' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
}
async function signOutUser() {
    if (supabase) await supabase.auth.signOut();
    authUser = null;
}

// ---------- واجهة تسجيل الدخول ----------
function showLoginScreen() {
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('loginScreen').classList.remove('hidden');
    showGuestSection();
}
function showGuestSection() {
    $('#loginGuest').style.display = 'block';
    $('#loginEmailSection').style.display = 'none';
    $('#registerSection').style.display = 'none';
}
function showEmailSection() {
    $('#loginGuest').style.display = 'none';
    $('#loginEmailSection').style.display = 'block';
    $('#registerSection').style.display = 'none';
}
function showRegisterSection() {
    $('#loginGuest').style.display = 'none';
    $('#loginEmailSection').style.display = 'none';
    $('#registerSection').style.display = 'block';
}

async function loginAsGuest() {
    const name = $('#loginNameInput').value.trim();
    if (!name) return toast('⚠️ أدخل اسماً');
    DB.user = { id: 'me', name, avatar: name.charAt(0), isGuest: true };
    await saveUserToSQLite();
    await saveDB();
    enterApp();
}
async function loginWithEmail() {
    const email = $('#loginEmail').value.trim();
    const password = $('#loginPassword').value;
    if (!email || !password) return toast('⚠️ أكمل البيانات');
    const { data, error } = await signIn(email, password);
    if (error) return toast('❌ ' + error.message);
    authUser = data.user;
    const displayName = authUser.user_metadata?.display_name || email.split('@')[0];
    DB.user = { id: authUser.id, name: displayName, avatar: displayName.charAt(0), email, isGuest: false };
    await saveUserToSQLite();
    await saveDB();
    enterApp();
}
async function registerUser() {
    const name = $('#registerName').value.trim();
    const email = $('#registerEmail').value.trim();
    const password = $('#registerPassword').value;
    const confirm = $('#registerConfirmPassword').value;
    if (!name || !email || !password) return toast('⚠️ أكمل الحقول');
    if (password !== confirm) return toast('⚠️ كلمتا المرور غير متطابقتين');
    const { data, error } = await signUp(email, password, name);
    if (error) return toast('❌ ' + error.message);
    if (data.user) {
        toast('✅ تم إنشاء الحساب! سجل دخولك الآن');
        showEmailSection();
    } else {
        toast('📧 تم إرسال بريد تأكيد. تحقق من بريدك.');
    }
}
function enterApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appContainer').style.display = 'flex';
    document.getElementById('bottomNav').style.display = 'flex';
    showScreen('chats');
    toast('👋 أهلاً ' + DB.user.name);
}

// ---------- متغيرات التشغيل ----------
let currentChatId = null, replyTarget = null, pendingImg = null, pendingVoice = null, pendingFile = null;
let selectedModalUser = null, currentScreen = 'chats';
let isRecording = false, mediaRecorder = null, recordingChunks = [];
let callInterval = null, callSeconds = 0;
let storyInterval = null, storyIndex = 0;
let typingTimeout = null;

const screens = ['chatsScreen', 'chatScreen', 'callsScreen', 'updatesScreen', 'toolsScreen', 'profileScreen', 'settingsScreen'];

// ---------- التنقل بين الشاشات ----------
function showScreen(id) {
    currentScreen = id;
    screens.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.remove('active');
    });
    const target = document.getElementById(id + 'Screen') || document.getElementById(id);
    if (target) target.classList.add('active');

    const noNav = ['chatScreen', 'profileScreen', 'settingsScreen'];
    const bottomNav = $('#bottomNav');
    if (bottomNav) bottomNav.style.display = noNav.includes(id) || noNav.includes(id + 'Screen') ? 'none' : 'flex';

    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.nav === id));

    if (id === 'chats') renderChats();
    if (id === 'calls') renderCalls();
    if (id === 'updates') { renderStories(); renderChannels(); }
    updateStats();

    if (window._catalogScreen && id !== 'catalogTemp') {
        window._catalogScreen.remove();
        window._catalogScreen = null;
    }
}
$$('.nav-item').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.nav)));

function updateStats() {
    const total = Object.values(DB.messages).flat().length;
    const sv = $('#statViews'); if (sv) sv.textContent = total + Math.floor(Math.random() * 100);
    const sc = $('#statCatalog'); if (sc) sc.textContent = DB.catalog.length + Math.floor(Math.random() * 20);
    const sch = $('#statChats'); if (sch) sch.textContent = DB.chats.length;
}

// ---------- شاشة الدردشات ----------
function renderChats(filter = '') {
    const container = $('#chatsList');
    let chats = [...DB.chats].sort((a, b) => (b.is_pinned - a.is_pinned) || (new Date(b.last_time) - new Date(a.last_time)));
    if (filter) {
        const q = filter.toLowerCase();
        chats = chats.filter(c => c.name.toLowerCase().includes(q));
    }
    container.innerHTML = chats.length ? '' : '<div class="empty-state"><span class="empty-icon">💬</span><p>لا توجد محادثات</p></div>';
    chats.forEach(c => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        const isTyping = c._typing && (Date.now() - c._typing < 5000);
        div.innerHTML = `
            <div class="chat-avatar">${c.avatar}${c.is_online ? '<span class="online-dot"></span>' : ''}</div>
            <div class="chat-info">
                <div class="chat-name-row"><span class="chat-name">${c.is_pinned ? '📌 ' : ''}${esc(c.name)}</span><span class="chat-time">${c.last_time ? timeAgo(c.last_time) : ''}</span></div>
                <div class="chat-preview">
                    <span class="last-msg">${isTyping ? '<span class="typing-indicator-chat">يكتب...</span>' : esc((c.last_msg || '👋 ابدأ').substring(0, 35))}</span>
                    ${c.unread > 0 ? `<span class="unread-badge">${c.unread}</span>` : '<span class="check-mark read">✓✓</span>'}
                </div>
            </div>`;
        div.addEventListener('click', e => {
            if (e.target.closest('.chat-avatar')) openUserModal(c);
            else openChat(c.id);
        });
        container.appendChild(div);
    });
}
$('#searchChatsInput')?.addEventListener('input', e => renderChats(e.target.value));
$('#searchBtn')?.addEventListener('click', () => { $('#searchChatsInput').focus(); showScreen('chats'); });
$('#settingsBtn')?.addEventListener('click', () => showScreen('settings'));
$('#mainMenuBtn')?.addEventListener('click', () => showPopup([
    { icon: '👥', label: 'مجموعة جديدة', action: () => createGroup() },
    { icon: '📣', label: 'الرسائل الجماعية', action: () => broadcastMessage() },
    { icon: '⚙️', label: 'الإعدادات', action: () => showScreen('settings') },
    { icon: '🚪', label: 'تسجيل الخروج', action: () => logout(), danger: true }
]));

function showPopup(items) {
    const menu = $('#popupMenu');
    menu.innerHTML = items.map(i => `<div class="popup-item${i.danger ? ' danger' : ''}"><span class="popup-icon">${i.icon}</span>${i.label}</div>`).join('');
    $('#popupOverlay').classList.add('active');
    menu.querySelectorAll('.popup-item').forEach((el, idx) => el.addEventListener('click', () => {
        items[idx].action();
        $('#popupOverlay').classList.remove('active');
    }));
}
$('#popupOverlay')?.addEventListener('click', e => { if (e.target === $('#popupOverlay')) $('#popupOverlay').classList.remove('active'); });

function createGroup() {
    const name = prompt('اسم المجموعة:');
    if (name && name.trim()) {
        const gid = 'g' + Date.now();
        const now = new Date().toISOString();
        sqlRun("INSERT INTO chats (id, name, avatar, is_online, last_seen, unread, is_pinned, bio, last_msg, last_time) VALUES (?,?,?,?,?,?,?,?,?,?)",
            [gid, name.trim(), '👥', 1, 'الآن', 0, 0, 'مجموعة جديدة', '', now]);
        DB.chats = sqlQuery("SELECT * FROM chats ORDER BY is_pinned DESC, last_time DESC");
        renderChats();
        toast('✅ تم إنشاء المجموعة');
    }
}
function broadcastMessage() {
    const msg = prompt('📣 اكتب الرسالة الجماعية:');
    if (msg && msg.trim() && DB.chats.length) {
        const now = new Date().toISOString();
        DB.chats.forEach(c => {
            const mid = genId();
            sqlRun("INSERT INTO messages (id, chat_id, sender_id, text, created_at, status) VALUES (?,?,?,?,?,?)", [mid, c.id, DB.user?.id || 'me', msg.trim(), now, 'sent']);
            sqlRun("UPDATE chats SET last_msg=?, last_time=? WHERE id=?", [msg.trim(), now, c.id]);
        });
        DB.chats = sqlQuery("SELECT * FROM chats ORDER BY is_pinned DESC, last_time DESC");
        renderChats();
        toast('📣 تم الإرسال للجميع');
    }
}

// ---------- نافذة المستخدم ----------
function openUserModal(user) {
    selectedModalUser = user;
    $('#modalAvatar').textContent = user.avatar || '?';
    $('#modalName').textContent = user.name || 'مستخدم';
    $('#modalBio').textContent = user.bio || 'مرحباً!';
    $('#userModal').classList.add('active');
}
$('#closeModalBtn')?.addEventListener('click', () => $('#userModal').classList.remove('active'));
$('#userModal')?.addEventListener('click', e => { if (e.target === $('#userModal')) $('#userModal').classList.remove('active'); });
$('#modalChatBtn')?.addEventListener('click', () => { if (selectedModalUser) startOrOpenChat(selectedModalUser); $('#userModal').classList.remove('active'); });
$('#modalCallBtn')?.addEventListener('click', () => { if (selectedModalUser) startCall(selectedModalUser, 'voice'); $('#userModal').classList.remove('active'); });
$('#modalVideoBtn')?.addEventListener('click', () => { if (selectedModalUser) startCall(selectedModalUser, 'video'); $('#userModal').classList.remove('active'); });
$('#modalInfoBtn')?.addEventListener('click', () => { if (selectedModalUser) showProfile(selectedModalUser); $('#userModal').classList.remove('active'); });

function startOrOpenChat(user) {
    let chat = DB.chats.find(c => c.id === user.id);
    if (!chat) {
        const now = new Date().toISOString();
        sqlRun("INSERT INTO chats (id, name, avatar, is_online, last_seen, unread, is_pinned, bio, last_msg, last_time) VALUES (?,?,?,?,?,?,?,?,?,?)",
            [user.id, user.name, user.avatar || '?', 1, 'الآن', 0, 0, user.bio || '', '', now]);
        DB.chats = sqlQuery("SELECT * FROM chats ORDER BY is_pinned DESC, last_time DESC");
    }
    openChat(user.id);
}
function showProfile(user) {
    $('#profileAvatar').textContent = user.avatar || '?';
    $('#profileName').textContent = user.name || '';
    $('#profileBio').textContent = user.bio || '';
    $('#profileChatBtn').dataset.userId = user.id;
    showScreen('profile');
}
$('#backFromProfileBtn')?.addEventListener('click', () => showScreen('chats'));
$('#profileChatBtn')?.addEventListener('click', function () {
    const uid = this.dataset.userId;
    if (uid) {
        const u = DB.chats.find(c => c.id === uid) || { id: uid, name: '', avatar: '?' };
        startOrOpenChat(u);
    }
});

// ---------- المكالمات ----------
function startCall(user, type) {
    $('#callAvatar').textContent = user.avatar || '?';
    $('#callStatusText').textContent = type === 'video' ? '📹 جاري الاتصال فيديو...' : '📞 جاري الاتصال...';
    $('#callTimer').textContent = '00:00';
    callSeconds = 0;
    $('#callScreen').classList.add('active');
    const callId = 'ca' + Date.now();
    sqlRun("INSERT INTO calls (id, caller_id, receiver_id, type, status, started_at) VALUES (?,?,?,?,?,?)",
        [callId, DB.user?.id || 'me', user.id, type, 'outgoing', new Date().toISOString()]);
    DB.calls = sqlQuery("SELECT * FROM calls ORDER BY started_at DESC");
    setTimeout(() => {
        $('#callStatusText').textContent = 'متصل 🟢';
        if (callInterval) clearInterval(callInterval);
        callInterval = setInterval(() => {
            callSeconds++;
            const m = Math.floor(callSeconds / 60).toString().padStart(2, '0');
            const s = (callSeconds % 60).toString().padStart(2, '0');
            $('#callTimer').textContent = m + ':' + s;
        }, 1000);
    }, 2000);
}
$('#callEndBtn')?.addEventListener('click', endCall);
$('#callMuteBtn')?.addEventListener('click', function () {
    this.classList.toggle('active');
    this.style.background = this.classList.contains('active') ? '#ff0000' : 'rgba(255,255,255,0.2)';
    toast(this.classList.contains('active') ? '🔇 مكتوم' : '🎤 مفعل');
});
$('#callSpeakerBtn')?.addEventListener('click', function () {
    this.classList.toggle('active');
    this.style.background = this.classList.contains('active') ? '#00a884' : 'rgba(255,255,255,0.2)';
    toast(this.classList.contains('active') ? '🔊 مفعل' : '🔈 معطل');
});
function endCall() {
    if (callInterval) clearInterval(callInterval);
    callInterval = null;
    callSeconds = 0;
    $('#callScreen').classList.remove('active');
    $('#callMuteBtn').style.background = 'rgba(255,255,255,0.2)';
    $('#callSpeakerBtn').style.background = 'rgba(255,255,255,0.2)';
    $('#callMuteBtn').classList.remove('active');
    $('#callSpeakerBtn').classList.remove('active');
    toast('📞 تم إنهاء المكالمة');
}
$('#voiceCallBtn')?.addEventListener('click', () => { const c = DB.chats.find(x => x.id === currentChatId); if (c) startCall(c, 'voice'); });
$('#videoCallBtn')?.addEventListener('click', () => { const c = DB.chats.find(x => x.id === currentChatId); if (c) startCall(c, 'video'); });

// ---------- WebSocket / Realtime اشتراك ----------
function subscribeToChat(chatId) {
    if (!supabase) return;

    // إلغاء أي اشتراكات سابقة
    supabase.removeAllChannels();

    const channel = supabase
        .channel('messages-' + chatId)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`
            },
            async (payload) => {
                const newMsg = payload.new;
                // تجاهل الرسائل التي أرسلها المستخدم الحالي (موجودة محلياً)
                if (newMsg.sender_id === (DB.user?.id || 'me')) return;

                // حفظ الرسالة في SQLite
                sqlRun(`INSERT OR IGNORE INTO messages
                    (id, chat_id, sender_id, text, media_type, media_url, voice_duration, created_at, status)
                    VALUES (?,?,?,?,?,?,?,?,?)`,
                    [newMsg.id, newMsg.chat_id, newMsg.sender_id, newMsg.text,
                     newMsg.media_type, newMsg.media_url, newMsg.voice_duration,
                     newMsg.created_at, 'delivered']);

                // إذا كانت المحادثة مفتوحة، نحدث العرض
                if (currentChatId === chatId) {
                    await loadMessagesForChat(chatId);
                    renderMessages();
                } else {
                    // زيادة عداد غير المقروء
                    sqlRun("UPDATE chats SET unread = unread + 1 WHERE id = ?", [chatId]);
                }
                renderChats();
            }
        )
        .subscribe();

    console.log('✅ Subscribed to chat:', chatId);
}

// ---------- المحادثة ----------
async function openChat(chatId) {
    currentChatId = chatId;
    const c = DB.chats.find(x => x.id === chatId);
    if (!c) return;
    $('#chatNameDisp').textContent = c.name;
    $('#chatAvatar').textContent = c.avatar;
    const st = $('#chatStatusDisp');
    st.textContent = c.is_online ? 'متصل الآن' : c.last_seen;
    st.className = 'chat-header-status' + (c.is_online ? ' online' : '');
    sqlRun("UPDATE chats SET unread=0 WHERE id=?", [chatId]);
    c.unread = 0;
    c._typing = null;
    replyTarget = null;
    pendingImg = null;
    pendingVoice = null;
    pendingFile = null;
    $('#replyBar').style.display = 'none';
    $('#msgInput').value = '';
    await loadMessagesForChat(chatId);
    renderMessages();
    updateSendBtn();
    showScreen('chat');
    // الاشتراك في Realtime
    subscribeToChat(chatId);
    setTimeout(() => $('#msgInput').focus(), 300);
}
$('#backBtn')?.addEventListener('click', () => { currentChatId = null; showScreen('chats'); renderChats(); });
$('#chatAvatar')?.addEventListener('click', () => { const c = DB.chats.find(x => x.id === currentChatId); if (c) openUserModal(c); });
$('#chatHeaderInfo')?.addEventListener('click', () => { const c = DB.chats.find(x => x.id === currentChatId); if (c) openUserModal(c); });

async function renderMessages() {
    if (!currentChatId) return;
    const area = $('#messagesArea');
    const msgs = DB.messages[currentChatId] || [];
    area.innerHTML = '';
    let lastDate = '';
    for (let m of msgs) {
        const md = new Date(m.created_at).toDateString();
        if (md !== lastDate) { lastDate = md; area.innerHTML += `<div class="date-divider">${fmtDate(m.created_at)}</div>`; }
        const isMe = m.sender_id === (DB.user?.id || 'me');
        const stIcon = isMe ? (m.status === 'read' ? '<span style="color:#4fc3f7;">✓✓</span>' : m.status === 'delivered' ? '✓✓' : '✓') : '';
        const liked = m.liked;
        const hasVoice = m.media_type === 'audio' && m.media_url;
        const hasImg = m.media_type === 'image' && m.media_url;
        let imgUrl = '';
        if (hasImg) {
            const blob = getMediaFile(m.media_url);
            imgUrl = blob ? URL.createObjectURL(blob) : '';
        }
        area.innerHTML += `
        <div class="msg-row ${isMe ? 'own' : 'other'}" id="msg-${m.id}">
            <div class="msg-bubble">
                ${m.reply_to ? `<div class="reply-preview" onclick="scrollToMsg('${m.reply_to}')">↩️ رد على رسالة</div>` : ''}
                ${hasVoice ? `<div class="voice-msg"><button class="voice-play-btn" data-audio="${m.media_url}" onclick="playVoice(this)">▶️</button><div class="voice-wave">${Array.from({ length: 8 }, (_, i) => `<div class="voice-wave-bar" style="height:${8 + Math.random() * 16}px;animation-delay:${i * 0.08}s"></div>`).join('')}</div><span style="font-size:10px;">${m.voice_duration || '0:00'}</span></div>` : ''}
                ${hasImg ? `<img src="${imgUrl}" class="attachment-img" onclick="openImageViewer('${imgUrl}')" loading="lazy">` : ''}
                <div>${esc(m.text || '')}</div>
                <div class="msg-time-row"><span>${fmtTime(m.created_at)}</span>${stIcon}</div>
                <div class="msg-actions">
                    <button class="${liked ? 'liked' : ''}" data-id="${m.id}" data-act="like">${liked ? '❤️' : '🤍'} ${m.likes || 0}</button>
                    <button data-id="${m.id}" data-act="reply">↩️</button>
                    ${isMe ? `<button data-id="${m.id}" data-act="delete">🗑️</button>` : ''}
                </div>
            </div>
        </div>`;
    }
    area.querySelectorAll('.msg-actions button').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const act = b.dataset.act;
        const mid = b.dataset.id;
        if (act === 'like') toggleLike(mid);
        if (act === 'reply') setReply(mid);
        if (act === 'delete') deleteMsg(mid);
    }));
    area.scrollTop = area.scrollHeight;
}

function playVoice(btn) {
    const mediaId = btn.dataset.audio;
    if (!mediaId) return;
    const blob = getMediaFile(mediaId);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    btn.textContent = '⏸️';
    audio.play();
    audio.onended = () => { btn.textContent = '▶️'; };
    btn.onclick = () => { if (audio.paused) { audio.play(); btn.textContent = '⏸️'; } else { audio.pause(); btn.textContent = '▶️'; } };
}
function openImageViewer(src) {
    $('#viewerImage').src = src;
    $('#imageViewer').classList.add('active');
}
$('#closeImageViewer')?.addEventListener('click', () => $('#imageViewer').classList.remove('active'));
$('#imageViewer')?.addEventListener('click', function (e) { if (e.target === this) this.classList.remove('active'); });
function scrollToMsg(mid) {
    const el = document.getElementById('msg-' + mid);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.background = 'rgba(255,200,0,0.15)'; setTimeout(() => el.style.background = '', 1500); }
}
function toggleLike(mid) {
    if (!currentChatId) return;
    const m = DB.messages[currentChatId]?.find(x => x.id === mid);
    if (m) { m.liked = !m.liked; m.likes = (m.likes || 0) + (m.liked ? 1 : -1); if (m.likes < 0) m.likes = 0; sqlRun("UPDATE messages SET likes=?, liked=? WHERE id=?", [m.likes, m.liked ? 1 : 0, mid]); renderMessages(); }
}
function deleteMsg(mid) {
    if (!currentChatId || !confirm('حذف الرسالة؟')) return;
    sqlRun("DELETE FROM messages WHERE id=?", [mid]);
    DB.messages[currentChatId] = DB.messages[currentChatId].filter(x => x.id !== mid);
    updateLastMsg();
    renderMessages();
    toast('🗑 تم الحذف');
}
function setReply(mid) {
    const m = DB.messages[currentChatId]?.find(x => x.id === mid);
    if (m) { replyTarget = m; $('#replyPreview').textContent = (m.text || (m.media_type === 'audio' ? '🎤 رسالة صوتية' : '📎')).substring(0, 50); $('#replyBar').style.display = 'flex'; $('#msgInput').focus(); }
}
$('#cancelReplyBtn')?.addEventListener('click', () => { replyTarget = null; $('#replyBar').style.display = 'none'; });
function updateLastMsg() {
    if (!currentChatId) return;
    const msgs = DB.messages[currentChatId];
    if (msgs.length) {
        const l = msgs[msgs.length - 1];
        sqlRun("UPDATE chats SET last_msg=?, last_time=? WHERE id=?", [l.text || (l.media_type === 'audio' ? '🎤 رسالة صوتية' : '📎'), l.created_at, currentChatId]);
    }
}

function simulateTyping() {
    if (!currentChatId) return;
    const c = DB.chats.find(x => x.id === currentChatId);
    if (c && Math.random() > 0.6) {
        c._typing = Date.now();
        const st = $('#chatStatusDisp');
        st.textContent = 'يكتب الآن...';
        st.className = 'chat-header-status typing';
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            c._typing = null;
            st.textContent = c.is_online ? 'متصل الآن' : c.last_seen;
            st.className = 'chat-header-status' + (c.is_online ? ' online' : '');
            if (currentScreen === 'chats') renderChats();
        }, 2000 + Math.random() * 2000);
        if (currentScreen === 'chats') renderChats();
    }
}

async function sendMessage() {
    if (!currentChatId) return;
    const inp = $('#msgInput');
    const text = inp.value.trim();
    if (!text && !pendingImg && !pendingVoice && !pendingFile) return;

    const msgId = genId();
    let mediaType = null;
    let mediaUrl = null;
    let voiceDuration = null;

    if (pendingImg) {
        mediaType = 'image';
        mediaUrl = msgId;
        const blob = await fetch(pendingImg).then(r => r.blob());
        await saveMediaFile(msgId, blob, 'image/png');
    } else if (pendingVoice) {
        mediaType = 'audio';
        mediaUrl = msgId;
        voiceDuration = pendingVoice.duration;
        const blob = await fetch(pendingVoice.blob).then(r => r.blob());
        await saveMediaFile(msgId, blob, 'audio/webm');
    }

    const now = new Date().toISOString();
    sqlRun("INSERT INTO messages (id, chat_id, sender_id, reply_to, text, media_type, media_url, voice_duration, created_at, status) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [msgId, currentChatId, DB.user?.id || 'me', replyTarget?.id || null, text || (mediaType === 'audio' ? '🎤 رسالة صوتية' : '📎 مرفق'), mediaType, mediaUrl, voiceDuration, now, 'sent']);
    sqlRun("UPDATE chats SET last_msg=?, last_time=?, is_online=? WHERE id=?", [text || (mediaType === 'audio' ? '🎤 رسالة صوتية' : '📎 مرفق'), now, 1, currentChatId]);

    // إرسال إلى Supabase (إذا أردنا المزامنة الفورية)
    if (supabase && DB.cloudSyncEnabled && !DB.user.isGuest) {
        supabase.from('messages').insert({
            id: msgId,
            chat_id: currentChatId,
            sender_id: DB.user.id,
            text: text || (mediaType === 'audio' ? '🎤 رسالة صوتية' : '📎 مرفق'),
            media_type: mediaType,
            media_url: mediaUrl,
            voice_duration: voiceDuration,
            created_at: now
        }).then(({ error }) => {
            if (error) console.error('فشل إرسال الرسالة إلى Supabase:', error);
        });
    }

    inp.value = '';
    pendingImg = null;
    pendingVoice = null;
    pendingFile = null;
    replyTarget = null;
    $('#replyBar').style.display = 'none';
    await loadMessagesForChat(currentChatId);
    renderMessages();
    updateSendBtn();

    // محاكاة تغير الحالة
    setTimeout(() => { sqlRun("UPDATE messages SET status='delivered' WHERE id=?", [msgId]); DB.messages[currentChatId].find(x => x.id === msgId).status = 'delivered'; renderMessages(); }, 700);
    setTimeout(() => { if (Math.random() > 0.4) { sqlRun("UPDATE messages SET status='read' WHERE id=?", [msgId]); DB.messages[currentChatId].find(x => x.id === msgId).status = 'read'; renderMessages(); } }, 2200);

    simulateTyping();
    if (Math.random() > 0.45) setTimeout(() => autoReply(), 1500 + Math.random() * 3000);
}

async function autoReply() {
    if (!currentChatId) return;
    const reps = ['👍 تم', 'شكراً!', '😊 حاضر', 'أوكي', 'جميل', 'سأراجع', '😂', 'ممتاز', '👌', 'تمام'];
    const msgId = genId();
    const now = new Date().toISOString();
    sqlRun("INSERT INTO messages (id, chat_id, sender_id, text, created_at, status) VALUES (?,?,?,?,?,?)", [msgId, currentChatId, currentChatId, reps[Math.floor(Math.random() * reps.length)], now, 'delivered']);
    sqlRun("UPDATE chats SET last_msg=?, last_time=?, unread=unread+1 WHERE id=?", [reps[Math.floor(Math.random() * reps.length)], now, currentChatId]);
    await loadMessagesForChat(currentChatId);
    renderMessages();
    if (currentScreen !== 'chat') renderChats();
}

$('#sendMsgBtn')?.addEventListener('click', sendMessage);
$('#msgInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
$('#msgInput')?.addEventListener('input', updateSendBtn);
$('#msgInput')?.addEventListener('focus', () => {
    if (currentChatId) { const c = DB.chats.find(x => x.id === currentChatId); if (c) { c._typing = Date.now(); } }
});

function updateSendBtn() {
    const has = $('#msgInput').value.trim().length > 0 || pendingImg || pendingVoice || pendingFile;
    const sendBtn = $('#sendMsgBtn');
    const micBtn = $('#micBtn');
    if (sendBtn) sendBtn.style.display = has ? 'flex' : 'none';
    if (micBtn) micBtn.style.display = has ? 'none' : 'flex';
}

// ---------- تسجيل الصوت ----------
$('#micBtn')?.addEventListener('mousedown', startRecording);
$('#micBtn')?.addEventListener('touchstart', startRecording);
$('#micBtn')?.addEventListener('mouseup', stopRecording);
$('#micBtn')?.addEventListener('touchend', stopRecording);
$('#micBtn')?.addEventListener('mouseleave', stopRecording);
$('#micBtn')?.addEventListener('touchcancel', stopRecording);

async function startRecording(e) {
    e.preventDefault();
    if (isRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecording = true;
        $('#micBtn').classList.add('recording');
        toast('🎤 جاري التسجيل...', 3000);
        mediaRecorder = new MediaRecorder(stream);
        recordingChunks = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordingChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordingChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const duration = Math.floor(recordingChunks.length * 0.05);
            pendingVoice = { blob: url, duration: '0:' + Math.min(duration, 59).toString().padStart(2, '0') };
            updateSendBtn();
            toast('✅ تم التسجيل، اضغط إرسال');
            stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
        setTimeout(() => { if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); isRecording = false; $('#micBtn').classList.remove('recording'); } }, 15000);
    } catch (err) {
        toast('⚠️ لا يمكن الوصول للميكروفون');
        isRecording = false;
        $('#micBtn').classList.remove('recording');
    }
}
function stopRecording() {
    if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); isRecording = false; $('#micBtn').classList.remove('recording'); }
}

// ---------- إيموجي ----------
const emojis = ['😀', '😂', '😍', '😢', '😡', '👍', '❤️', '🔥', '🎉', '😎', '🤔', '😴', '🥳', '😇', '🤗', '😤', '😱', '💔', '✨', '🌟', '💡', '📎', '📷', '🎵', '📍', '🙏', '💪', '👀', '🤝', '🚀', '💯', '✅', '❌', '🎯'];
const ep = $('#emojiPicker');
emojis.forEach(e => {
    const s = document.createElement('span');
    s.textContent = e;
    s.addEventListener('click', () => { $('#msgInput').value += e; ep.classList.remove('show'); $('#msgInput').focus(); updateSendBtn(); });
    ep.appendChild(s);
});
$('#emojiBtn')?.addEventListener('click', e => { e.stopPropagation(); ep.classList.toggle('show'); });
document.addEventListener('click', e => { if (!ep.contains(e.target) && e.target !== $('#emojiBtn')) ep.classList.remove('show'); });

// ---------- مرفقات ----------
const as = $('#attachSheet');
const ao = $('#attachOverlay');
$('#attachBtn')?.addEventListener('click', () => { as.classList.add('open'); ao.classList.add('active'); ep.classList.remove('show'); });
$('#closeAttachBtn')?.addEventListener('click', () => { as.classList.remove('open'); ao.classList.remove('active'); });
ao?.addEventListener('click', () => { as.classList.remove('open'); ao.classList.remove('active'); });
const hf = $('#hiddenFileInput');
$$('.attach-option').forEach(o => o.addEventListener('click', () => {
    const t = o.dataset.type;
    if (t === 'gallery') { hf.accept = 'image/*,video/*'; hf.click(); }
    else if (t === 'camera') { hf.accept = 'image/*'; hf.capture = 'environment'; hf.click(); }
    else if (t === 'document') { hf.accept = '.pdf,.doc,.docx,.txt'; hf.click(); }
    else toast('📇 جهة اتصال قريباً');
    as.classList.remove('open'); ao.classList.remove('active');
}));
hf?.addEventListener('change', async e => {
    const files = e.target.files;
    if (files.length > 0) {
        for (const f of files) {
            if (f.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = ev => { pendingImg = ev.target.result; updateSendBtn(); toast('📷 اضغط إرسال'); };
                reader.readAsDataURL(f);
            } else if (f.type.startsWith('video/')) {
                const reader = new FileReader();
                reader.onload = ev => { pendingFile = { url: ev.target.result, type: 'video' }; updateSendBtn(); toast('🎥 اضغط إرسال'); };
                reader.readAsDataURL(f);
            } else {
                toast('📄 ' + f.name);
            }
        }
    }
    hf.value = '';
});

// ---------- قائمة المحادثة ----------
$('#chatMenuBtn')?.addEventListener('click', () => {
    const c = DB.chats.find(x => x.id === currentChatId);
    showPopup([
        { icon: '👤', label: 'عرض جهة الاتصال', action: () => { if (c) openUserModal(c); } },
        { icon: '🔍', label: 'بحث في المحادثة', action: () => searchInChat() },
        { icon: '📁', label: 'الوسائط المشتركة', action: () => { if (c) showSharedMedia(c.id); } },
        { icon: '📌', label: c?.is_pinned ? 'إلغاء التثبيت' : 'تثبيت', action: () => { if (c) { c.is_pinned = !c.is_pinned; sqlRun("UPDATE chats SET is_pinned=? WHERE id=?", [c.is_pinned ? 1 : 0, c.id]); DB.chats = sqlQuery("SELECT * FROM chats ORDER BY is_pinned DESC, last_time DESC"); renderChats(); toast(c.is_pinned ? '📌 مثبتة' : 'تم الإلغاء'); } } },
        { icon: '🗑️', label: 'حذف المحادثة', action: () => { if (confirm('حذف المحادثة؟')) { sqlRun("DELETE FROM messages WHERE chat_id=?", [currentChatId]); sqlRun("DELETE FROM chats WHERE id=?", [currentChatId]); DB.chats = DB.chats.filter(x => x.id !== currentChatId); delete DB.messages[currentChatId]; currentChatId = null; showScreen('chats'); renderChats(); toast('🗑 تم الحذف'); } }, danger: true }
    ]);
});
function searchInChat() {
    const q = prompt('🔍 ابحث في المحادثة:');
    if (q && q.trim() && currentChatId) {
        const msgs = DB.messages[currentChatId] || [];
        const found = msgs.filter(m => m.text && m.text.toLowerCase().includes(q.trim().toLowerCase()));
        if (found.length) { scrollToMsg(found[0].id); toast('✅ تم العثور على ' + found.length + ' رسالة'); }
        else toast('❌ لا توجد نتائج');
    }
}

// ---------- شاشة المكالمات ----------
function renderCalls() {
    $('#callsList').innerHTML = DB.calls.length ? DB.calls.map(c => `
        <div class="call-item" onclick="toast('📞 ${esc(c.type==='incoming'?'واردة':'صادرة')}')">
            <div class="call-avatar">${c.type === 'incoming' ? '📥' : '📤'}</div>
            <div class="item-info"><div class="item-title">${c.type === 'incoming' ? 'مكالمة واردة' : 'مكالمة صادرة'}</div><div class="item-sub">${c.type} • ${c.duration} ثانية</div></div>
            <span style="color:var(--accent);">📞</span>
        </div>`).join('') : '<div class="empty-state"><span class="empty-icon">📵</span><p>لا توجد مكالمات</p></div>';
}

// ---------- شاشة التحديثات ----------
function renderStories() {
    $('#storyBar').innerHTML = `
        <div class="story-item story-add" onclick="openStoryCamera()"><div class="story-ring"><span>+</span></div><div class="story-name">إضافة</div></div>
        ${DB.stories.map((s, i) => `<div class="story-item" onclick="viewStory(${i})"><div class="story-ring"><div class="story-avatar">${s.user_id.charAt(0)}</div></div><div class="story-name">${esc(s.user_id)}</div></div>`).join('')}`;
}
function openStoryCamera() {
    hf.accept = 'image/*';
    hf.capture = 'environment';
    hf.click();
    toast('📷 التقط صورة لإضافتها إلى قصتك');
}
function viewStory(index) {
    if (index >= DB.stories.length) return;
    storyIndex = index;
    const story = DB.stories[index];
    $('#storyViewer').classList.add('active');
    $('#storyContent').innerHTML = `<div style="text-align:center;"><div class="story-avatar-view">${story.user_id.charAt(0)}</div><div class="story-text">📖 ${esc(story.text_content || '')}</div></div>`;
    const progressBar = $('#storyProgress');
    progressBar.innerHTML = DB.stories.map((_, i) => `<div class="story-progress-bar"><div class="story-progress-fill" style="width:${i < index ? '100%' : '0%'}"></div></div>`).join('');
    if (storyInterval) clearInterval(storyInterval);
    let prog = 0;
    const currentFill = progressBar.querySelectorAll('.story-progress-fill')[index];
    storyInterval = setInterval(() => {
        prog += 1;
        if (currentFill) currentFill.style.width = prog + '%';
        if (prog >= 100) { clearInterval(storyInterval); if (index + 1 < DB.stories.length) setTimeout(() => viewStory(index + 1), 300); else closeStoryViewer(); }
    }, 50);
}
$('#closeStoryViewer')?.addEventListener('click', closeStoryViewer);
function closeStoryViewer() { if (storyInterval) clearInterval(storyInterval); storyInterval = null; $('#storyViewer').classList.remove('active'); }
function renderChannels() {
    $('#channelsList').innerHTML = DB.channels.length ? DB.channels.map(ch => `
        <div class="channel-item" onclick="toast('📢 ${esc(ch.name)}')">
            <div class="channel-avatar">${ch.avatar}</div>
            <div class="item-info"><div class="item-title">${esc(ch.name)}</div><div class="item-sub">${ch.followers} متابع • ${ch.update_info}</div></div>
            <span style="color:var(--text3);">›</span>
        </div>`).join('') : '<div class="empty-state"><p>لا توجد قنوات</p></div>';
}
$('#createChannelBtn')?.addEventListener('click', () => {
    const n = prompt('اسم القناة:');
    if (n && n.trim()) { sqlRun("INSERT INTO channels (id, name, avatar, followers, update_info) VALUES (?,?,?,?,?)", ['ch' + Date.now(), n.trim(), '📢', 0, 'الآن']); DB.channels = sqlQuery("SELECT * FROM channels"); renderChannels(); toast('✅ تم الإنشاء'); }
});

// ---------- شاشة الأدوات ----------
$('#startAdBtn')?.addEventListener('click', () => toast('🚀 إعلان قريباً'));
$('#catalogBtn')?.addEventListener('click', () => showCatalog());
$('#broadcastBtn')?.addEventListener('click', () => broadcastMessage());
function showCatalog() {
    const catalogHTML = `<div class="app-header"><button class="header-btn" onclick="showScreen('tools')"><span>→</span></button><h2>📦 الكتالوج</h2><button class="header-btn" onclick="addCatalogItem()"><span>➕</span></button></div>
        <div class="catalog-grid">${DB.catalog.length ? DB.catalog.map(c => `<div class="catalog-card" onclick="toast('🛒 ${esc(c.name)} - ${c.price}')"><div class="catalog-img">${c.icon}</div><div class="catalog-info"><h5>${esc(c.name)}</h5><span>${c.price}</span></div></div>`).join('') : '<div class="empty-state"><span class="empty-icon">📦</span><p>الكتالوج فارغ</p></div>'}</div>`;
    const tempScreen = document.createElement('div');
    tempScreen.className = 'screen active no-nav';
    tempScreen.id = 'catalogTempScreen';
    tempScreen.innerHTML = catalogHTML;
    document.querySelector('.app-container').appendChild(tempScreen);
    $$('.screen').forEach(s => s.classList.remove('active'));
    tempScreen.classList.add('active');
    $('#bottomNav').style.display = 'none';
    window._catalogScreen = tempScreen;
}
function addCatalogItem() {
    const name = prompt('اسم المنتج:'); if (!name?.trim()) return;
    const price = prompt('السعر:');
    const icon = prompt('أيقونة (إيموجي):', '📦');
    sqlRun("INSERT INTO catalog (id, name, price, icon) VALUES (?,?,?,?)", ['cat' + Date.now(), name.trim(), price || 'غير محدد', icon || '📦']);
    DB.catalog = sqlQuery("SELECT * FROM catalog");
    if (window._catalogScreen) window._catalogScreen.remove();
    showCatalog();
    toast('✅ تمت الإضافة');
}

// ---------- الوسائط المشتركة ----------
function showSharedMedia(chatId) {
    const msgs = DB.messages[chatId] || [];
    const items = msgs.filter(m => m.media_type).map(m => ({ id: m.id, type: m.media_type, url: m.media_url, sender: m.sender_id, time: m.created_at }));
    items.sort((a, b) => new Date(a.time) - new Date(b.time));

    let filtered = items;
    const activeTab = $('#sharedMediaTabs .active')?.dataset?.type || 'all';
    if (activeTab !== 'all') filtered = items.filter(i => i.type === activeTab);

    const grid = $('#sharedMediaGrid');
    grid.innerHTML = '';
    if (filtered.length === 0) {
        $('#sharedMediaEmpty').style.display = 'block';
        grid.style.display = 'none';
    } else {
        $('#sharedMediaEmpty').style.display = 'none';
        grid.style.display = 'grid';
        filtered.forEach(item => {
            const card = document.createElement('div');
            card.style.position = 'relative';
            card.style.cursor = 'pointer';
            if (item.type === 'image') {
                const blob = getMediaFile(item.url);
                const src = blob ? URL.createObjectURL(blob) : '';
                card.innerHTML = `<img src="${src}" style="width:100%; height:100px; object-fit:cover; border-radius:8px;">`;
                card.addEventListener('click', () => { if (src) openImageViewer(src); });
            } else if (item.type === 'video') {
                card.innerHTML = `<video style="width:100%; height:100px; object-fit:cover; border-radius:8px;" controls></video>`;
            } else if (item.type === 'audio') {
                card.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100px; background:var(--surface3); border-radius:8px;">🎵 صوت</div>`;
                card.addEventListener('click', () => {
                    const blob = getMediaFile(item.url);
                    if (blob) { const audio = new Audio(URL.createObjectURL(blob)); audio.play(); }
                });
            } else {
                card.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100px; background:var(--surface3); border-radius:8px;">📄 مستند</div>`;
            }
            grid.appendChild(card);
        });
    }
    $('#sharedMediaModal').classList.add('active');
    $('#sharedMediaModal').dataset.chatId = chatId;
}
$$('#sharedMediaTabs button')?.forEach(btn => {
    btn.addEventListener('click', function () {
        $$('#sharedMediaTabs button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const chatId = $('#sharedMediaModal').dataset.chatId;
        if (chatId) showSharedMedia(chatId);
    });
});
$('#closeSharedMediaBtn')?.addEventListener('click', () => $('#sharedMediaModal').classList.remove('active'));

// ---------- الإعدادات ----------
$('#closeSettingsBtn')?.addEventListener('click', () => showScreen('chats'));
$('#themeToggle')?.addEventListener('click', function (e) {
    if (e.target.closest('.toggle-sw') || e.target === this || e.target.closest('.setting-left')) {
        DB.theme = DB.theme === 'dark' ? 'light' : 'dark';
        applyTheme();
        saveDB();
        toast(DB.theme === 'dark' ? '🌙 الوضع الليلي' : '☀️ الوضع النهاري');
    }
});
$('#notifToggle')?.addEventListener('click', function (e) {
    if (e.target.closest('.toggle-sw') || e.target === this || e.target.closest('.setting-left')) {
        DB.notifications = !DB.notifications;
        $('#notifSwitch').classList.toggle('active', DB.notifications);
        saveDB();
        toast(DB.notifications ? '🔔 الإشعارات مفعلة' : '🔕 الإشعارات معطلة');
    }
});

// ---------- ملفي الشخصي (داخل الإعدادات) ----------
function loadProfileToSettings() {
    if (!DB.user) return;
    const avatarEl = $('#profileSettingsAvatar');
    if (avatarEl) avatarEl.textContent = DB.user.avatar || DB.user.name?.charAt(0) || '?';
    $('#profileBioInput').value = DB.user.bio || '';
    $('#profileStatusInput').value = DB.user.status || '';
    $('#profilePhoneInput').value = DB.user.phone || '';
    if (DB.user.profileImage) {
        if (avatarEl) { avatarEl.style.backgroundImage = `url(${DB.user.profileImage})`; avatarEl.style.backgroundSize = 'cover'; avatarEl.textContent = ''; }
    }
}
$('#changeProfileImageBtn')?.addEventListener('click', () => $('#profileImageInput').click());
$('#profileImageInput')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        DB.user.profileImage = ev.target.result;
        await saveUserToSQLite();
        loadProfileToSettings();
        toast('✅ تم تحديث الصورة');
    };
    reader.readAsDataURL(file);
});
$('#removeProfileImageBtn')?.addEventListener('click', async () => {
    DB.user.profileImage = null;
    await saveUserToSQLite();
    loadProfileToSettings();
    toast('🗑️ تم إلغاء الصورة');
});
$('#saveProfileBtn')?.addEventListener('click', async () => {
    if (!DB.user) return;
    DB.user.bio = $('#profileBioInput').value.trim();
    DB.user.status = $('#profileStatusInput').value.trim();
    const newPhone = $('#profilePhoneInput').value.trim();
    if (newPhone && newPhone !== DB.user.phone) {
        if (DB.user.isGuest) {
            DB.user.phone = newPhone;
        } else {
            toast('⚠️ لا يمكن تغيير رقم الهاتف للمستخدمين المسجلين');
        }
    }
    await saveUserToSQLite();
    toast('✅ تم حفظ الملف الشخصي');
});

// ---------- خيارات أخرى ----------
function exportData() {
    const b = exportDatabase();
    if (!b) return toast('❌ لا يمكن التصدير');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'ramzx_backup.db';
    a.click();
    toast('💾 تم تصدير قاعدة البيانات');
}
function importData() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.db';
    inp.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (confirm('⚠️ استيراد قاعدة البيانات سيستبدل جميع البيانات. متابعة؟')) {
                const buffer = await file.arrayBuffer();
                await importDatabase(buffer);
                await loadFromSQLite();
                showScreen('chats');
                toast('✅ تم استيراد البيانات');
            }
        }
    };
    inp.click();
}
function clearAllData() {
    if (confirm('⚠️ حذف جميع المحادثات والبيانات نهائياً؟')) {
        resetDatabase().then(async () => {
            await seedSQLiteIfEmpty();
            await loadFromSQLite();
            renderChats();
            toast('🗑 تم حذف جميع البيانات');
        });
    }
}
async function logout() {
    if (confirm('تسجيل الخروج؟')) {
        await signOutUser();
        sqlRun("DELETE FROM settings WHERE key='user'");
        DB.user = null;
        location.reload();
    }
}

// مزامنة سحابية
async function syncToCloud(showToastFlag = true) {
    if (!supabase || !DB.user || DB.user.isGuest) return;
    try {
        const { error } = await supabase.from('app_data').upsert({
            id: DB.user.id,
            user: DB.user,
            chats: DB.chats,
            messages: DB.messages,
            stories: DB.stories,
            channels: DB.channels,
            calls: DB.calls,
            catalog: DB.catalog,
            theme: DB.theme,
            notifications: DB.notifications,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        if (error) throw error;
        DB.lastCloudSync = new Date().toISOString();
        await saveDB();
        if (showToastFlag) toast('✅ تمت المزامنة مع السحابة');
    } catch (err) {
        console.error(err);
        if (showToastFlag) toast('❌ فشلت المزامنة');
    }
}

// اختصارات لوحة المفاتيح
document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); $('#searchChatsInput').focus(); showScreen('chats'); }
    if (e.key === 'Escape') {
        $('#imageViewer').classList.remove('active');
        $('#userModal').classList.remove('active');
        $('#popupOverlay').classList.remove('active');
        $('#sharedMediaModal').classList.remove('active');
        closeStoryViewer();
        endCall();
        if (window._catalogScreen) { window._catalogScreen.remove(); window._catalogScreen = null; showScreen('tools'); }
    }
});

// ---------- PWA Support ----------
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.style.display = 'block';
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response: ${outcome}`);
                deferredPrompt = null;
                installBtn.style.display = 'none';
            }
        });
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('✅ SW registered'))
            .catch(err => console.error('SW error:', err));
    });
}

// ---------- تهيئة التطبيق ----------
async function init() {
    await initSQLite();
    await seedSQLiteIfEmpty();
    await loadFromSQLite();

    const sessionUser = await checkSession();
    if (sessionUser && !DB.user) {
        const displayName = sessionUser.user_metadata?.display_name || sessionUser.email?.split('@')[0] || 'مستخدم';
        DB.user = { id: sessionUser.id, name: displayName, avatar: displayName.charAt(0), email: sessionUser.email, isGuest: false };
        await saveUserToSQLite();
    }

    applyTheme();
    if (DB.user) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appContainer').style.display = 'flex';
        document.getElementById('bottomNav').style.display = 'flex';
        showScreen('chats');
    } else {
        showLoginScreen();
    }
    updateSendBtn();
    loadProfileToSettings();

    // ربط أحداث تسجيل الدخول
    document.getElementById('btnGuestLogin')?.addEventListener('click', loginAsGuest);
    document.getElementById('linkEmailLogin')?.addEventListener('click', showEmailSection);
    document.getElementById('linkRegister')?.addEventListener('click', showRegisterSection);
    document.getElementById('linkGuestFromEmail')?.addEventListener('click', showGuestSection);
    document.getElementById('linkGuestFromRegister')?.addEventListener('click', showGuestSection);
    document.getElementById('btnEmailLogin')?.addEventListener('click', loginWithEmail);
    document.getElementById('btnRegister')?.addEventListener('click', registerUser);

    // محاكاة تغير حالة الاتصال
    setInterval(async () => {
        if (DB.chats.length) {
            DB.chats.forEach(c => {
                if (Math.random() > 0.7 && !c._typing) {
                    c.is_online = !c.is_online;
                    sqlRun("UPDATE chats SET is_online=?, last_seen=? WHERE id=?", [c.is_online ? 1 : 0, c.is_online ? 'الآن' : 'آخر ظهور ' + fmtTime(new Date().toISOString()), c.id]);
                }
            });
            if (currentScreen === 'chats' && !currentChatId) renderChats();
        }
    }, 25000);

    console.log('🚀 ramz-App v5.0 | SQLite + OPFS + Supabase + PWA + WebSocket');
    console.log('✅ جميع الميزات: محادثات | مكالمات | قصص | وسائط | كتالوج | مزامنة سحابية | WebSocket');
}

init();
