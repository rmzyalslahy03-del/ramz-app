// ============================================================
// common.js - ramz-App v6.0 FINAL COMPLETE
// ============================================================

const SUPABASE_URL = 'https://serlegwdzjulfcxabxzv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4_c97KxnG_7HTvfv-pKeNQ_FTlnK6Yx';
const STORAGE_BUCKET = 'ramz-images';

// تهيئة Supabase
var supabase = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

if (supabase) {
    console.log('✅ Supabase connected');
} else {
    console.warn('⚠️ Supabase client not loaded, cloud sync disabled');
}

// ---------- نظام الأيقونات الاحتياطي ----------
window.handleIconFail = function() {
    document.body.classList.add('icons-failed');
    setTimeout(function() {
        var alt = document.createElement('link');
        alt.rel = 'stylesheet';
        alt.href = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css';
        alt.onload = function() { document.body.classList.remove('icons-failed'); };
        alt.onerror = function() { console.warn('Fallback icon failed'); };
        document.head.appendChild(alt);
    }, 1500);
};

window.addEventListener('load', function() {
    setTimeout(function() {
        var test = document.querySelector('.fa-cog');
        if (test) {
            var style = window.getComputedStyle(test, '::before');
            var content = style.getPropertyValue('content');
            if (!content || content === 'none' || content === '""') {
                document.body.classList.add('icons-failed');
            }
        }
    }, 800);
});

// ---------- اختصارات DOM ----------
const $ = function(s) { return document.querySelector(s); };
const $$ = function(s) { return document.querySelectorAll(s); };

// ---------- دوال مساعدة ----------
const timeAgo = function(d) {
    var df = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (df < 60) return 'الآن';
    if (df < 3600) return Math.floor(df / 60) + ' د';
    if (df < 86400) return Math.floor(df / 3600) + ' س';
    return Math.floor(df / 86400) + ' يوم';
};
const fmtTime = function(d) {
    try { return new Date(d).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
};
const fmtDate = function(d) {
    try { return new Date(d).toLocaleDateString('ar-SA', { weekday: 'long', month: 'long', day: 'numeric' }); } catch (e) { return ''; }
};
const esc = function(s) { return s ? s.replace(/[&<>]/g, function(m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]; }) : ''; };
const genId = function() { return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6); };
const toast = function(m, d) {
    d = d || 2000;
    var t = $('#toast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(function() { t.classList.remove('show'); }, d);
};

// ---------- حالة التطبيق ----------
var DB = {
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
    var userRows = sqlQuery("SELECT value FROM settings WHERE key='user'");
    if (userRows.length) {
        try { DB.user = JSON.parse(userRows[0].value); } catch (e) { DB.user = null; }
    }
    var themeRows = sqlQuery("SELECT value FROM settings WHERE key='theme'");
    if (themeRows.length) DB.theme = themeRows[0].value;
    var notifRows = sqlQuery("SELECT value FROM settings WHERE key='notifications'");
    if (notifRows.length) DB.notifications = JSON.parse(notifRows[0].value);
    var cloudRows = sqlQuery("SELECT value FROM settings WHERE key='cloudSyncEnabled'");
    if (cloudRows.length) DB.cloudSyncEnabled = JSON.parse(cloudRows[0].value);

    DB.chats = sqlQuery("SELECT * FROM chats ORDER BY is_pinned DESC, last_time DESC");

    DB.messages = {};
    for (var i = 0; i < DB.chats.length; i++) {
        DB.messages[DB.chats[i].id] = [];
    }

    DB.stories = sqlQuery("SELECT * FROM stories WHERE expires_at > datetime('now') ORDER BY created_at DESC");
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
async function saveDB() { await saveSettingsToSQLite(); if (DB.user) await saveUserToSQLite(); }

async function loadMessagesForChat(chatId) {
    if (!chatId) return;
    DB.messages[chatId] = sqlQuery("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC", [chatId]);
}

// ---------- بذر البيانات ----------
async function seedSQLiteIfEmpty() {
    var count = sqlQuery("SELECT COUNT(*) as cnt FROM chats")[0]?.cnt || 0;
    if (count > 0) return;

    var now = new Date().toISOString();
    var chats = [
        { id: 'c1', name: 'شعلان', avatar: 'ش', is_online: 1, last_seen: 'الآن', unread: 2, is_pinned: 1, bio: 'صديق قديم 🌟', last_msg: 'أراك لاحقاً', last_time: new Date(Date.now() - 1800000).toISOString() },
        { id: 'c2', name: 'ترف', avatar: 'ت', is_online: 0, last_seen: 'آخر ظهور 10:30', unread: 0, is_pinned: 0, bio: 'مهندسة 💼', last_msg: 'تم إرسال الملف', last_time: new Date(Date.now() - 7200000).toISOString() },
        { id: 'c3', name: 'زينة', avatar: 'ز', is_online: 1, last_seen: 'الآن', unread: 1, is_pinned: 0, bio: 'أختي 🌸', last_msg: 'بابا ينتظرك', last_time: now },
        { id: 'c4', name: 'وليد', avatar: 'و', is_online: 0, last_seen: 'أمس', unread: 0, is_pinned: 0, bio: '+966715303132', last_msg: 'موعد الغداء غداً', last_time: new Date(Date.now() - 86400000).toISOString() }
    ];
    for (var i = 0; i < chats.length; i++) {
        var c = chats[i];
        sqlRun("INSERT INTO chats VALUES (?,?,?,?,?,?,?,?,?,?)", [c.id, c.name, c.avatar, c.last_seen, c.is_online, c.unread, c.is_pinned, c.bio, c.last_msg, c.last_time]);
    }
    var msgs = [
        { id: 'm1', chat_id: 'c1', sender_id: 'c1', text: 'السلام عليكم أكرم', created_at: '2026-06-05T10:20:00', status: 'read' },
        { id: 'm2', chat_id: 'c1', sender_id: 'me', text: 'وعليكم السلام شعلان', created_at: '2026-06-05T10:21:00', status: 'read' },
        { id: 'm3', chat_id: 'c2', sender_id: 'me', text: 'أرسلي الملف', created_at: '2026-06-05T09:10:00', status: 'read' },
        { id: 'm4', chat_id: 'c2', sender_id: 'c2', text: 'تم إرسال الملف', created_at: '2026-06-05T09:15:00', status: 'delivered' }
    ];
    for (var j = 0; j < msgs.length; j++) {
        var m = msgs[j];
        sqlRun("INSERT INTO messages (id, chat_id, sender_id, text, created_at, status) VALUES (?,?,?,?,?,?)", [m.id, m.chat_id, m.sender_id, m.text, m.created_at, m.status]);
    }
    sqlRun("INSERT INTO stories (id, user_id, text_content, created_at, expires_at) VALUES ('s1','شعلان','صباح الخير ☀️',datetime('now'),datetime('now','+1 day'))");
    sqlRun("INSERT INTO stories (id, user_id, text_content, created_at, expires_at) VALUES ('s2','ترف','يوم جديد 🏙️',datetime('now'),datetime('now','+1 day'))");
    sqlRun("INSERT INTO channels (id, name, avatar, followers, update_info) VALUES ('ch1','أخبار التقنية','📰',1240,'منذ ساعة')");
    sqlRun("INSERT INTO channels (id, name, avatar, followers, update_info) VALUES ('ch2','رياضة اليوم','⚽',892,'منذ 3 ساعات')");
    sqlRun("INSERT INTO calls (id, caller_id, receiver_id, type, status, duration, started_at) VALUES ('ca1','c1','me','voice','answered',120,'2026-06-05T10:35:00')");
    sqlRun("INSERT INTO catalog (id, name, price, icon) VALUES ('cat1','تصميم واجهات','50 ر.س','🎨')");
    sqlRun("INSERT INTO catalog (id, name, price, icon) VALUES ('cat2','تطوير مواقع','200 ر.س','💻')");
    console.log('🌱 Seed data inserted');
}

// ---------- تطبيق الثيم ----------
function applyTheme() {
    document.body.classList.toggle('light-theme', DB.theme === 'light');
    var ts = $('#themeSwitch'); if (ts) ts.classList.toggle('active', DB.theme === 'dark');
}

// ---------- مصادقة Supabase ----------
var authUser = null;
async function checkSession() {
    if (!supabase) return null;
    var result = await supabase.auth.getSession();
    if (result.data.session) { authUser = result.data.session.user; return authUser; }
    return null;
}
async function signUp(email, password, name) {
    if (!supabase) return { error: 'Supabase غير متصل' };
    return await supabase.auth.signUp({ email: email, password: password, options: { data: { display_name: name } } });
}
async function signIn(email, password) {
    if (!supabase) return { error: 'Supabase غير متصل' };
    return await supabase.auth.signInWithPassword({ email: email, password: password });
}
async function signOutUser() {
    if (supabase) await supabase.auth.signOut();
    authUser = null;
}

// ---------- دوال المصادقة المشتركة ----------
function showToast(msg, isError) {
    isError = isError || false;
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.backgroundColor = isError ? '#ef4444' : '#1e293b';
    t.classList.add('show');
    clearTimeout(window._tid);
    window._tid = setTimeout(function() { t.classList.remove('show'); }, 3000);
}

function applyLoginTheme() {
    var toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    var isDark = localStorage.getItem('ramz_theme') === 'dark';
    document.body.classList.toggle('dark', isDark);
    var icon = toggle.querySelector('i');
    if (icon) icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
}

async function sendPhoneOTP(phone) {
    if (!supabase) return { error: { message: 'Supabase غير متصل' } };
    return await supabase.auth.signInWithOtp({ phone: phone });
}

async function verifyPhoneOTP(phone, token) {
    if (!supabase) return { error: { message: 'Supabase غير متصل' } };
    return await supabase.auth.verifyOtp({ phone: phone, token: token, type: 'sms' });
}

async function loginWithEmailAuth(email, password) {
    if (!supabase) return { error: { message: 'Supabase غير متصل' } };
    return await supabase.auth.signInWithPassword({ email: email, password: password });
}

async function registerWithEmailAuth(email, password, name) {
    if (!supabase) return { error: { message: 'Supabase غير متصل' } };
    return await supabase.auth.signUp({ email: email, password: password, options: { data: { display_name: name } } });
}

function loginAsGuest(name) {
    var guestUser = {
        id: 'guest_' + Date.now(),
        name: name,
        avatar: name.charAt(0).toUpperCase(),
        isGuest: true
    };
    localStorage.setItem('ramz_user', JSON.stringify(guestUser));
    window.location.href = 'index.html';
}

function isReturningUser() {
    var stored = localStorage.getItem('ramz_user');
    if (!stored) return false;
    try {
        var u = JSON.parse(stored);
        return u && u.id && !u.isGuest;
    } catch (e) { return false; }
}

// ---------- تهيئة صفحة الدخول (login.html) ----------
function initLoginPage() {
    if (!document.getElementById('phoneNumber')) return;

    applyLoginTheme();
    var themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            var isDark = document.body.classList.contains('dark');
            localStorage.setItem('ramz_theme', isDark ? 'light' : 'dark');
            applyLoginTheme();
        });
    }

    var tabs = document.querySelectorAll('.tab-btn');
    var forms = {
        phone: document.getElementById('phoneForm'),
        email: document.getElementById('emailForm'),
        register: document.getElementById('registerForm')
    };

    function switchTab(tabName) {
        Object.values(forms).forEach(function(f) { f.classList.remove('active'); });
        tabs.forEach(function(t) { t.classList.remove('active'); });
        if (forms[tabName]) forms[tabName].classList.add('active');
        var activeTab = document.querySelector('[data-tab="' + tabName + '"]');
        if (activeTab) activeTab.classList.add('active');
    }

    tabs.forEach(function(tab) {
        tab.addEventListener('click', function() { switchTab(tab.dataset.tab); });
    });

    var registerTabBtn = document.getElementById('registerTabBtn');
    if (registerTabBtn) {
        registerTabBtn.addEventListener('click', function() { switchTab('register'); });
    }

    var currentPhone = '';
    var countrySelect = document.getElementById('countryCode');
    var phoneInput = document.getElementById('phoneNumber');

    if (isReturningUser()) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('sendOtpBtn')?.addEventListener('click', async function() {
        var code = countrySelect.value;
        var number = phoneInput.value.trim();
        if (!number) return showToast('الرجاء إدخال رقم الهاتف', true);
        var fullPhone = code + number;
        var result = await sendPhoneOTP(fullPhone);
        if (result.error) return showToast(result.error.message || 'فشل الإرسال', true);
        currentPhone = fullPhone;
        document.getElementById('otpSection').style.display = 'block';
        showToast('تم إرسال رمز التحقق إلى هاتفك');
    });

    document.getElementById('verifyOtpBtn')?.addEventListener('click', async function() {
        var token = document.getElementById('otpCode').value.trim();
        if (!token || !currentPhone) return showToast('الرجاء إدخال الرمز', true);
        var result = await verifyPhoneOTP(currentPhone, token);
        if (result.error) return showToast(result.error.message || 'رمز غير صحيح', true);
        var user = result.data.user;
        var name = user.user_metadata?.display_name || 'مستخدم';
        localStorage.setItem('ramz_user', JSON.stringify({
            id: user.id, name: name, avatar: name.charAt(0), phone: currentPhone, isGuest: false
        }));
        window.location.href = 'index.html';
    });

    document.getElementById('resendOtpLink')?.addEventListener('click', async function() {
        if (!currentPhone) return;
        await sendPhoneOTP(currentPhone);
        showToast('تم إعادة إرسال الرمز');
    });

    document.getElementById('emailLoginBtn')?.addEventListener('click', async function() {
        var email = document.getElementById('loginEmail').value.trim();
        var password = document.getElementById('loginPassword').value;
        if (!email || !password) return showToast('أدخل البريد وكلمة المرور', true);
        var result = await loginWithEmailAuth(email, password);
        if (result.error) return showToast(result.error.message || 'فشل الدخول', true);
        var user = result.data.user;
        var name = user.user_metadata?.display_name || email.split('@')[0];
        localStorage.setItem('ramz_user', JSON.stringify({
            id: user.id, name: name, avatar: name.charAt(0), email: email, isGuest: false
        }));
        window.location.href = 'index.html';
    });

    document.getElementById('registerBtn')?.addEventListener('click', async function() {
        var name = document.getElementById('registerName').value.trim();
        var email = document.getElementById('registerEmail').value.trim();
        var password = document.getElementById('registerPassword').value;
        var confirm = document.getElementById('registerConfirmPassword').value;
        if (!name || !email || !password) return showToast('جميع الحقول مطلوبة', true);
        if (password !== confirm) return showToast('كلمتا المرور غير متطابقتين', true);
        var result = await registerWithEmailAuth(email, password, name);
        if (result.error) return showToast(result.error.message || 'فشل', true);
        if (result.data.user) {
            showToast('تم إنشاء الحساب! سجل دخولك الآن');
            switchTab('email');
        } else {
            showToast('تم إرسال بريد تأكيد، تحقق منه');
        }
    });

    document.getElementById('guestBtn')?.addEventListener('click', function() {
        var section = document.getElementById('guestSection');
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('guestLoginBtn')?.addEventListener('click', function() {
        var name = document.getElementById('guestName').value.trim();
        if (!name) return showToast('أدخل اسمك', true);
        loginAsGuest(name);
    });
}

// ---------- بدء التطبيق (index.html) ----------
async function initApp() {
    await initSQLite();
    await seedSQLiteIfEmpty();
    await loadFromSQLite();

    var storedUser = localStorage.getItem('ramz_user');
    if (storedUser) {
        try { DB.user = JSON.parse(storedUser); } catch (e) {}
    }

    var sessionUser = await checkSession();
    if (sessionUser && !DB.user) {
        var displayName = sessionUser.user_metadata?.display_name || sessionUser.email?.split('@')[0] || 'مستخدم';
        DB.user = { id: sessionUser.id, name: displayName, avatar: displayName.charAt(0), email: sessionUser.email, isGuest: false };
        await saveUserToSQLite();
    }

    applyTheme();
    if (DB.user) {
        document.getElementById('appContainer').style.display = 'flex';
        document.getElementById('bottomNav').style.display = 'flex';
        showScreen('chats');
    } else {
        window.location.href = 'login.html';
    }
    updateSendBtn();
    loadProfileToSettings();

    setInterval(async function() {
        if (DB.chats.length) {
            DB.chats.forEach(function(c) {
                if (Math.random() > 0.7 && !c._typing) {
                    c.is_online = !c.is_online;
                    sqlRun("UPDATE chats SET is_online=?, last_seen=? WHERE id=?", [c.is_online ? 1 : 0, c.is_online ? 'الآن' : 'آخر ظهور ' + fmtTime(new Date().toISOString()), c.id]);
                }
            });
            if (currentScreen === 'chats' && !currentChatId) renderChats();
        }
    }, 25000);

    console.log('🚀 ramz-App v6.0 Final');
}

// ---------- متغيرات التشغيل ----------
var currentChatId = null, replyTarget = null, pendingImg = null, pendingVoice = null, pendingFile = null;
var selectedModalUser = null, currentScreen = 'chats';
var isRecording = false, mediaRecorder = null, recordingChunks = [];
var callInterval = null, callSeconds = 0;
var storyInterval = null, storyIndex = 0;
var typingTimeout = null;

var screens = ['chatsScreen','chatScreen','callsScreen','updatesScreen','toolsScreen','profileScreen','settingsScreen'];

// ---------- التنقل بين الشاشات ----------
function showScreen(id) {
    currentScreen = id;
    screens.forEach(function(s) {
        var el = document.getElementById(s);
        if (el) el.classList.remove('active');
    });
    var target = document.getElementById(id + 'Screen') || document.getElementById(id);
    if (target) target.classList.add('active');

    var noNav = ['chatScreen','profileScreen','settingsScreen'];
    var bottomNav = $('#bottomNav');
    if (bottomNav) bottomNav.style.display = noNav.includes(id) || noNav.includes(id + 'Screen') ? 'none' : 'flex';

    $$('.nav-item').forEach(function(b) { b.classList.toggle('active', b.dataset.nav === id); });

    if (id === 'chats') renderChats();
    if (id === 'calls') renderCalls();
    if (id === 'updates') { renderStories(); renderChannels(); }
    updateStats();

    if (window._catalogScreen && id !== 'catalogTemp') { window._catalogScreen.remove(); window._catalogScreen = null; }
}
$$('.nav-item').forEach(function(b) { b.addEventListener('click', function() { showScreen(b.dataset.nav); }); });

function updateStats() {
    var total = Object.values(DB.messages).flat().length;
    var sv = $('#statViews'); if (sv) sv.textContent = total + Math.floor(Math.random() * 100);
    var sc = $('#statCatalog'); if (sc) sc.textContent = DB.catalog.length + Math.floor(Math.random() * 20);
    var sch = $('#statChats'); if (sch) sch.textContent = DB.chats.length;
}

// ---------- شاشة الدردشات ----------
function renderChats(filter) {
    filter = filter || '';
    var container = $('#chatsList');
    var chats = [].concat(DB.chats).sort(function(a, b) {
        return (b.is_pinned - a.is_pinned) || (new Date(b.last_time) - new Date(a.last_time));
    });
    if (filter) {
        var q = filter.toLowerCase();
        chats = chats.filter(function(c) { return c.name.toLowerCase().includes(q); });
    }
    container.innerHTML = chats.length ? '' : '<div class="empty-state"><span class="empty-icon">💬</span><p>لا توجد محادثات</p></div>';
    chats.forEach(function(c) {
        var div = document.createElement('div'); div.className = 'chat-item';
        var isTyping = c._typing && (Date.now() - c._typing < 5000);
        div.innerHTML = `
            <div class="chat-avatar">${c.avatar}${c.is_online ? '<span class="online-dot"></span>' : ''}</div>
            <div class="chat-info">
                <div class="chat-name-row"><span class="chat-name">${c.is_pinned ? '📌 ' : ''}${esc(c.name)}</span><span class="chat-time">${c.last_time ? timeAgo(c.last_time) : ''}</span></div>
                <div class="chat-preview">
                    <span class="last-msg">${isTyping ? '<span class="typing-indicator-chat">يكتب...</span>' : esc((c.last_msg || '👋 ابدأ').substring(0, 35))}</span>
                    ${c.unread > 0 ? '<span class="unread-badge">' + c.unread + '</span>' : '<span class="check-mark read">✓✓</span>'}
                </div>
            </div>`;
        div.addEventListener('click', function(e) {
            if (e.target.closest('.chat-avatar')) openUserModal(c);
            else openChat(c.id);
        });
        container.appendChild(div);
    });
}
$('#searchChatsInput')?.addEventListener('input', function(e) { renderChats(e.target.value); });
$('#searchBtn')?.addEventListener('click', function() { $('#searchChatsInput').focus(); showScreen('chats'); });
$('#settingsBtn')?.addEventListener('click', function() { showScreen('settings'); });
$('#mainMenuBtn')?.addEventListener('click', function() {
    showPopup([
        { icon:'👥', label:'مجموعة جديدة', action: function() { createGroup(); } },
        { icon:'📣', label:'الرسائل الجماعية', action: function() { broadcastMessage(); } },
        { icon:'⚙️', label:'الإعدادات', action: function() { showScreen('settings'); } },
        { icon:'🚪', label:'تسجيل الخروج', action: function() { logout(); }, danger: true }
    ]);
});

function showPopup(items) {
    var menu = $('#popupMenu');
    menu.innerHTML = items.map(function(i) {
        return '<div class="popup-item' + (i.danger ? ' danger' : '') + '"><span class="popup-icon">' + i.icon + '</span>' + i.label + '</div>';
    }).join('');
    $('#popupOverlay').classList.add('active');
    menu.querySelectorAll('.popup-item').forEach(function(el, idx) {
        el.addEventListener('click', function() {
            items[idx].action();
            $('#popupOverlay').classList.remove('active');
        });
    });
}
$('#popupOverlay')?.addEventListener('click', function(e) {
    if (e.target === $('#popupOverlay')) $('#popupOverlay').classList.remove('active');
});

function createGroup() {
    var name = prompt('اسم المجموعة:'); if (!name || !name.trim()) return;
    var gid = 'g' + Date.now(); var now = new Date().toISOString();
    sqlRun("INSERT INTO chats (id,name,avatar,is_online,last_seen,unread,is_pinned,bio,last_msg,last_time) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [gid, name.trim(), '👥', 1, 'الآن', 0, 0, 'مجموعة جديدة', '', now]);
    DB.chats = sqlQuery("SELECT * FROM chats ORDER BY is_pinned DESC, last_time DESC");
    renderChats(); toast('✅ تم إنشاء المجموعة');
}
function broadcastMessage() {
    var msg = prompt('📣 اكتب الرسالة الجماعية:'); if (!msg || !msg.trim()) return;
    var now = new Date().toISOString();
    DB.chats.forEach(function(c) {
        var mid = genId();
        sqlRun("INSERT INTO messages (id,chat_id,sender_id,text,created_at,status) VALUES (?,?,?,?,?,?)",
            [mid, c.id, DB.user?.id || 'me', msg.trim(), now, 'sent']);
        sqlRun("UPDATE chats SET last_msg=?, last_time=? WHERE id=?", [msg.trim(), now, c.id]);
    });
    DB.chats = sqlQuery("SELECT * FROM chats ORDER BY is_pinned DESC, last_time DESC");
    renderChats(); toast('📣 تم الإرسال للجميع');
}

// ---------- نافذة المستخدم ----------
function openUserModal(user) {
    selectedModalUser = user;
    $('#modalAvatar').textContent = user.avatar || '?';
    $('#modalName').textContent = user.name || 'مستخدم';
    $('#modalBio').textContent = user.bio || 'مرحباً!';
    $('#userModal').classList.add('active');
}
$('#closeModalBtn')?.addEventListener('click', function() { $('#userModal').classList.remove('active'); });
$('#userModal')?.addEventListener('click', function(e) { if (e.target === $('#userModal')) $('#userModal').classList.remove('active'); });
$('#modalChatBtn')?.addEventListener('click', function() {
    if (selectedModalUser) startOrOpenChat(selectedModalUser);
    $('#userModal').classList.remove('active');
});
$('#modalCallBtn')?.addEventListener('click', function() {
    if (selectedModalUser) startWebRTC(selectedModalUser, 'voice');
    $('#userModal').classList.remove('active');
});
$('#modalVideoBtn')?.addEventListener('click', function() {
    if (selectedModalUser) startWebRTC(selectedModalUser, 'video');
    $('#userModal').classList.remove('active');
});
$('#modalInfoBtn')?.addEventListener('click', function() {
    if (selectedModalUser) showProfile(selectedModalUser);
    $('#userModal').classList.remove('active');
});

function startOrOpenChat(user) {
    var chat = DB.chats.find(function(c) { return c.id === user.id; });
    if (!chat) {
        var now = new Date().toISOString();
        sqlRun("INSERT INTO chats (id,name,avatar,is_online,last_seen,unread,is_pinned,bio,last_msg,last_time) VALUES (?,?,?,?,?,?,?,?,?,?)",
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
$('#backFromProfileBtn')?.addEventListener('click', function() { showScreen('chats'); });
$('#profileChatBtn')?.addEventListener('click', function() {
    var uid = this.dataset.userId;
    if (uid) {
        var u = DB.chats.find(function(c) { return c.id === uid; }) || { id: uid, name: '', avatar: '?' };
        startOrOpenChat(u);
    }
});

// ============= WebRTC =============
var localStream = null, peerConnection = null, currentCallType = null, currentCallUser = null;
var iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function startWebRTC(user, type) {
    currentCallType = type;
    currentCallUser = user;
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
        $('#callAvatar').textContent = user.avatar;
        $('#callStatusText').textContent = type === 'video' ? '📹 جاري الاتصال...' : '📞 جاري الاتصال...';
        $('#callTimer').textContent = '00:00';
        callSeconds = 0;
        $('#callScreen').classList.add('active');

        peerConnection = new RTCPeerConnection(iceServers);
        localStream.getTracks().forEach(function(track) { peerConnection.addTrack(track, localStream); });

        peerConnection.onicecandidate = function(event) {
            if (event.candidate && supabase) {
                supabase.channel('webrtc-' + user.id).send({
                    type: 'broadcast',
                    event: 'webrtc',
                    payload: { type: 'candidate', candidate: event.candidate }
                });
            }
        };
        peerConnection.ontrack = function(event) {
            var remoteVideo = document.createElement('video');
            remoteVideo.autoplay = true;
            remoteVideo.style.width = '100%'; remoteVideo.style.maxHeight = '300px';
            remoteVideo.srcObject = event.streams[0];
            var container = document.getElementById('callScreen');
            var old = container.querySelector('video'); if (old) old.remove();
            container.appendChild(remoteVideo);
        };

        var offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        if (supabase) {
            supabase.channel('webrtc-' + user.id).send({
                type: 'broadcast',
                event: 'webrtc',
                payload: { type: 'offer', sdp: offer }
            });
        }

        if (supabase) {
            supabase.channel('webrtc-' + DB.user.id).on('broadcast', { event: 'webrtc' }, async function(payload) {
                var msg = payload.payload;
                if (msg.type === 'answer' && peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                } else if (msg.type === 'candidate' && peerConnection) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
                }
            }).subscribe();
        }

        setTimeout(function() {
            $('#callStatusText').textContent = 'متصل 🟢';
            if (callInterval) clearInterval(callInterval);
            callInterval = setInterval(function() {
                callSeconds++;
                var m = Math.floor(callSeconds / 60).toString().padStart(2, '0');
                var s = (callSeconds % 60).toString().padStart(2, '0');
                $('#callTimer').textContent = m + ':' + s;
            }, 1000);
        }, 3000);
    } catch (err) {
        toast('⚠️ تعذر الوصول للكاميرا/الميكروفون');
        console.error(err);
        $('#callScreen').classList.remove('active');
    }
}

function endCall() {
    if (callInterval) clearInterval(callInterval); callInterval = null;
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    if (localStream) { localStream.getTracks().forEach(function(t) { t.stop(); }); localStream = null; }
    $('#callScreen').classList.remove('active');
    toast('📞 تم إنهاء المكالمة');
}

$('#callEndBtn')?.addEventListener('click', endCall);
$('#callMuteBtn')?.addEventListener('click', function() {
    this.classList.toggle('active');
    toast(this.classList.contains('active') ? '🔇 مكتوم' : '🎤 مفعل');
});
$('#callSpeakerBtn')?.addEventListener('click', function() {
    this.classList.toggle('active');
    toast(this.classList.contains('active') ? '🔊 مفعل' : '🔈 معطل');
});
$('#voiceCallBtn')?.addEventListener('click', function() {
    var c = DB.chats.find(function(x) { return x.id === currentChatId; });
    if (c) startWebRTC(c, 'voice');
});
$('#videoCallBtn')?.addEventListener('click', function() {
    var c = DB.chats.find(function(x) { return x.id === currentChatId; });
    if (c) startWebRTC(c, 'video');
});

// معالجة مكالمة واردة
if (supabase) {
    supabase.channel('webrtc-' + (DB.user?.id || 'me')).on('broadcast', { event: 'webrtc' }, async function(payload) {
        var msg = payload.payload;
        if (msg.type === 'offer' && !peerConnection) {
            if (confirm('📞 مكالمة واردة من ' + (currentCallUser?.name || 'مستخدم'))) {
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    peerConnection = new RTCPeerConnection(iceServers);
                    localStream.getTracks().forEach(function(track) { peerConnection.addTrack(track, localStream); });
                    peerConnection.ontrack = function(e) { /* عرض الفيديو */ };
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                    var answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    supabase.channel('webrtc-' + payload.sender).send({
                        type: 'broadcast',
                        event: 'webrtc',
                        payload: { type: 'answer', sdp: answer }
                    });
                } catch (err) { console.error(err); }
            }
        }
    }).subscribe();
}

// ============= Realtime =============
var currentChatChannel = null;

function subscribeToChat(chatId) {
    if (!supabase) return;
    supabase.removeAllChannels();
    var channel = supabase.channel('chat-' + chatId)
    .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: 'chat_id=eq.' + chatId
    }, async function(payload) {
        var newMsg = payload.new;
        if (newMsg.sender_id === DB.user.id) return;
        sqlRun(
            "INSERT OR IGNORE INTO messages (id,chat_id,sender_id,text,media_type,media_url,voice_duration,created_at,status) VALUES (?,?,?,?,?,?,?,?,?)",
            [newMsg.id, newMsg.chat_id, newMsg.sender_id, newMsg.text, newMsg.media_type, newMsg.media_url, newMsg.voice_duration, newMsg.created_at, 'delivered']
        );
        if (currentChatId === chatId) {
            await loadMessagesForChat(chatId);
            renderMessages();
        } else {
            sqlRun("UPDATE chats SET unread = unread + 1 WHERE id = ?", [chatId]);
        }
        renderChats();
    })
    .on('broadcast', { event: 'typing' }, function(payload) {
        if (payload.payload.chatId === currentChatId) {
            var c = DB.chats.find(function(x) { return x.id === currentChatId; });
            if (c) {
                c._typing = Date.now();
                var st = $('#chatStatusDisp');
                st.textContent = 'يكتب الآن...'; st.className = 'chat-header-status typing';
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(function() {
                    c._typing = null;
                    st.textContent = c.is_online ? 'متصل الآن' : c.last_seen;
                    st.className = 'chat-header-status' + (c.is_online ? ' online' : '');
                }, 3000);
            }
        }
    })
    .subscribe();
    currentChatChannel = channel;
}

function sendTyping() {
    if (!supabase || !currentChatId) return;
    supabase.channel('chat-' + currentChatId).send({
        type: 'broadcast',
        event: 'typing',
        payload: { chatId: currentChatId }
    });
}

// ============= المحادثة =============
async function openChat(chatId) {
    currentChatId = chatId;
    var c = DB.chats.find(function(x) { return x.id === chatId; });
    if (!c) return;
    $('#chatNameDisp').textContent = c.name;
    $('#chatAvatar').textContent = c.avatar;
    var st = $('#chatStatusDisp');
    st.textContent = c.is_online ? 'متصل الآن' : c.last_seen;
    st.className = 'chat-header-status' + (c.is_online ? ' online' : '');
    sqlRun("UPDATE chats SET unread=0 WHERE id=?", [chatId]);
    c.unread = 0; c._typing = null;
    replyTarget = null; pendingImg = null; pendingVoice = null; pendingFile = null;
    $('#replyBar').style.display = 'none';
    $('#msgInput').value = '';
    await loadMessagesForChat(chatId);
    renderMessages(); updateSendBtn();
    showScreen('chat');
    subscribeToChat(chatId);
    setTimeout(function() { $('#msgInput').focus(); }, 300);
}
$('#backBtn')?.addEventListener('click', function() { currentChatId = null; showScreen('chats'); renderChats(); });
$('#chatAvatar')?.addEventListener('click', function() {
    var c = DB.chats.find(function(x) { return x.id === currentChatId; });
    if (c) openUserModal(c);
});
$('#chatHeaderInfo')?.addEventListener('click', function() {
    var c = DB.chats.find(function(x) { return x.id === currentChatId; });
    if (c) openUserModal(c);
});

async function renderMessages() {
    if (!currentChatId) return;
    var area = $('#messagesArea');
    var msgs = DB.messages[currentChatId] || [];
    area.innerHTML = '';
    var lastDate = '';
    for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        var md = new Date(m.created_at).toDateString();
        if (md !== lastDate) { lastDate = md; area.innerHTML += '<div class="date-divider">' + fmtDate(m.created_at) + '</div>'; }
        var isMe = m.sender_id === (DB.user?.id || 'me');
        var stIcon = isMe ? (m.status === 'read' ? '<span style="color:#4fc3f7;">✓✓</span>' : m.status === 'delivered' ? '✓✓' : '✓') : '';
        var liked = m.liked;
        var hasVoice = m.media_type === 'audio' && m.media_url;
        var hasImg = m.media_type === 'image' && m.media_url;
        var imgUrl = '';
        if (hasImg) {
            var blob = getMediaFile(m.media_url);
            imgUrl = blob ? URL.createObjectURL(blob) : '';
        }
        area.innerHTML += `
        <div class="msg-row ${isMe ? 'own' : 'other'}" id="msg-${m.id}">
            <div class="msg-bubble">
                ${m.reply_to ? '<div class="reply-preview" onclick="scrollToMsg(\'' + m.reply_to + '\')">↩️ رد على رسالة</div>' : ''}
                ${hasVoice ? '<div class="voice-msg"><button class="voice-play-btn" data-audio="' + m.media_url + '" onclick="playVoice(this)">▶️</button><div class="voice-wave">' + Array.from({length:8},function(_,i){return '<div class="voice-wave-bar" style="height:'+(8+Math.random()*16)+'px;animation-delay:'+(i*0.08)+'s"></div>';}).join('') + '</div><span style="font-size:10px;">'+(m.voice_duration||'0:00')+'</span></div>' : ''}
                ${hasImg ? '<img src="' + imgUrl + '" class="attachment-img" onclick="openImageViewer(\'' + imgUrl + '\')" loading="lazy">' : ''}
                <div>${esc(m.text || '')}</div>
                <div class="msg-time-row"><span>${fmtTime(m.created_at)}</span>${stIcon}</div>
                <div class="msg-actions">
                    <button class="${liked ? 'liked' : ''}" data-id="${m.id}" data-act="like">${liked ? '❤️' : '🤍'} ${m.likes || 0}</button>
                    <button data-id="${m.id}" data-act="reply">↩️</button>
                    ${isMe ? '<button data-id="' + m.id + '" data-act="delete">🗑️</button>' : ''}
                </div>
            </div>
        </div>`;
    }
    area.querySelectorAll('.msg-actions button').forEach(function(b) {
        b.addEventListener('click', function(e) {
            e.stopPropagation();
            var act = b.dataset.act, mid = b.dataset.id;
            if (act === 'like') toggleLike(mid);
            if (act === 'reply') setReply(mid);
            if (act === 'delete') deleteMsg(mid);
        });
    });
    area.scrollTop = area.scrollHeight;
}

function playVoice(btn) {
    var mediaId = btn.dataset.audio; if (!mediaId) return;
    var blob = getMediaFile(mediaId); if (!blob) return;
    var url = URL.createObjectURL(blob);
    var audio = new Audio(url);
    btn.textContent = '⏸️'; audio.play();
    audio.onended = function() { btn.textContent = '▶️'; };
    btn.onclick = function() {
        if (audio.paused) { audio.play(); btn.textContent = '⏸️'; }
        else { audio.pause(); btn.textContent = '▶️'; }
    };
}
function openImageViewer(src) { $('#viewerImage').src = src; $('#imageViewer').classList.add('active'); }
$('#closeImageViewer')?.addEventListener('click', function() { $('#imageViewer').classList.remove('active'); });
$('#imageViewer')?.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active'); });
function scrollToMsg(mid) {
    var el = document.getElementById('msg-' + mid);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.background = 'rgba(255,200,0,0.15)'; setTimeout(function() { el.style.background = ''; }, 1500); }
}
function toggleLike(mid) {
    if (!currentChatId) return;
    var m = DB.messages[currentChatId]?.find(function(x) { return x.id === mid; });
    if (m) { m.liked = !m.liked; m.likes = (m.likes || 0) + (m.liked ? 1 : -1); if (m.likes < 0) m.likes = 0; sqlRun("UPDATE messages SET likes=?, liked=? WHERE id=?", [m.likes, m.liked ? 1 : 0, mid]); renderMessages(); }
}
function deleteMsg(mid) {
    if (!currentChatId || !confirm('حذف الرسالة؟')) return;
    sqlRun("DELETE FROM messages WHERE id=?", [mid]);
    DB.messages[currentChatId] = DB.messages[currentChatId].filter(function(x) { return x.id !== mid; });
    updateLastMsg(); renderMessages(); toast('🗑 تم الحذف');
}
function setReply(mid) {
    var m = DB.messages[currentChatId]?.find(function(x) { return x.id === mid; });
    if (m) {
        replyTarget = m;
        $('#replyPreview').textContent = (m.text || (m.media_type === 'audio' ? '🎤 رسالة صوتية' : '📎')).substring(0, 50);
        $('#replyBar').style.display = 'flex'; $('#msgInput').focus();
    }
}
$('#cancelReplyBtn')?.addEventListener('click', function() { replyTarget = null; $('#replyBar').style.display = 'none'; });
function updateLastMsg() {
    if (!currentChatId) return;
    var msgs = DB.messages[currentChatId];
    if (msgs.length) {
        var l = msgs[msgs.length - 1];
        sqlRun("UPDATE chats SET last_msg=?, last_time=? WHERE id=?", [l.text || (l.media_type === 'audio' ? '🎤 رسالة صوتية' : '📎'), l.created_at, currentChatId]);
    }
}

async function sendMessage() {
    if (!currentChatId) return;
    var inp = $('#msgInput'); var text = inp.value.trim();
    if (!text && !pendingImg && !pendingVoice && !pendingFile) return;
    var msgId = genId(); var mediaType = null, mediaUrl = null, voiceDuration = null;
    if (pendingImg) {
        mediaType = 'image'; mediaUrl = msgId;
        var blob = await fetch(pendingImg).then(function(r) { return r.blob(); });
        await saveMediaFile(msgId, blob, 'image/png');
    } else if (pendingVoice) {
        mediaType = 'audio'; mediaUrl = msgId; voiceDuration = pendingVoice.duration;
        var blob2 = await fetch(pendingVoice.blob).then(function(r) { return r.blob(); });
        await saveMediaFile(msgId, blob2, 'audio/webm');
    }
    var now = new Date().toISOString();
    sqlRun("INSERT INTO messages (id,chat_id,sender_id,reply_to,text,media_type,media_url,voice_duration,created_at,status) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [msgId, currentChatId, DB.user?.id || 'me', replyTarget?.id || null, text || (mediaType === 'audio' ? '🎤 رسالة صوتية' : '📎 مرفق'), mediaType, mediaUrl, voiceDuration, now, 'sent']);
    sqlRun("UPDATE chats SET last_msg=?, last_time=?, is_online=? WHERE id=?", [text || (mediaType === 'audio' ? '🎤 رسالة صوتية' : '📎 مرفق'), now, 1, currentChatId]);
    if (supabase && DB.cloudSyncEnabled && !DB.user.isGuest) {
        supabase.from('messages').insert({
            id: msgId, chat_id: currentChatId, sender_id: DB.user.id,
            text: text || (mediaType === 'audio' ? '🎤 رسالة صوتية' : '📎 مرفق'),
            media_type: mediaType, media_url: mediaUrl, voice_duration: voiceDuration, created_at: now
        }).then(function(result) { if (result.error) console.error('Supabase send fail', result.error); });
    }
    inp.value = ''; pendingImg = null; pendingVoice = null; pendingFile = null;
    replyTarget = null; $('#replyBar').style.display = 'none';
    await loadMessagesForChat(currentChatId); renderMessages(); updateSendBtn();
    setTimeout(function() { sqlRun("UPDATE messages SET status='delivered' WHERE id=?", [msgId]); DB.messages[currentChatId].find(function(x) { return x.id === msgId; }).status = 'delivered'; renderMessages(); }, 700);
    setTimeout(function() { if (Math.random() > 0.4) { sqlRun("UPDATE messages SET status='read' WHERE id=?", [msgId]); DB.messages[currentChatId].find(function(x) { return x.id === msgId; }).status = 'read'; renderMessages(); } }, 2200);
    sendTyping();
    if (Math.random() > 0.45) setTimeout(function() { autoReply(); }, 1500 + Math.random() * 3000);
}

async function autoReply() {
    if (!currentChatId) return;
    var reps = ['👍 تم','شكراً!','😊 حاضر','أوكي','جميل','سأراجع','😂','ممتاز','👌','تمام'];
    var msgId = genId(); var now = new Date().toISOString();
    sqlRun("INSERT INTO messages (id,chat_id,sender_id,text,created_at,status) VALUES (?,?,?,?,?,?)",
        [msgId, currentChatId, currentChatId, reps[Math.floor(Math.random() * reps.length)], now, 'delivered']);
    sqlRun("UPDATE chats SET last_msg=?, last_time=?, unread=unread+1 WHERE id=?", [reps[Math.floor(Math.random() * reps.length)], now, currentChatId]);
    await loadMessagesForChat(currentChatId); renderMessages();
    if (currentScreen !== 'chat') renderChats();
}

$('#sendMsgBtn')?.addEventListener('click', sendMessage);
$('#msgInput')?.addEventListener('keypress', function(e) { if (e.key === 'Enter') sendMessage(); });
$('#msgInput')?.addEventListener('input', updateSendBtn);
$('#msgInput')?.addEventListener('focus', function() { if (currentChatId) sendTyping(); });
function updateSendBtn() {
    var has = $('#msgInput').value.trim().length > 0 || pendingImg || pendingVoice || pendingFile;
    var sendBtn = $('#sendMsgBtn'); var micBtn = $('#micBtn');
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
    e.preventDefault(); if (isRecording) return;
    try {
        var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecording = true; $('#micBtn').classList.add('recording');
        toast('🎤 جاري التسجيل...', 3000);
        mediaRecorder = new MediaRecorder(stream); recordingChunks = [];
        mediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) recordingChunks.push(e.data); };
        mediaRecorder.onstop = function() {
            var blob = new Blob(recordingChunks, { type: 'audio/webm' });
            var url = URL.createObjectURL(blob);
            var duration = Math.floor(recordingChunks.length * 0.05);
            pendingVoice = { blob: url, duration: '0:' + Math.min(duration, 59).toString().padStart(2, '0') };
            updateSendBtn(); toast('✅ تم التسجيل، اضغط إرسال');
            stream.getTracks().forEach(function(t) { t.stop(); });
        };
        mediaRecorder.start();
        setTimeout(function() {
            if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop(); isRecording = false; $('#micBtn').classList.remove('recording');
            }
        }, 15000);
    } catch (err) {
        toast('⚠️ لا يمكن الوصول للميكروفون');
        isRecording = false; $('#micBtn').classList.remove('recording');
    }
}
function stopRecording() {
    if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); isRecording = false; $('#micBtn').classList.remove('recording');
    }
}

// ---------- إيموجي ----------
var emojis = ['😀','😂','😍','😢','😡','👍','❤️','🔥','🎉','😎','🤔','😴','🥳','😇','🤗','😤','😱','💔','✨','🌟','💡','📎','📷','🎵','📍','🙏','💪','👀','🤝','🚀','💯','✅','❌','🎯'];
var ep = $('#emojiPicker');
if (ep) {
    emojis.forEach(function(e) {
        var s = document.createElement('span'); s.textContent = e;
        s.addEventListener('click', function() {
            $('#msgInput').value += e; ep.classList.remove('show'); $('#msgInput').focus(); updateSendBtn();
        });
        ep.appendChild(s);
    });
}
$('#emojiBtn')?.addEventListener('click', function(e) { e.stopPropagation(); if (ep) ep.classList.toggle('show'); });
document.addEventListener('click', function(e) { if (ep && !ep.contains(e.target) && e.target !== $('#emojiBtn')) ep.classList.remove('show'); });

// ---------- مرفقات ----------
var as = $('#attachSheet'), ao = $('#attachOverlay'), hf = $('#hiddenFileInput');
$('#attachBtn')?.addEventListener('click', function() { if (as) as.classList.add('open'); if (ao) ao.classList.add('active'); if (ep) ep.classList.remove('show'); });
$('#closeAttachBtn')?.addEventListener('click', function() { if (as) as.classList.remove('open'); if (ao) ao.classList.remove('active'); });
ao?.addEventListener('click', function() { if (as) as.classList.remove('open'); if (ao) ao.classList.remove('active'); });
$$('.attach-option').forEach(function(o) {
    o.addEventListener('click', function() {
        var t = o.dataset.type;
        if (t === 'gallery') { hf.accept = 'image/*,video/*'; hf.click(); }
        else if (t === 'camera') { hf.accept = 'image/*'; hf.capture = 'environment'; hf.click(); }
        else if (t === 'document') { hf.accept = '.pdf,.doc,.docx,.txt'; hf.click(); }
        else toast('📇 جهة اتصال قريباً');
        if (as) as.classList.remove('open'); if (ao) ao.classList.remove('active');
    });
});
hf?.addEventListener('change', async function(e) {
    var files = e.target.files;
    if (files.length > 0) {
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            if (f.type.startsWith('image/')) {
                var reader = new FileReader();
                reader.onload = function(ev) { pendingImg = ev.target.result; updateSendBtn(); toast('📷 اضغط إرسال'); };
                reader.readAsDataURL(f);
            } else if (f.type.startsWith('video/')) {
                var reader2 = new FileReader();
                reader2.onload = function(ev) { pendingFile = { url: ev.target.result, type: 'video' }; updateSendBtn(); toast('🎥 اضغط إرسال'); };
                reader2.readAsDataURL(f);
            } else {
                toast('📄 ' + f.name);
            }
        }
    }
    hf.value = '';
});

// ---------- قائمة المحادثة ----------
$('#chatMenuBtn')?.addEventListener('click', function() {
    var c = DB.chats.find(function(x) { return x.id === currentChatId; });
    showPopup([
        { icon:'👤', label:'عرض جهة الاتصال', action: function() { if (c) openUserModal(c); } },
        { icon:'🔍', label:'بحث في المحادثة', action: function() { searchInChat(); } },
        { icon:'📁', label:'الوسائط المشتركة', action: function() { if (c) showSharedMedia(c.id); } },
        { icon:'📌', label: c?.is_pinned ? 'إلغاء التثبيت' : 'تثبيت', action: function() {
            if (c) { c.is_pinned = !c.is_pinned; sqlRun("UPDATE chats SET is_pinned=? WHERE id=?", [c.is_pinned ? 1 : 0, c.id]); DB.chats = sqlQuery("SELECT * FROM chats ORDER BY is_pinned DESC, last_time DESC"); renderChats(); toast(c.is_pinned ? '📌 مثبتة' : 'تم الإلغاء'); }
        }},
        { icon:'🗑️', label:'حذف المحادثة', action: function() {
            if (confirm('حذف المحادثة؟')) {
                sqlRun("DELETE FROM messages WHERE chat_id=?", [currentChatId]);
                sqlRun("DELETE FROM chats WHERE id=?", [currentChatId]);
                DB.chats = DB.chats.filter(function(x) { return x.id !== currentChatId; });
                delete DB.messages[currentChatId]; currentChatId = null;
                showScreen('chats'); renderChats(); toast('🗑 تم الحذف');
            }
        }, danger: true }
    ]);
});
function searchInChat() {
    var q = prompt('🔍 ابحث في المحادثة:'); if (!q || !q.trim() || !currentChatId) return;
    var msgs = DB.messages[currentChatId] || [];
    var found = msgs.filter(function(m) { return m.text && m.text.toLowerCase().includes(q.trim().toLowerCase()); });
    if (found.length) { scrollToMsg(found[0].id); toast('✅ تم العثور على ' + found.length + ' رسالة'); }
    else toast('❌ لا توجد نتائج');
}

// ---------- شاشة المكالمات ----------
function renderCalls() {
    $('#callsList').innerHTML = DB.calls.length ? DB.calls.map(function(c) {
        return '<div class="call-item" onclick="toast(\'📞 ' + esc(c.type === 'incoming' ? 'واردة' : 'صادرة') + '\')"><div class="call-avatar">' + (c.type === 'incoming' ? '📥' : '📤') + '</div><div class="item-info"><div class="item-title">' + (c.type === 'incoming' ? 'مكالمة واردة' : 'مكالمة صادرة') + '</div><div class="item-sub">' + c.type + ' • ' + c.duration + ' ثانية</div></div><span style="color:var(--accent);">📞</span></div>';
    }).join('') : '<div class="empty-state"><span class="empty-icon">📵</span><p>لا توجد مكالمات</p></div>';
}

// ---------- القصص الحقيقية ----------
async function addStory(blob) {
    var storyId = genId(); var now = new Date().toISOString(); var expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    if (supabase && DB.cloudSyncEnabled && !DB.user.isGuest) {
        var fileName = storyId + '.jpg';
        var uploadResult = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, blob);
        if (!uploadResult.error) {
            var urlData = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
            sqlRun("INSERT INTO stories (id,user_id,media_url,text_content,created_at,expires_at) VALUES (?,?,?,?,?,?)",
                [storyId, DB.user.name, urlData.publicUrl, '', now, expires]);
            supabase.channel('stories').send({
                type: 'broadcast', event: 'new_story',
                payload: { id: storyId, user_id: DB.user.name, media_url: urlData.publicUrl, created_at: now, expires_at: expires }
            });
        }
    }
    var reader = new FileReader();
    reader.onload = async function(e) {
        await saveMediaFile(storyId, blob, 'image/jpeg');
        sqlRun("INSERT INTO stories (id,user_id,media_url,text_content,created_at,expires_at) VALUES (?,?,?,?,?,?)",
            [storyId, DB.user.name, storyId, '', now, expires]);
        DB.stories = sqlQuery("SELECT * FROM stories WHERE expires_at > datetime('now') ORDER BY created_at DESC");
        renderStories();
    };
    reader.readAsDataURL(blob);
    toast('✅ تم نشر القصة');
}
if (supabase) {
    supabase.channel('stories').on('broadcast', { event: 'new_story' }, function(payload) {
        var s = payload.payload;
        sqlRun("INSERT INTO stories (id,user_id,media_url,text_content,created_at,expires_at) VALUES (?,?,?,?,?,?)",
            [s.id, s.user_id, s.media_url, '', s.created_at, s.expires_at]);
        DB.stories = sqlQuery("SELECT * FROM stories WHERE expires_at > datetime('now') ORDER BY created_at DESC");
        renderStories();
    }).subscribe();
}

function renderStories() {
    $('#storyBar').innerHTML = '<div class="story-item story-add" onclick="openStoryCamera()"><div class="story-ring"><span>+</span></div><div class="story-name">إضافة</div></div>' +
        DB.stories.map(function(s, i) {
            return '<div class="story-item" onclick="viewStory(' + i + ')"><div class="story-ring"><div class="story-avatar">' + s.user_id.charAt(0) + '</div></div><div class="story-name">' + esc(s.user_id) + '</div></div>';
        }).join('');
}
function openStoryCamera() {
    hf.accept = 'image/*'; hf.capture = 'environment';
    hf.onchange = function(e) { if (e.target.files[0]) addStory(e.target.files[0]); };
    hf.click();
}
function viewStory(index) {
    if (index >= DB.stories.length) return;
    storyIndex = index; var story = DB.stories[index];
    $('#storyViewer').classList.add('active');
    var mediaHtml = '';
    if (story.media_url) {
        if (story.media_url.startsWith('http')) mediaHtml = '<img src="' + story.media_url + '" style="max-width:100%; border-radius:10px;">';
        else {
            var blob = getMediaFile(story.media_url);
            if (blob) mediaHtml = '<img src="' + URL.createObjectURL(blob) + '" style="max-width:100%; border-radius:10px;">';
        }
    }
    $('#storyContent').innerHTML = '<div style="text-align:center;">' + mediaHtml + '<div class="story-text">📖 ' + esc(story.text_content || '') + '</div></div>';
    var progressBar = $('#storyProgress');
    progressBar.innerHTML = DB.stories.map(function(_, i) {
        return '<div class="story-progress-bar"><div class="story-progress-fill" style="width:' + (i < index ? '100%' : '0%') + '"></div></div>';
    }).join('');
    if (storyInterval) clearInterval(storyInterval);
    var prog = 0; var currentFill = progressBar.querySelectorAll('.story-progress-fill')[index];
    storyInterval = setInterval(function() {
        prog += 1; if (currentFill) currentFill.style.width = prog + '%';
        if (prog >= 100) {
            clearInterval(storyInterval);
            if (index + 1 < DB.stories.length) setTimeout(function() { viewStory(index + 1); }, 300);
            else closeStoryViewer();
        }
    }, 50);
}
$('#closeStoryViewer')?.addEventListener('click', closeStoryViewer);
function closeStoryViewer() { if (storyInterval) clearInterval(storyInterval); storyInterval = null; $('#storyViewer').classList.remove('active'); }

function renderChannels() {
    $('#channelsList').innerHTML = DB.channels.length ? DB.channels.map(function(ch) {
        return '<div class="channel-item" onclick="toast(\'📢 ' + esc(ch.name) + '\')"><div class="channel-avatar">' + ch.avatar + '</div><div class="item-info"><div class="item-title">' + esc(ch.name) + '</div><div class="item-sub">' + ch.followers + ' متابع • ' + ch.update_info + '</div></div><span style="color:var(--text3);">›</span></div>';
    }).join('') : '<div class="empty-state"><p>لا توجد قنوات</p></div>';
}
$('#createChannelBtn')?.addEventListener('click', function() {
    var n = prompt('اسم القناة:'); if (!n || !n.trim()) return;
    sqlRun("INSERT INTO channels (id,name,avatar,followers,update_info) VALUES (?,?,?,?,?)", ['ch' + Date.now(), n.trim(), '📢', 0, 'الآن']);
    DB.channels = sqlQuery("SELECT * FROM channels"); renderChannels(); toast('✅ تم الإنشاء');
});

// ---------- شاشة الأدوات ----------
$('#startAdBtn')?.addEventListener('click', function() { toast('🚀 إعلان قريباً'); });
$('#catalogBtn')?.addEventListener('click', function() { showCatalog(); });
$('#broadcastBtn')?.addEventListener('click', function() { broadcastMessage(); });
function showCatalog() {
    var catalogHTML = '<div class="app-header"><button class="header-btn" onclick="showScreen(\'tools\')"><span>→</span></button><h2>📦 الكتالوج</h2><button class="header-btn" onclick="addCatalogItem()"><span>➕</span></button></div>' +
        '<div class="catalog-grid">' + (DB.catalog.length ? DB.catalog.map(function(c) {
            return '<div class="catalog-card" onclick="toast(\'🛒 ' + esc(c.name) + ' - ' + c.price + '\')"><div class="catalog-img">' + c.icon + '</div><div class="catalog-info"><h5>' + esc(c.name) + '</h5><span>' + c.price + '</span></div></div>';
        }).join('') : '<div class="empty-state"><span class="empty-icon">📦</span><p>الكتالوج فارغ</p></div>') + '</div>';
    var tempScreen = document.createElement('div'); tempScreen.className = 'screen active no-nav'; tempScreen.id = 'catalogTempScreen';
    tempScreen.innerHTML = catalogHTML; document.querySelector('.app-container').appendChild(tempScreen);
    $$('.screen').forEach(function(s) { s.classList.remove('active'); }); tempScreen.classList.add('active');
    $('#bottomNav').style.display = 'none'; window._catalogScreen = tempScreen;
}
function addCatalogItem() {
    var name = prompt('اسم المنتج:'); if (!name || !name.trim()) return;
    var price = prompt('السعر:'); var icon = prompt('أيقونة (إيموجي):', '📦');
    sqlRun("INSERT INTO catalog (id,name,price,icon) VALUES (?,?,?,?)", ['cat' + Date.now(), name.trim(), price || 'غير محدد', icon || '📦']);
    DB.catalog = sqlQuery("SELECT * FROM catalog");
    if (window._catalogScreen) window._catalogScreen.remove();
    showCatalog(); toast('✅ تمت الإضافة');
}

// ---------- الوسائط المشتركة ----------
function showSharedMedia(chatId) {
    var msgs = DB.messages[chatId] || [];
    var items = msgs.filter(function(m) { return m.media_type; }).map(function(m) {
        return { id: m.id, type: m.media_type, url: m.media_url, sender: m.sender_id, time: m.created_at };
    });
    items.sort(function(a, b) { return new Date(a.time) - new Date(b.time); });

    var filtered = items;
    var activeTab = $('#sharedMediaTabs .active')?.dataset?.type || 'all';
    if (activeTab !== 'all') filtered = items.filter(function(i) { return i.type === activeTab; });

    var grid = $('#sharedMediaGrid'); grid.innerHTML = '';
    if (filtered.length === 0) {
        $('#sharedMediaEmpty').style.display = 'block'; grid.style.display = 'none';
    } else {
        $('#sharedMediaEmpty').style.display = 'none'; grid.style.display = 'grid';
        filtered.forEach(function(item) {
            var card = document.createElement('div'); card.style.position = 'relative'; card.style.cursor = 'pointer';
            if (item.type === 'image') {
                var blob = getMediaFile(item.url); var src = blob ? URL.createObjectURL(blob) : '';
                card.innerHTML = '<img src="' + src + '" style="width:100%; height:100px; object-fit:cover; border-radius:8px;">';
                card.addEventListener('click', function() { if (src) openImageViewer(src); });
            } else if (item.type === 'video') {
                card.innerHTML = '<video style="width:100%; height:100px; object-fit:cover; border-radius:8px;" controls></video>';
            } else if (item.type === 'audio') {
                card.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100px; background:var(--surface3); border-radius:8px;">🎵 صوت</div>';
                card.addEventListener('click', function() {
                    var b = getMediaFile(item.url);
                    if (b) { var a = new Audio(URL.createObjectURL(b)); a.play(); }
                });
            } else {
                card.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100px; background:var(--surface3); border-radius:8px;">📄 مستند</div>';
            }
            grid.appendChild(card);
        });
    }
    $('#sharedMediaModal').classList.add('active'); $('#sharedMediaModal').dataset.chatId = chatId;
}
$$('#sharedMediaTabs button')?.forEach(function(btn) {
    btn.addEventListener('click', function() {
        $$('#sharedMediaTabs button').forEach(function(b) { b.classList.remove('active'); }); this.classList.add('active');
        var chatId = $('#sharedMediaModal').dataset.chatId; if (chatId) showSharedMedia(chatId);
    });
});
$('#closeSharedMediaBtn')?.addEventListener('click', function() { $('#sharedMediaModal').classList.remove('active'); });

// ---------- الإعدادات ----------
$('#closeSettingsBtn')?.addEventListener('click', function() { showScreen('chats'); });
$('#themeToggle')?.addEventListener('click', function(e) {
    if (e.target.closest('.toggle-sw') || e.target === this || e.target.closest('.setting-left')) {
        DB.theme = DB.theme === 'dark' ? 'light' : 'dark'; applyTheme(); saveDB();
        toast(DB.theme === 'dark' ? '🌙 الوضع الليلي' : '☀️ الوضع النهاري');
    }
});
$('#notifToggle')?.addEventListener('click', function(e) {
    if (e.target.closest('.toggle-sw') || e.target === this || e.target.closest('.setting-left')) {
        DB.notifications = !DB.notifications; $('#notifSwitch').classList.toggle('active', DB.notifications); saveDB();
        toast(DB.notifications ? '🔔 الإشعارات مفعلة' : '🔕 الإشعارات معطلة');
    }
});

function loadProfileToSettings() {
    if (!DB.user) return;
    var avatarEl = $('#profileSettingsAvatar'); if (avatarEl) avatarEl.textContent = DB.user.avatar || DB.user.name?.charAt(0) || '?';
    $('#profileBioInput').value = DB.user.bio || '';
    $('#profileStatusInput').value = DB.user.status || '';
    $('#profilePhoneInput').value = DB.user.phone || '';
    if (DB.user.profileImage) {
        if (avatarEl) { avatarEl.style.backgroundImage = 'url(' + DB.user.profileImage + ')'; avatarEl.style.backgroundSize = 'cover'; avatarEl.textContent = ''; }
    }
}
$('#changeProfileImageBtn')?.addEventListener('click', function() { $('#profileImageInput').click(); });
$('#profileImageInput')?.addEventListener('change', async function(e) {
    var file = e.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = async function(ev) { DB.user.profileImage = ev.target.result; await saveUserToSQLite(); loadProfileToSettings(); toast('✅ تم تحديث الصورة'); };
    reader.readAsDataURL(file);
});
$('#removeProfileImageBtn')?.addEventListener('click', async function() { DB.user.profileImage = null; await saveUserToSQLite(); loadProfileToSettings(); toast('🗑️ تم إلغاء الصورة'); });
$('#saveProfileBtn')?.addEventListener('click', async function() {
    if (!DB.user) return;
    DB.user.bio = $('#profileBioInput').value.trim();
    DB.user.status = $('#profileStatusInput').value.trim();
    var newPhone = $('#profilePhoneInput').value.trim();
    if (newPhone && newPhone !== DB.user.phone) {
        if (DB.user.isGuest) DB.user.phone = newPhone; else toast('⚠️ لا يمكن تغيير رقم الهاتف للمستخدمين المسجلين');
    }
    await saveUserToSQLite(); toast('✅ تم حفظ الملف الشخصي');
});

function changePhoneNumber() { toast('سيتم تفعيل تغيير رقم الهاتف قريباً'); }
function changePassword() { toast('سيتم تفعيل تغيير كلمة المرور قريباً'); }
function deleteAccount() {
    if (confirm('هل أنت متأكد من حذف حسابك نهائياً؟ لا يمكن التراجع.')) {
        clearAllData();
        localStorage.removeItem('ramz_user');
        window.location.href = 'login.html';
    }
}

document.getElementById('editProfileSettingsBtn')?.addEventListener('click', () => {
    showScreen('settings');
    document.getElementById('profileBioInput').scrollIntoView();
});
document.getElementById('profileCallBtn')?.addEventListener('click', () => {
    const user = selectedModalUser || DB.user;
    if (user) startWebRTC(user, 'voice');
});
document.getElementById('profileVideoBtn')?.addEventListener('click', () => {
    const user = selectedModalUser || DB.user;
    if (user) startWebRTC(user, 'video');
});

async function exploreContacts() {
    const currentUserId = DB.user?.id;
    if (!currentUserId) { toast('يجب تسجيل الدخول أولاً', true); return; }
    const modal = document.getElementById('exploreContactsModal');
    const listEl = document.getElementById('exploreContactsList');
    modal.style.display = 'flex';
    listEl.innerHTML = '<div style="text-align:center;color:var(--text3);">جارٍ التحميل...</div>';

    let users = [];
    if (supabase) {
        const { data, error } = await supabase.from('users').select('*');
        if (error) { listEl.innerHTML = '<div style="text-align:center;color:#ef4444;">فشل تحميل القائمة</div>'; console.error(error); return; }
        users = data || [];
    } else { listEl.innerHTML = '<div style="text-align:center;color:var(--text3);">الخدمة السحابية غير متاحة</div>'; return; }

    users = users.filter(u => u.external_id !== currentUserId && u.id !== currentUserId);
    if (users.length === 0) { listEl.innerHTML = '<div style="text-align:center;color:var(--text3);">لا يوجد مستخدمون آخرون</div>'; return; }

    listEl.innerHTML = '';
    users.forEach(u => {
        const alreadyChat = DB.chats.find(c => c.id === u.external_id);
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border);';
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--surface3); display: flex; align-items: center; justify-content: center; font-weight: bold;">${u.name.charAt(0)}</div>
                <div>
                    <div style="font-weight: 600;">${u.name || 'بدون اسم'}</div>
                    <div style="font-size: 12px; color: var(--text3);">${u.phone || u.email || ''}</div>
                </div>
            </div>
            <button class="promo-btn" style="font-size: 12px; padding: 6px 16px;" data-userid="${u.external_id}" data-name="${u.name}">
                ${alreadyChat ? 'محادثة' : 'إضافة'}
            </button>
        `;
        div.querySelector('button').addEventListener('click', () => {
            const userId = u.external_id;
            const userName = u.name;
            if (alreadyChat) { openChat(alreadyChat.id); }
            else { startOrOpenChat({ id: userId, name: userName, avatar: userName.charAt(0), bio: u.bio || '' }); }
            modal.style.display = 'none';
        });
        listEl.appendChild(div);
    });
}

document.getElementById('closeExploreContactsBtn')?.addEventListener('click', () => {
    document.getElementById('exploreContactsModal').style.display = 'none';
});

function exportData() {
    var b = exportDatabase(); if (!b) return toast('❌ لا يمكن التصدير');
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'ramzx_backup.db'; a.click(); toast('💾 تم تصدير قاعدة البيانات');
}
function importData() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.db';
    inp.onchange = async function(e) {
        var file = e.target.files[0];
        if (file && confirm('⚠️ استيراد قاعدة البيانات سيستبدل جميع البيانات. متابعة؟')) {
            var buffer = await file.arrayBuffer();
            await importDatabase(buffer); await loadFromSQLite(); showScreen('chats'); toast('✅ تم استيراد البيانات');
        }
    };
    inp.click();
}
function clearAllData() {
    if (confirm('⚠️ حذف جميع المحادثات والبيانات نهائياً؟')) {
        resetDatabase().then(async function() {
            await seedSQLiteIfEmpty(); await loadFromSQLite(); renderChats(); toast('🗑 تم حذف جميع البيانات');
        });
    }
}
async function logout() {
    if (confirm('تسجيل الخروج؟')) {
        await signOutUser();
        sqlRun("DELETE FROM settings WHERE key='user'");
        localStorage.removeItem('ramz_user');
        DB.user = null;
        window.location.href = 'login.html';
    }
}
async function syncToCloud(showToastFlag) {
    showToastFlag = showToastFlag !== false;
    if (!supabase || !DB.user || DB.user.isGuest) return;
    try {
        var result = await supabase.from('app_data').upsert({
            id: DB.user.id, user: DB.user, chats: DB.chats, messages: DB.messages, stories: DB.stories,
            channels: DB.channels, calls: DB.calls, catalog: DB.catalog, theme: DB.theme, notifications: DB.notifications,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        if (result.error) throw result.error;
        DB.lastCloudSync = new Date().toISOString(); await saveDB();
        if (showToastFlag) toast('✅ تمت المزامنة مع السحابة');
    } catch (err) { console.error(err); if (showToastFlag) toast('❌ فشلت المزامنة'); }
}

// ---------- PWA ----------
var deferredPrompt;
window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault(); deferredPrompt = e;
    var installBtn = document.getElementById('installBtn');
    if (installBtn) { installBtn.style.display = 'block'; }
    if (shouldShowInstallPrompt()) { setTimeout(function() { showInstallModal(); }, 3000); }
});
window.addEventListener('appinstalled', function() {
    var data = getInstallData(); data.installed = true; saveInstallData(data);
    deferredPrompt = null; hideInstallModal(); console.log('PWA installed');
});

function getInstallData() {
    try { return JSON.parse(localStorage.getItem('ramz_pwa_install')) || { dismissed: false, count: 0, lastDismissed: null, installed: false }; }
    catch (e) { return { dismissed: false, count: 0, lastDismissed: null, installed: false }; }
}
function saveInstallData(data) { localStorage.setItem('ramz_pwa_install', JSON.stringify(data)); }
function shouldShowInstallPrompt() {
    if (window.matchMedia('(display-mode: standalone)').matches) return false;
    var data = getInstallData();
    if (data.installed) return false;
    if (!data.dismissed) return true;
    if (data.lastDismissed) {
        var daysSince = (Date.now() - new Date(data.lastDismissed).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince >= 3) { data.dismissed = false; saveInstallData(data); return true; }
    }
    return false;
}
function showInstallModal() {
    var modal = document.getElementById('installModal');
    if (modal) modal.style.display = 'flex';
}
function hideInstallModal() {
    var modal = document.getElementById('installModal');
    if (modal) modal.style.display = 'none';
}
async function promptInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        var result = await deferredPrompt.userChoice;
        if (result.outcome === 'accepted') {
            var data = getInstallData(); data.installed = true; saveInstallData(data);
            hideInstallModal(); toast('✅ تم تثبيت التطبيق بنجاح');
        } else {
            var data = getInstallData(); data.dismissed = true; data.lastDismissed = new Date().toISOString();
            data.count = (data.count || 0) + 1; saveInstallData(data);
            hideInstallModal(); toast('يمكنك التثبيت لاحقاً من الإعدادات');
        }
        deferredPrompt = null;
    } else { hideInstallModal(); toast('خاصية التثبيت غير متاحة حالياً'); }
}
document.getElementById('installConfirmBtn')?.addEventListener('click', promptInstall);
document.getElementById('installDismissBtn')?.addEventListener('click', function() {
    var data = getInstallData(); data.dismissed = true; data.lastDismissed = new Date().toISOString();
    data.count = (data.count || 0) + 1; saveInstallData(data);
    hideInstallModal(); toast('سيتم تذكيرك لاحقاً');
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('sw.js').then(function(reg) { console.log('✅ SW'); }).catch(function(err) { console.error('SW error', err); });
    });
}

// ---------- استدعاء التهيئة المناسبة ----------
(function() {
    if (document.getElementById('phoneForm')) {
        initLoginPage();
    } else if (document.getElementById('appContainer')) {
        initApp();
    }
})();
