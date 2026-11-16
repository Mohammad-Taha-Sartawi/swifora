# إعداد تسجيل الدخول عبر Google

زر «المتابعة باستخدام Google» جاهز في التطبيق والسيرفر، لكنه **لا يظهر للمستخدمين** حتى تضيف معرّفات Google أدناه. لا توجد أسرار هنا: معرّفات عملاء OAuth علنية بطبيعتها.

## 1. في Google Cloud Console (أو Firebase لنفس المشروع)

1. افتح مشروع Firebase الحالي للتطبيق (نفس مشروع الإشعارات) في <https://console.cloud.google.com>.
2. **APIs & Services ← OAuth consent screen:**
   - النوع **External**.
   - اسم التطبيق «Swifora Delivery»، وبريد الدعم، والشعار.
   - رابط سياسة الخصوصية: `https://<عنوان السيرفر>/privacy`
   - رابط شروط الاستخدام: `https://<عنوان السيرفر>/terms`
   - انشر الشاشة (Publish).
3. **Credentials ← Create credentials ← OAuth client ID ← Web application.** سمِّه «Swifora server» وانسخ **Client ID**. هذا هو «معرّف الويب».
4. **أنشئ معرّفاً من نوع Android** (Create credentials ← OAuth client ID ← Android):
   - **Package name:** `com.swifora.app`
   - **SHA-1:** أنشئ عميلاً لكل بصمة توقيع:
     - **للتجربة (debug)، على هذا الجهاز:** `ED:8E:24:FD:4B:4C:2C:21:FB:9D:C5:C0:F0:44:AA:8D:73:81:AE:EE`
     - **لنسخة الإصدار (upload key):** شغّل الأمر التالي مع مسار مفتاحك من `android/key.properties`:
       ```
       keytool -list -v -keystore <مسار المفتاح> -alias <الاسم>
       ```
     - **إذا كان النشر عبر Google Play App Signing:** انسخ SHA-1 من Play Console ← Test and release ← App integrity ← App signing key.

## 2. السيرفر

أضف إلى `/etc/stars-delivery/stars-delivery.env`:

```
GOOGLE_OAUTH_CLIENT_IDS=<معرّف الويب>
```

ثم أعد تشغيل الخدمة. بدون هذا السطر يرفض السيرفر تسجيل الدخول عبر Google برسالة واضحة.

## 3. بناء التطبيق

أضف إلى أمر البناء (مع باقي `--dart-define` الحالية):

```
--dart-define=GOOGLE_SERVER_CLIENT_ID=<معرّف الويب>
```

## 4. iOS (عند إصدار نسخة iOS)

1. أنشئ معرّف OAuth من نوع **iOS** بالـ Bundle ID الخاص بالتطبيق.
2. ابنِ التطبيق مع: `--dart-define=GOOGLE_IOS_CLIENT_ID=<معرّف iOS>`
3. أضف إلى `ios/Runner/Info.plist` ضمن `CFBundleURLTypes` رابطاً (URL scheme) يساوي المعرّف مقلوباً. مثال: `com.googleusercontent.apps.1234-abcd`.

بدون هذه الخطوات لا يظهر الزر على iOS.

## كيف يعمل

**المستخدم يختار «زبون» أو «سائق» ثم يضغط الزر:**
- **له حساب بنفس الحساب في Google، أو بنفس البريد (الذي أكّدته Google):** يدخل مباشرة، ويُربط حسابه بـ Google.
- **حسابه بالنوع الآخر:** تظهر رسالة توضح ذلك، مثل «هذا الحساب مسجّل كسائق».
- **سائق طلبه قيد المراجعة:** تظهر رسالة «حسابك قيد المراجعة».

**مستخدم جديد:**
- تظهر شاشة «إكمال التسجيل»:
  - الاسم من Google، ويمكن تعديله.
  - البريد من Google، ولا يمكن تعديله.
  - رقم الهاتف والمحافظة والمدينة إلزامية.
  - السائق يختار نوع الخدمات أيضاً.
- بعدها نافذتا الموافقة على شروط الاستخدام وسياسة الخصوصية.
- الزبون يدخل التطبيق مباشرة.
- السائق يُرسل طلبه للمراجعة في لوحة التحكم، كالتسجيل العادي. عند الموافقة عليه يبقى مربوطاً بـ Google.

**كلمة المرور:** الحسابات المنشأة عبر Google ليس لها كلمة مرور. يمكن لأصحابها تعيين واحدة من «نسيت كلمة المرور».
