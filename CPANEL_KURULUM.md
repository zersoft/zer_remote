# remote.zersoft.net - cPanel Node.js Kurulum Kılavuzu

ZerRemote uygulamasını kendi cPanel hosting paketiniz üzerinde **`https://remote.zersoft.net`** adresiyle 7/24 kesintisiz çalıştırmak için hazırlanan kılavuzdur.

---

## 🛠 Adım 1: cPanel'de Subdomain Oluşturma

1. cPanel hesabınıza giriş yapın.
2. **Domains** -> **Subdomains (Alt Alan Adları)** bölümüne girin.
3. Subdomain kısmına `remote` yazın ve `zersoft.net` alan adınızı seçin (`remote.zersoft.net`).
4. **Create (Oluştur)** butonuna basın.

---

## 🚀 Adım 2: cPanel'de Node.js Uygulaması Tanımlama

1. cPanel ana sayfasında **Software** başlığı altındaki **"Setup Node.js App"** menüsüne girin.
2. **Create Application** butonuna tıklayın ve şu ayarları yapın:
   - **Node.js Version:** `18.x` veya `20.x`
   - **Application mode:** `Production`
   - **Application root:** `remote` (veya subdomain klasör adı)
   - **Application URL:** `remote.zersoft.net`
   - **Application startup file:** `server.js`
3. **Create** butonuna tıklayın.

---

## 📂 Adım 3: Dosyaları Yükleme

1. cPanel **File Manager (Dosya Yöneticisi)** açın ve `remote` klasörüne girin.
2. Projenizde oluşturulan `dist/ZerRemote-cPanel-Upload.zip` dosyasını bu klasöre yükleyin.
3. Dosyaya sağ tıklayıp **Extract (Zipten Çıkar)** deyin.

---

## ⚡ Adım 4: Çalıştırma (Run NPM Install)

1. **Setup Node.js App** ekranına dönün.
2. **Run NPM Install** butonuna basarak Express ve Socket.IO kütüphanelerini kurun.
3. **Restart Application** butonuna tıklayın.

---

## 🎈 Tebrikler!

Artık **`https://remote.zersoft.net`** adresiniz 7/24 canlıdır. Dünyanın her yerindeki Windows bilgisayarlar ve tarayıcılar bu adrese girerek AnyDesk / TeamViewer gibi bağlantı kurabilir!
