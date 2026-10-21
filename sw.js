// Uygulama olarak yüklenebilmesi ve bildirim gösterebilmesi için gereken sade servis dosyası.
// Hiçbir şeyi önbelleğe almaz, bu yüzden güncellemeler hemen görünür.
self.addEventListener("install",function(){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(self.clients.claim())});
self.addEventListener("fetch",function(){});

// Sunucudan gelen bildirimi göster (başlık ve metin "data" içinde gelir).
self.addEventListener("push",function(e){
  var d={};try{d=e.data.json()}catch(x){}
  var n=d.notification||{},dt=d.data||{};
  var title=n.title||dt.title||"KoçNot",body=n.body||dt.body||"";
  e.waitUntil(self.registration.showNotification(title,{body:body,icon:"icon-192.png",badge:"icon-192.png",tag:dt.tag||undefined}));
});
self.addEventListener("notificationclick",function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(function(l){
    for(var i=0;i<l.length;i++){if("focus" in l[i])return l[i].focus()}
    return self.clients.openWindow("./");
  }));
});
