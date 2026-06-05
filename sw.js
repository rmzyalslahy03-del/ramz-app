// ============================================================
// sw.js - Service Worker for ramz-App v6.0
// يدعم العمل دون اتصال كامل (Offline-First)
// ============================================================

const CACHE_NAME = 'ramz-app-v6.0';
const STATIC_ASSETS = [
  '/',
  'index.html',
  'login.html',
  'common.js',
  'sqlite-manager.js',
  'common.css',
  'manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap',
  'https://cdn.jsdelivr.net/npm/sql.js@1.11.0/dist/sql-wasm.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

// التثبيت: تخزين جميع الملفات الثابتة في الكاش
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('✅ Service Worker: جاري تخزين الملفات الأساسية');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// التفعيل: حذف الكاش القديم
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('🗑️ حذف الكاش القديم:', key);
          return caches.delete(key);
        })
      );
    })
  );
});

// استراتيجية الكاش أولاً ثم الشبكة (Cache First, Network Update)
self.addEventListener('fetch', event => {
  // تجاهل الطلبات غير GET أو التي تتعلق بـ Supabase/API (لا نخزنها)
  if (event.request.method !== 'GET') return;

  // لا نخزن طلبات Supabase REST أو Realtime
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // إرجاع النسخة المخزنة فوراً
        // مع تحديث الكاش في الخلفية
        fetch(event.request).then(response => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, response.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // لا يوجد في الكاش، جلب من الشبكة
      return fetch(event.request).then(response => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // إذا فشل الاتصال تماماً (لا يوجد إنترنت)
        return new Response('أنت غير متصل بالإنترنت. التطبيق يعمل محلياً.', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
