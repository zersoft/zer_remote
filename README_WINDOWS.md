# ZerRemote - Windows (.exe) Kurulum ve Kullanım Kılavuzu

Görselde ilettiğiniz Windows Server ve ARM ortamlarında karşılaşılan yükleyici sorununu tamamen çözmek için **sıfır kurulum gerektiren (Zero-Installation)** bağımsız `.exe` dosyaları üretilmiştir.

---

## 🛠 Neden Setup Boş Klasör Oluşturdu?

Mac ortamından cross-compile edilen Electron paketleri, eski Windows Server sürümlerinde (Server 2012/2016) veya ARM işlemcilerde varsayılan grafik kütüphaneleri eksik olduğunda sessizce sadece kaldırıcıyı (Uninstall.exe) yükleyip kapanabilir.

---

## ✅ Tam Çözüm: Tek Dosya Bağımsız `.exe` (Single Executable)

Proje dizinindeki `dist/` klasöründe **hiçbir kurulum gerektirmeyen, doğrudan çalışan** 2 adet `.exe` yer almaktadır:

1. **`dist/zer-remote-x64.exe`** (~38 MB)
   - **Tüm Intel ve AMD tabanlı Windows bilgisayarlar** (Win 10, Win 11, Windows Server 2012, 2016, 2019, 2022) içindir.

2. **`dist/zer-remote-arm64.exe`** (~29 MB)
   - **ARM tabanlı Windows bilgisayarlar** (Surface ARM, Snapdragon, Windows ARM Sanal Makineleri) içindir.

---

## 🚀 Çalıştırma Adımları

1. Karşı Windows bilgisayarın mimarisine uygun olan `.exe` dosyasını (`zer-remote-x64.exe` veya `zer-remote-arm64.exe`) karşı cihaza kopyalayın.
2. `.exe` dosyasına çift tıklayın.
3. Uygulama anında çalışarak varsayılan tarayıcıda `http://localhost:3000` adresini otomatik açacak ve ekrana **9 Haneli Cihaz ID** ile **Güvenlik Parolasını** getirecektir.
4. Kendi cihazınızdan bu ID ve Parolayla bağlandığınızda uzak kontrol başlayacaktır!
