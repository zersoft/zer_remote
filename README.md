# 🚀 ZerRemote - Enterprise Uzak Erişim ve Masaüstü Kontrolü

**ZerRemote**, AnyDesk ve TeamViewer mantığında çalışan, modern WebRTC P2P ve Socket.IO teknolojileri üzerine inşa edilmiş, yüksek performanslı web & masaüstü uzak erişim ve ekran kontrol uygulamasıdır.

---

## ✨ Öne Çıkan Özellikler

- 📺 **60 FPS Canlı Masaüstü Akışı:** WebRTC P2P (AES-256 / SRTP) protokolü ile sıfır gecikmeli yüksek çözünürlüklü ekran paylaşımı.
- 🖱️ **Gerçek İşletim Sistemi Kontrolü:** Windows API (`user32.dll`) entegrasyonu ile yerel fare tıklamaları, sağ tık, sürükleme, tekerlek kaydırma ve klavye girdileri.
- 📦 **Taşınabilir Masaüstü İstemcisi (.exe):** Kurulum gerektirmeyen, çift tıkla çalışan AnyDesk stili bağımsız Windows uygulamaları (`x64` ve `ARM64`).
- 🎨 **Kurumsal UI/UX Tasarım:** Modern Dark/Light tema desteği, yüksek kontrastlı ID ve Parola paneli, canlı metrikler.
- 💬 **Canlı Sohbet & Dosya Transferi:** Oturum esnasında yüksek hızlı dosya aktarımı ve anlık mesajlaşma.
- 🔒 **Güvenli Sinyalleşme:** SSL / TLS şifreli cPanel Node.js sinyalleşme altyapısı (`remote.zersoft.net`).

---

## 🛠️ Yerel Geliştirme (Local Setup)

```bash
# Bağımlılıkları yükleyin
npm install

# Sunucuyu başlatın (http://localhost:3000)
npm start
```

## 📦 Windows .exe İstemcilerini Derleme

```bash
# Windows x64 ve ARM64 executable dosyalarını oluşturun
npm run build:exe
```

---

## ☁️ cPanel Kurulum Rehberi

1. `dist/ZerRemote-cPanel-Upload.zip` dosyasını cPanel File Manager üzerinden `remote` klasörünüze çıkarın.
2. cPanel **Setup Node.js App** ekranında başlangıç dosyasını `server.js` olarak belirleyin.
3. **Restart Application** butonuna basarak sunucunuzu canlıya alın!

---

## 📄 Lisans

MIT License © 2026 [Zersoft](https://github.com/zersoft)
