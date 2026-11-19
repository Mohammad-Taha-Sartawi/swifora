# Swifora Delivery — سويفورا دليفري

<div dir="rtl">

## نبذة عن التطبيق

**سويفورا دليفري** منصة توصيل تجمع الزبائن والسائقين في فلسطين. يطلب الزبون ما يحتاجه، فيصل الطلب إلى السائقين في منطقته، ويرسل كل سائق عرض سعر. يختار الزبون العرض المناسب ويتابع الطلب حتى يصل.

المنصة من ثلاثة أجزاء:

- **تطبيق جوال** (Flutter) للزبائن والسائقين، يعمل على أندرويد و iOS.
- **خادم** (Node.js و MongoDB) يدير الحسابات والطلبات والعروض والإشعارات والتحديثات الفورية.
- **لوحة تحكم** على الويب لفريق الإدارة.

## الخدمات

| الخدمة | الوصف |
|---|---|
| طلب منتج | شراء منتج وتوصيله إلى الزبون |
| توصيل أشخاص | نقل الأشخاص من مكان إلى آخر |
| نقل بضاعة | نقل البضائع والأغراض |

## الميزات

### للزبون

- إنشاء حساب بالبريد الإلكتروني، أو الدخول مباشرة بحساب Google. يُطلب رقم الهاتف والمنطقة مع أول طلب فقط.
- إنشاء طلب لأي من الخدمات الثلاث، مع العنوان ورقم التواصل.
- استلام عروض أسعار من السائقين وقبول المناسب منها.
- متابعة الطلب على الخريطة حتى التسليم.
- تقييم السائق بعد انتهاء الطلب، وتقديم بلاغ عند وجود مشكلة.
- إشعارات فورية بكل تغيير في الطلب، ومحادثة مع فريق الدعم.
- الشاشة الرئيسية تعرض الطلبات الجارية فقط، دون قوائم فارغة.
- طلب حذف الحساب من داخل التطبيق، مع إمكانية التراجع ما دام قيد المراجعة.

### للسائق

- تسجيل حساب سائق مع مستندات التحقق، ويراجعها فريق الإدارة قبل التفعيل.
- استلام الطلبات الجديدة في منطقته ومحافظته فور إنشائها.
- إرسال عروض الأسعار ومتابعة الطلبات المقبولة وعمليات التوصيل النشطة.
- متابعة عمولة المنصة المستحقة وتسجيل دفعها.
- تقييم الزبون بعد انتهاء الطلب.
- تقرير بالطلبات والعروض السابقة.
- طلب حذف الحساب، ويتحقق الفريق أولاً من عدم وجود عمولة غير مدفوعة.

### لفريق الإدارة (لوحة التحكم)

- مراجعة طلبات تسجيل السائقين وتفعيل الحسابات أو إيقافها.
- متابعة الطلبات والعروض والعمولات ودفعاتها.
- إدارة المحافظات والمناطق، والإعلانات، والرسائل الجماعية.
- الرد على محادثات الدعم ومعالجة البلاغات.
- مراجعة طلبات حذف الحسابات والموافقة عليها.
- تحديث فوري للصفحات والعدّادات دون إعادة تحميل، وسجل لكل إجراء إداري.

### عامة

- واجهة بالعربية (من اليمين لليسار) والإنجليزية.
- مظهر نهاري ومظهر ليلي.
- حماية الحسابات: كلمات سر مشفّرة، وجلسات موقّعة، وحدّ لعدد المحاولات، وحماية لوحة التحكم من الهجمات الشائعة.
- استعادة كلمة السر عبر البريد الإلكتروني.

## التقنيات المستخدمة

| الجزء | التقنيات |
|---|---|
| التطبيق | Flutter و Dart، وإدارة الحالة بـ BLoC، و Dio للاتصال بالخادم، و Socket.IO للتحديثات الفورية، و flutter_map للخرائط، و Geolocator للموقع |
| الإشعارات | Firebase Cloud Messaging |
| تسجيل الدخول | JWT، و Google Sign-In |
| الخادم | Node.js و Express، و MongoDB عبر Mongoose، و Socket.IO |
| لوحة التحكم | صفحات EJS مع JavaScript، وجلسات محفوظة في MongoDB |
| الحماية | Helmet، و express-rate-limit، و bcrypt، وحماية CSRF |
| البريد | Nodemailer |
| الاختبارات | flutter_test، و node:test مع Supertest و MongoDB Memory Server |
| التشغيل على الخادم | Linux و systemd و Nginx |

## هيكل المشروع

```
lib/                 كود التطبيق (الشاشات، BLoC، الخدمات، الواجهات)
test/                اختبارات التطبيق
assets/              الشعار والصور
android/ ios/        إعدادات المنصات
swifora_backend/     الخادم ولوحة التحكم
  src/routes/        واجهات API وصفحات لوحة التحكم
  src/models/        نماذج قاعدة البيانات
  test/              اختبارات الوحدة
  integration/       اختبارات التكامل
deployment/          ملفات النشر على الخادم (systemd و Nginx)
docs/                وثائق إضافية
```

## طريقة التشغيل

### المتطلبات

- Flutter 3.47 أو أحدث
- Node.js 24
- MongoDB (محلياً أو على خادم)

### تشغيل الخادم

```bash
cd swifora_backend
cp .env.example .env      # ثم املأ القيم المطلوبة
npm ci
ADMIN_EMAIL=... ADMIN_FULL_NAME=... ADMIN_PASSWORD=... npm run admin:bootstrap
npm run dev
```

يعمل الخادم على المنفذ 3000، ولوحة التحكم على `http://localhost:3000/admin`. قائمة المحافظات والمناطق تُحمَّل تلقائياً عند التشغيل.

أهم الإعدادات في ملف `.env`:

| الإعداد | الاستخدام |
|---|---|
| `MONGODB_URI` | عنوان قاعدة البيانات |
| `JWT_SECRET` و `SESSION_SECRET` | مفاتيح توقيع الجلسات |
| `SMTP_*` | إرسال البريد (استعادة كلمة السر) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | الإشعارات الفورية |
| `GOOGLE_OAUTH_CLIENT_IDS` | تسجيل الدخول بحساب Google |

### تشغيل التطبيق

```bash
flutter pub get
flutter run --dart-define=SWIFORA_SERVER_URL=http://10.0.2.2:3000
```

العنوان `10.0.2.2` يصل من محاكي أندرويد إلى الخادم على جهازك. على هاتف حقيقي استخدم عنوان جهازك في الشبكة.

### الاختبارات

```bash
flutter analyze
flutter test

cd swifora_backend
npm test                  # اختبارات الوحدة
npm run test:integration  # اختبارات التكامل (تشغّل MongoDB مؤقتة)
```

تعمل هذه الاختبارات تلقائياً على GitHub Actions مع كل تعديل.

### بناء نسخة الإصدار

```bash
flutter build apk --release --split-per-abi --dart-define-from-file=swifora-defines.json
```

يحتوي ملف `swifora-defines.json` على عنوان الخادم ومفاتيح Firebase و Google، ويُحفظ خارج المستودع. ينتج عن الأمر ملف لكل نوع معالج، وملف `arm64-v8a` (نحو 23 ميجابايت) يعمل على كل الهواتف الحديثة. للنشر على Google Play استخدم `flutter build appbundle`.

## وثائق إضافية

- [النشر على الخادم](deployment/README.md)
- [إعداد تسجيل الدخول بحساب Google](docs/google-sign-in-setup.md)
- النسخ الاحتياطي والاستعادة: القسم الأخير من هذا الملف

</div>

---

## About

**Swifora Delivery** is a delivery platform that connects customers and drivers in Palestine. A customer places an order, it reaches the drivers in their area, and each driver sends a price offer. The customer picks an offer and follows the order until it arrives.

The platform has three parts:

- **A mobile app** (Flutter) for customers and drivers, on Android and iOS.
- **A server** (Node.js and MongoDB) for accounts, orders, offers, notifications and live updates.
- **A web dashboard** for the admin team.

## Services

| Service | Description |
|---|---|
| Product order | Buy a product and deliver it to the customer |
| People transport | Take people from one place to another |
| Goods transport | Move goods and belongings |

## Features

### Customers

- Sign up with email, or enter directly with a Google account. Phone and area are asked only with the first order.
- Create an order for any of the three services, with the address and a contact number.
- Receive price offers from drivers and accept the right one.
- Follow the order on the map until it is delivered.
- Rate the driver after the order and report a problem when there is one.
- Push notifications for every order change, and a chat with the support team.
- The home screen shows only orders under way, with no empty lists.
- Request account deletion in the app, and withdraw it while it is under review.

### Drivers

- Sign up as a driver with verification documents, reviewed by the admins before activation.
- Receive new orders in their area and governorate as soon as they are created.
- Send price offers and follow accepted orders and active deliveries.
- Track the platform commission owed and record payments.
- Rate the customer after the order.
- A report of past orders and offers.
- Request account deletion; the team first checks for unpaid commission.

### Admins (dashboard)

- Review driver sign-ups and activate or suspend accounts.
- Follow orders, offers, commissions and payments.
- Manage governorates and areas, ads and broadcast messages.
- Answer support chats and handle reports.
- Review and approve account deletion requests.
- Pages and counters update live without reloading, and every admin action is logged.

### General

- Arabic (right-to-left) and English interface.
- Day and dark themes.
- Account security: hashed passwords, signed sessions, rate limits, and dashboard protection against common attacks.
- Password recovery by email.

## Technology

| Part | Technology |
|---|---|
| App | Flutter and Dart, BLoC for state, Dio for the API, Socket.IO for live updates, flutter_map for maps, Geolocator for location |
| Notifications | Firebase Cloud Messaging |
| Sign-in | JWT, Google Sign-In |
| Server | Node.js and Express, MongoDB with Mongoose, Socket.IO |
| Dashboard | EJS pages with JavaScript, sessions stored in MongoDB |
| Security | Helmet, express-rate-limit, bcrypt, CSRF protection |
| Email | Nodemailer |
| Tests | flutter_test; node:test with Supertest and MongoDB Memory Server |
| Hosting | Linux, systemd and Nginx |

## Project structure

```
lib/                 App code (screens, BLoC, services, widgets)
test/                App tests
assets/              Logo and images
android/ ios/        Platform settings
swifora_backend/     Server and dashboard
  src/routes/        API endpoints and dashboard pages
  src/models/        Database models
  test/              Unit tests
  integration/       Integration tests
deployment/          Server deployment files (systemd and Nginx)
docs/                Further documentation
```

## Getting started

### Requirements

- Flutter 3.47 or newer
- Node.js 24
- MongoDB (local or hosted)

### Run the server

```bash
cd swifora_backend
cp .env.example .env      # then fill in the required values
npm ci
ADMIN_EMAIL=... ADMIN_FULL_NAME=... ADMIN_PASSWORD=... npm run admin:bootstrap
npm run dev
```

The server listens on port 3000 and the dashboard is at `http://localhost:3000/admin`. The governorate and area list loads automatically on start.

Main settings in `.env`:

| Setting | Used for |
|---|---|
| `MONGODB_URI` | Database address |
| `JWT_SECRET` and `SESSION_SECRET` | Session signing keys |
| `SMTP_*` | Sending email (password recovery) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Push notifications |
| `GOOGLE_OAUTH_CLIENT_IDS` | Google sign-in |

### Run the app

```bash
flutter pub get
flutter run --dart-define=SWIFORA_SERVER_URL=http://10.0.2.2:3000
```

`10.0.2.2` reaches the server on your computer from the Android emulator. On a real phone, use your computer's network address.

### Tests

```bash
flutter analyze
flutter test

cd swifora_backend
npm test                  # unit tests
npm run test:integration  # integration tests (start a temporary MongoDB)
```

These tests also run on GitHub Actions for every change.

### Release build

```bash
flutter build apk --release --split-per-abi --dart-define-from-file=swifora-defines.json
```

`swifora-defines.json` holds the server address and the Firebase and Google keys, and is kept outside the repository. The command builds one APK per processor type; the `arm64-v8a` file (about 23MB) runs on all modern phones. For Google Play, use `flutter build appbundle`.

## Further documentation

- [Server deployment](deployment/README.md)
- [Google sign-in setup](docs/google-sign-in-setup.md)
- Backup and restore: the next section

## Production backup and restore

Swifora has three persistent application-data surfaces:

1. the MongoDB database;
2. private provider-verification files in `PROVIDER_DOCUMENTS_DIR`;
3. order-upload files in `swifora_backend/uploads`.

A valid application backup must contain all three.

MongoDB Database Tools (`mongodump` and `mongorestore`) must be installed on the production operations host. Backup output must be written to an absolute directory outside the Git repository and should then be copied to protected off-host storage.

### Backup

Stop or otherwise quiesce application writes before taking a backup so MongoDB metadata and filesystem files represent the same operational point.

From `swifora_backend`:

```bash
export SWIFORA_BACKUP_ROOT="/absolute/protected/backup/root"
export SWIFORA_BACKUP_QUIESCED="SWIFORA_BACKUP_WRITES_QUIESCED"
npm run ops:backup
```

The command uses the configured `MONGODB_URI` and `PROVIDER_DOCUMENTS_DIR`. It creates a timestamped directory containing:

- `mongo.archive.gz`
- `provider-documents/`
- `uploads/`
- `manifest.json`

The manifest contains SHA-256 integrity information but never stores the MongoDB URI or application secrets.

### Restore

Restores are destructive. Stop the application first and verify that the selected backup is the intended recovery point.

Set `SWIFORA_RESTORE_FROM` to the timestamped backup directory:

```bash
export SWIFORA_RESTORE_FROM="/absolute/protected/backup/root/swifora-backup-YYYYMMDDTHHMMSSZ"
export SWIFORA_RESTORE_CONFIRM="RESTORE_SWIFORA_DATA"
npm run ops:restore
```

Before invoking `mongorestore`, the restore command verifies the Mongo archive and filesystem contents against `manifest.json`. MongoDB is restored with `--drop`; provider documents and order uploads are then replaced from the verified backup.

Do not store production backup directories, MongoDB credentials, `.env` files, or provider documents in Git.
