// Uygulama olarak yüklenebilmesi için gereken sade servis dosyası.
// Hiçbir şeyi önbelleğe almaz, bu yüzden güncellemeler hemen görünür.
self.addEventListener("install",function(){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(self.clients.claim())});
self.addEventListener("fetch",function(){});
