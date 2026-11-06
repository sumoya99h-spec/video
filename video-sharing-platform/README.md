# 🎬 Drive Video Share Platform

** লিংক দিয়ে ভিডিও শেয়ার + ডাউনলোড + Admin Panel + Adsterra Ad Control (প্রতি ভিডিওতে আলাদা অ্যাড)**

সম্পূর্ণ **ফ্রি** ওপেন সোর্স প্রজেক্ট। কোনো পেমেন্ট লাগবে না।

---

## ✨ ফিচার

- ✅  ব্যবহার করে ভিডিও দেখানো
- ✅ ভিডিও প্লেয়ার (Drive Embed)
- ✅ **ডাউনলোড** বাটন
- ✅ Admin থেকে চালু করলে দুটি বিজ্ঞাপন দেখার পর ভিডিও ও ডাউনলোড আনলক
- ✅ শেয়ার বাটন
- ✅ সার্চ + ক্যাটাগরি ফিল্টার
- ✅ **Admin Panel** (পাসওয়ার্ড প্রটেক্টেড)
- ✅ ভিডিও Add / Edit / Delete
- ✅ **প্রতিটি ভিডিওতে আলাদা আলাদা Adsterra অ্যাড কোড** সেট করা যায়
- ✅ যে যে জায়গায় অ্যাড কোড দিবেন, শুধু সেখানেই অ্যাড রান করবে:
  - Top Banner
  - Player এর উপরে
  - Player এর নিচে
  - Bottom Banner
  - Sidebar
  - Native
  - Popup/Popunder
- ✅ ভিউ কাউন্ট
- ✅ মোবাইল রেসপন্সিভ

---

## 🚀 কিভাবে চালাবেন (লোকাল)

### ১. Node.js ইনস্টল থাকতে হবে (v18+)

### ২. প্রজেক্ট ফোল্ডারে যান
```bash
cd video-sharing-platform
```

### ৩. Dependencies ইনস্টল
```bash
npm install
```

### ৪. সার্ভার চালু করুন
```bash
npm start
```

### ৫. ব্রাউজারে খুলুন
- **Website:** http://localhost:3000
- **Admin Panel:** http://localhost:3000/admin
- **Default Password:** `admin123`

> Password বদলাতে চাইলে: `ADMIN_PASSWORD=yourpassword npm start`

---

## 🌐 ফ্রি তে হোস্ট করার উপায়

### Option 1: Render.com (সবচেয়ে সহজ)
1. https://render.com এ একাউন্ট খুলুন (ফ্রি)
2. New → Web Service
3. GitHub এ এই প্রজেক্ট আপলোড করে কানেক্ট করুন
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Environment Variable যোগ করুন: `ADMIN_PASSWORD` = আপনার পাসওয়ার্ড

### Option 2: Railway.app
একইভাবে GitHub থেকে deploy করুন।

### Option 3: VPS / DigitalOcean / Contabo
Node.js ইনস্টল করে `npm start` চালান + PM2 ব্যবহার করুন।

---

## 📢 Adsterra কিভাবে যোগ করবেন

1. [Adsterra](https://adsterra.com) তে একাউন্ট খুলুন
2. Website Add করুন এবং Ad Unit তৈরি করুন (Banner, Native, Popunder ইত্যাদি)
3. Ad Code কপি করুন
4. Admin Panel → Video Add/Edit → নিচের **Adsterra Ads** সেকশনে পেস্ট করুন
5. যে যে পজিশনে কোড দিবেন, শুধু সেই পজিশনেই অ্যাড দেখাবে

**গুরুত্বপূর্ণ:** প্রতিটি ভিডিওতে আলাদা আলাদা অ্যাড কোড দিতে পারবেন। এক ভিডিওতে এক ধরনের অ্যাড, অন্য ভিডিওতে অন্য ধরনের অ্যাড চালাতে পারবেন।

---

## 📁 Google Drive লিংক কিভাবে দিবেন

1. Google Drive এ ভিডিও আপলোড করুন
2. Right click → Share → **Anyone with the link**
3. লিংক কপি করুন (যেমন: `https://drive.google.com/file/d/1ABC...xyz/view`)
4. Admin Panel এ পেস্ট করুন

সিস্টেম অটোমেটিক File ID বের করে Embed + Download লিংক তৈরি করে দিবে।

### দুটি বিজ্ঞাপন দেখার পর আনলক

Admin Panel → Video Add/Edit থেকে **দুটি বিজ্ঞাপন দেখার পর ভিডিও ও ডাউনলোড আনলক করুন** চালু করুন এবং ওই ভিডিওর **Player এর উপরে** ও **Player এর নিচে** Ad Code দিন। দর্শক দুটি বিজ্ঞাপন অন্তত ১ সেকেন্ড দৃশ্যমান রাখলে আনলক বাটন চালু হবে; বিজ্ঞাপনে ক্লিকের প্রয়োজন নেই। একই ব্রাউজারে আনলকটি সংরক্ষিত থাকবে।

এটি ওয়েবসাইটের UI-ভিত্তিক আনলক; Google Drive-এর Anyone-with-the-link লিংক সরাসরি শেয়ার বা API দিয়ে পাওয়া গেলে Drive-এ ভিডিও আলাদাভাবেও খোলা/ডাউনলোড করা সম্ভব। সত্যিকারের ad impression যাচাই বা Drive ফাইল সুরক্ষিত করতে provider-এর অনুমোদিত rewarded-ad যাচাই ও private file delivery দরকার।

---

## 🔒 সিকিউরিটি নোট

- প্রোডাকশনে অবশ্যই `ADMIN_PASSWORD` environment variable দিয়ে পাসওয়ার্ড পরিবর্তন করুন
- HTTPS ব্যবহার করুন (Render/Railway অটো HTTPS দেয়)
- Data `data/videos.json` এবং `data/settings.json` এ সেভ হয়

---

## 📂 ফোল্ডার স্ট্রাকচার

```
video-sharing-platform/
├── server.js          # Backend (Express)
├── package.json
├── data/              # JSON database
│   ├── videos.json
│   └── settings.json
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── README.md
```

---

## 🛠️ কাস্টমাইজেশন

- সাইটের নাম ও বিবরণ: Admin → Settings
- কালার থিম: `public/css/style.css` এর `:root` ভেরিয়েবল পরিবর্তন করুন
- আরও অ্যাড পজিশন যোগ করতে চাইলে `server.js` এবং `app.js` এ সহজেই যোগ করা যায়

---

**Created for free use. Enjoy!** ❤️
