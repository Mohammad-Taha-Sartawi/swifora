import 'package:flutter/material.dart';

class AppLocalization {
  final Locale locale;
  AppLocalization(this.locale);

  static bool _isAr(Locale l) => l.languageCode == 'ar';

  static String of(BuildContext context) {
    final loc = Localizations.localeOf(context).languageCode;
    return loc;
  }

  static bool isArabic(BuildContext context) => of(context) == 'ar';

  // Centralized string lookup
  static String get(BuildContext context, String key) {
    final ar = _isAr(Localizations.localeOf(context));
    return _strings[key]?[ar ? 'ar' : 'en'] ?? key;
  }

  static final Map<String, Map<String, String>> _strings = {
    // Sign in with Google
    'continue_with_google': {
      'ar': 'المتابعة باستخدام Google',
      'en': 'Continue with Google',
    },
    'or_divider': {'ar': 'أو', 'en': 'or'},
    'google_sign_in_failed': {
      'ar': 'تعذّر تسجيل الدخول عبر Google. حاول مرة أخرى.',
      'en': "Couldn't sign in with Google. Please try again.",
    },
    'google_complete_title': {'ar': 'إكمال التسجيل', 'en': 'Complete sign-up'},
    'google_complete_hint_customer': {
      'ar': 'خطوة أخيرة: أضف رقم هاتفك ومنطقتك ليصلك السائقون.',
      'en': 'One last step: add your phone and area so drivers can reach you.',
    },
    'google_complete_hint_driver': {
      'ar':
          'أكمل بيانات السائق: الهاتف والمحافظة والمدينة ونوع الخدمات. يُراجع طلبك من الإدارة قبل التفعيل.',
      'en':
          'Complete your driver details: phone, governorate, city and services. Your request is reviewed before activation.',
    },
    'google_complete_submit_customer': {
      'ar': 'إنشاء الحساب',
      'en': 'Create account',
    },
    'google_complete_submit_driver': {
      'ar': 'إرسال طلب التسجيل',
      'en': 'Send sign-up request',
    },
    'phone_invalid': {
      'ar': 'رقم الهاتف غير صحيح',
      'en': 'Invalid phone number',
    },
    'name_invalid': {
      'ar': 'اكتب الاسم الكامل (من حرفين إلى 80 حرفاً)',
      'en': 'Enter the full name (2 to 80 characters)',
    },
    'something_went_wrong': {
      'ar': 'تعذّر إتمام الطلب. حاول مرة أخرى.',
      'en': 'Something went wrong. Please try again.',
    },
    'contact_need_email_or_phone': {
      'ar': 'أدخل بريداً إلكترونياً أو رقم هاتف لنرد عليك',
      'en': 'Enter an email or a phone number so we can reply',
    },
    'phone_invalid_hint': {
      'ar':
          'رقم غير صحيح. أدخل رقم جوال من 10 أرقام يبدأ بـ 05، مثل 0599123456',
      'en':
          'Invalid number. Enter a 10-digit mobile number starting with 05, e.g. 0599123456',
    },
    'email_incomplete': {
      'ar': 'البريد غير صحيح. اكتبه كاملاً، مثل name@gmail.com',
      'en': 'Invalid email. Enter the full address, e.g. name@gmail.com',
    },
    'email_typo': {
      'ar': 'يبدو أن في البريد خطأً إملائياً. هل تقصد %s؟',
      'en': 'This email looks misspelled. Did you mean %s?',
    },
    // Privacy policy and terms of use
    'privacy_policy': {'ar': 'سياسة الخصوصية', 'en': 'Privacy policy'},
    'terms_of_use': {'ar': 'شروط الاستخدام', 'en': 'Terms of use'},
    'legal_load_failed': {
      'ar': 'تعذّر تحميل النص. تحقق من الاتصال وحاول مرة أخرى.',
      'en': "Couldn't load the text. Check your connection and try again.",
    },
    'legal_not_published': {
      'ar': 'لم يُنشر هذا النص بعد.',
      'en': "This text hasn't been published yet.",
    },
    'legal_updated_at': {'ar': 'آخر تحديث: %s', 'en': 'Last updated: %s'},
    // Ratings: clear numbered stars; customer rating for drivers
    'rating_word_1': {'ar': 'سيء جداً', 'en': 'Very poor'},
    'rating_word_2': {'ar': 'سيء', 'en': 'Poor'},
    'rating_word_3': {'ar': 'مقبول', 'en': 'Okay'},
    'rating_word_4': {'ar': 'جيد جداً', 'en': 'Very good'},
    'rating_word_5': {'ar': 'ممتاز', 'en': 'Excellent'},
    'rating_value_of_five': {'ar': '%d من 5', 'en': '%d out of 5'},
    'rating_pick_hint': {
      'ar': 'اضغط على نجمة: 1 الأقل و5 الأفضل',
      'en': 'Tap a star: 1 is lowest, 5 is best',
    },
    'rating_send': {'ar': 'إرسال التقييم', 'en': 'Send rating'},
    'positive_ratings_by_drivers': {
      'ar': 'أعجب به %d سائق',
      'en': 'Liked by %d drivers',
    },
    'customer_no_ratings': {
      'ar': 'زبون جديد — لا توجد تقييمات بعد',
      'en': 'New customer — no ratings yet',
    },
    // Home: availability, broadcast pop-up
    'broadcast_confirm': {'ar': 'تم', 'en': 'OK'},
    'broadcast_confirm_in': {'ar': '%s (%d)', 'en': '%s (%d)'},
    'availability_title': {'ar': 'استقبال الطلبات', 'en': 'Receiving orders'},
    'availability_on_short': {
      'ar': 'مفعّل — تصلك الطلبات الجديدة',
      'en': 'On — new orders reach you',
    },
    'availability_off_short': {
      'ar': 'متوقف — لن تصلك طلبات جديدة',
      'en': 'Paused — no new orders',
    },
    // UX safety: confirmations
    'accept_offer_confirm_title': {
      'ar': 'قبول هذا العرض؟',
      'en': 'Accept this offer?',
    },
    'accept_offer_confirm_message': {
      'ar': 'ستقبل عرض %s بسعر %s. بعد القبول يبدأ السائق بتنفيذ طلبك.',
      'en':
          'You\'re accepting %s\'s offer of %s. After you accept, the driver starts on your order.',
    },
    'accept_offer_confirm': {'ar': 'قبول العرض', 'en': 'Accept offer'},
    'driver_generic': {'ar': 'السائق', 'en': 'the driver'},
    'approve_delivery_confirm_title': {
      'ar': 'تأكيد استلام الطلب؟',
      'en': 'Confirm you received the order?',
    },
    'approve_delivery_confirm_message': {
      'ar':
          'أكّد فقط إذا وصلك الطلب. بعد التأكيد يُغلق الطلب ولا يمكن التراجع.',
      'en':
          'Only confirm if your order has arrived. Once confirmed, the order is closed and this can\'t be undone.',
    },
    'start_delivery_confirm_title': {
      'ar': 'بدء التوصيل الآن؟',
      'en': 'Start the delivery now?',
    },
    'start_delivery_confirm_message': {
      'ar':
          'سيعرف الزبون أنك في الطريق، ولن تستطيع قبول طلب آخر حتى تنتهي من هذا الطلب.',
      'en':
          'The customer will see that you\'re on your way, and you can\'t take another order until this one is done.',
    },
    'complete_delivery_confirm_title': {
      'ar': 'هل سلّمت الطلب؟',
      'en': 'Did you hand over the order?',
    },
    'complete_delivery_confirm_message': {
      'ar': 'سنطلب من الزبون تأكيد الاستلام. اضغط فقط بعد تسليم الطلب.',
      'en':
          'We\'ll ask the customer to confirm receipt. Only tap this after you\'ve handed the order over.',
    },
    'conflict_title': {
      'ar': 'تعذّر إكمال العملية',
      'en': 'Couldn\'t complete this',
    },
    'conflict_delete': {'ar': 'لا، احذف الطلب', 'en': 'No, delete the order'},
    'conflict_resend': {'ar': 'نعم، أعد الإرسال', 'en': 'Yes, resend'},
    'delete_order': {'ar': 'حذف الطلب', 'en': 'Delete order'},
    'delete_order_confirm_title': {
      'ar': 'حذف الطلب؟',
      'en': 'Delete this order?',
    },
    'delete_order_confirm_message': {
      'ar': 'سيُحذف الطلب ولن يصل إلى السائقين. لا يمكن التراجع عن ذلك.',
      'en':
          'The order will be deleted and won\'t reach any drivers. This can\'t be undone.',
    },
    'delete_phone_confirm_title': {
      'ar': 'حذف الرقم؟',
      'en': 'Delete this number?',
    },
    'delete_phone_confirm_message': {
      'ar': 'سيُحذف الرقم %s من حسابك.',
      'en': 'The number %s will be removed from your account.',
    },
    // UX safety: loading, empty and error states
    'refresh_failed': {
      'ar': 'تعذّر التحديث. تحقق من الاتصال وحاول مرة أخرى.',
      'en': 'Couldn\'t refresh. Check your connection and try again.',
    },
    'offers_load_failed': {
      'ar': 'تعذّر تحميل العروض لهذا الطلب.',
      'en': 'Couldn\'t load the offers for this order.',
    },
    'no_orders_customer_hint': {
      'ar': 'عندما تنشئ طلباً سيظهر هنا مع حالته.',
      'en': 'When you create an order, it\'ll show up here with its status.',
    },
    'no_active_orders_title': {
      'ar': 'لا توجد طلبات نشطة',
      'en': 'No active orders',
    },
    'no_active_orders_driver_hint': {
      'ar': 'الطلبات التي يقبلها الزبائن منك ستظهر هنا.',
      'en': 'Orders customers accept from you will appear here.',
    },
    'no_notifications_hint': {
      'ar': 'سنخبرك هنا بالعروض الجديدة وتحديثات طلباتك.',
      'en': 'We\'ll let you know here about new offers and order updates.',
    },
    'support_start_title': {
      'ar': 'ابدأ محادثة مع فريق الدعم',
      'en': 'Start a conversation with support',
    },
    'support_start_hint': {
      'ar': 'اكتب سؤالك أو مشكلتك وسيرد عليك فريق الدعم هنا.',
      'en':
          'Write your question or problem and the support team will reply here.',
    },
    'support_history_failed': {
      'ar': 'تعذّر تحميل المحادثة.',
      'en': 'Couldn\'t load the conversation.',
    },
    'support_message_hint': {
      'ar': 'اكتب رسالتك...',
      'en': 'Write your message…',
    },
    'call_number': {'ar': 'اتصال بالرقم', 'en': 'Call'},
    'call_failed': {
      'ar': 'تعذّر فتح تطبيق الاتصال.',
      'en': 'Couldn\'t open the phone app.',
    },
    'unknown': {'ar': 'غير معروف', 'en': 'Unknown'},
    // Reports
    'report_id_label': {'ar': 'رقم المستخدم (ID)', 'en': 'User ID'},
    'report_id_hint': {
      'ar': 'رقم ID للشخص الذي تبلغ عنه',
      'en': 'The ID of the person you are reporting',
    },
    'report_content_label': {'ar': 'وصف المشكلة', 'en': 'What happened'},
    'report_content_hint': {
      'ar': 'اشرح المشكلة التي تواجهها',
      'en': 'Describe the problem',
    },
    'report_submit': {'ar': 'إرسال البلاغ', 'en': 'Send report'},
    'recent_reports': {'ar': 'آخر البلاغات', 'en': 'Recent reports'},
    'no_previous_reports': {
      'ar': 'لا توجد بلاغات سابقة',
      'en': 'No previous reports',
    },
    'report_history_failed': {
      'ar': 'تعذّر تحميل البلاغات السابقة.',
      'en': 'Couldn\'t load your previous reports.',
    },
    'report_status_in_review': {'ar': 'قيد المراجعة', 'en': 'In review'},
    'report_status_in_progress': {'ar': 'قيد المعالجة', 'en': 'In progress'},
    'report_status_resolved': {'ar': 'تم الحل', 'en': 'Resolved'},
    'report_status_rejected': {'ar': 'مرفوض', 'en': 'Rejected'},
    // Profile
    'profile_title': {'ar': 'الملف الشخصي', 'en': 'Profile'},
    'profile_name': {'ar': 'الاسم', 'en': 'Name'},
    'profile_name_updated': {'ar': 'تم تحديث الاسم', 'en': 'Name updated'},
    'profile_confirm_email_change': {
      'ar': 'تأكيد تغيير البريد',
      'en': 'Confirm email change',
    },
    'profile_email_unchanged': {
      'ar': 'البريد لم يتغير',
      'en': 'The email hasn\'t changed',
    },
    'profile_email_updated': {
      'ar': 'تم تحديث البريد. سجّل الدخول مجدداً بالبريد الجديد.',
      'en': 'Email updated. Sign in again with the new email.',
    },
    'profile_enter_current_password': {
      'ar': 'أدخل كلمة المرور الحالية',
      'en': 'Enter your current password',
    },
    'profile_password_changed': {
      'ar': 'تم تغيير كلمة المرور',
      'en': 'Password changed',
    },
    'profile_phones': {'ar': 'أرقام الهاتف', 'en': 'Phone numbers'},
    'profile_add_phone_hint': {
      'ar': 'أضف رقم هاتف',
      'en': 'Add a phone number',
    },
    'profile_make_primary': {'ar': 'اجعله أساسياً', 'en': 'Make primary'},
    'profile_primary_phone': {'ar': 'الرقم الأساسي', 'en': 'Primary number'},
    'profile_location_title': {
      'ar': 'المحافظة والقرية / المدينة',
      'en': 'Governorate and town/city',
    },
    'profile_location_hint': {
      'ar': 'تُستخدم هذه المنطقة في إرسال واستقبال الطلبات داخل التطبيق.',
      'en': 'This area is used to send and receive orders in the app.',
    },
    'profile_areas_failed': {
      'ar': 'تعذر تحميل قائمة المناطق. حاول فتح الصفحة مرة أخرى.',
      'en': 'Couldn\'t load the list of areas. Try opening this page again.',
    },
    'profile_pick_location_first': {
      'ar': 'يرجى اختيار المحافظة والقرية/المدينة أولاً.',
      'en': 'Please choose your governorate and town/city first.',
    },
    'profile_location_updated': {
      'ar':
          'تم تحديث المحافظة والقرية. الطلبات الجديدة ستستخدم المنطقة الجديدة.',
      'en': 'Location updated. New orders will use the new area.',
    },
    'profile_whole_governorate': {'ar': 'من %s نفسها', 'en': 'Anywhere in %s'},
    'profile_scope_carried': {
      'ar':
          'خيار العمل على مستوى المحافظة مفعّل، وسيُطبّق تلقائياً على المحافظة الجديدة.',
      'en':
          'Governorate-wide work is on and will apply to the new governorate automatically.',
    },
    'profile_location_note': {
      'ar':
          'تغيير المنطقة يؤثر على الطلبات الجديدة فقط. الطلبات الحالية تبقى في منطقتها الأصلية.',
      'en':
          'Changing the area only affects new orders. Current orders stay in their original area.',
    },
    'profile_save_location': {
      'ar': 'حفظ المحافظة والقرية',
      'en': 'Save location',
    },
    'town_city': {'ar': 'القرية / المدينة', 'en': 'Town / city'},
    'saving': {'ar': 'جاري الحفظ...', 'en': 'Saving…'},
    // App
    'app_title': {'ar': 'سويفورا', 'en': 'Swifora'},
    'app_name': {'ar': 'سويفورا دليفري', 'en': 'Swifora Delivery'},
    'app_name_latin': {'ar': 'SWIFORA DELIVERY', 'en': 'SWIFORA DELIVERY'},
    'app_tagline': {
      'ar': 'خدمة توصيل سريعة وموثوقة',
      'en': 'Fast, reliable delivery',
    },
    'show_password': {'ar': 'إظهار كلمة المرور', 'en': 'Show password'},
    'hide_password': {'ar': 'إخفاء كلمة المرور', 'en': 'Hide password'},
    'theme_day': {'ar': 'نهاري', 'en': 'Day'},
    'theme_dark': {'ar': 'ليلي', 'en': 'Dark'},
    'nav_home': {'ar': 'الرئيسية', 'en': 'Home'},
    'nav_orders': {'ar': 'طلباتي', 'en': 'My orders'},
    'nav_requests': {'ar': 'الطلبات', 'en': 'Orders'},
    'nav_earnings': {'ar': 'الأرباح', 'en': 'Earnings'},
    'nav_notifications': {'ar': 'الإشعارات', 'en': 'Notifications'},
    'nav_account': {'ar': 'حسابي', 'en': 'Account'},
    'home_greeting': {'ar': 'أهلاً بعودتك', 'en': 'Welcome back'},
    'home_subtitle': {
      'ar': 'كل ما تحتاجه لتوصيل أسهل وأسرع',
      'en': 'Everything you need for easier, faster delivery',
    },
    'hero_tag': {
      'ar': 'توصيل سريع • خيارات متعددة',
      'en': 'Fast delivery • Many options',
    },
    'hero_title': {'ar': 'طلبك يبدأ من هنا', 'en': 'Your order starts here'},
    'hero_body': {
      'ar': 'منتجات، أشخاص، بضائع — كل شيء في مكان واحد.',
      'en': 'Products, people, goods — all in one place.',
    },
    'drivers_nearby_title': {
      'ar': 'سائقون جاهزون بالقرب منك',
      'en': 'Drivers ready near you',
    },
    'drivers_available_now': {'ar': 'متاحون الآن', 'en': 'Available now'},
    'view_all_orders': {'ar': 'عرض جميع الطلبات', 'en': 'View all orders'},
    'offers_waiting_decision': {
      'ar': 'عروض جديدة بانتظار قرارك',
      'en': 'New offers awaiting your decision',
    },
    'offers_none_waiting': {
      'ar': 'ستظهر عروض السائقين هنا',
      'en': 'Driver offers will appear here',
    },
    'track_orders_live': {
      'ar': 'تابع رحلة طلبك لحظة بلحظة',
      'en': 'Follow your order step by step',
    },
    'order_on_the_way': {
      'ar': 'طلبك في الطريق',
      'en': 'Your order is on the way',
    },
    'view_details': {'ar': 'عرض التفاصيل', 'en': 'View details'},
    'driver_greeting': {'ar': 'أهلاً بك، كابتن!', 'en': 'Welcome, captain!'},
    'driver_greeting_subtitle': {
      'ar': 'جاهز لرحلة توصيل جديدة؟',
      'en': 'Ready for a new delivery?',
    },
    'quick_overview': {'ar': 'نظرة سريعة', 'en': 'Quick overview'},
    'stat_new_requests': {'ar': 'طلبات جديدة', 'en': 'New requests'},
    'stat_my_offers': {'ar': 'عروضي', 'en': 'My offers'},
    'stat_active_delivery': {'ar': 'توصيل نشط', 'en': 'Active delivery'},
    'awaiting_your_price': {
      'ar': 'ينتظرون عرض السعر منك',
      'en': 'Waiting for your price',
    },
    'view_requests': {'ar': 'عرض الطلبات', 'en': 'View requests'},
    'active_delivery_title': {
      'ar': 'لديك توصيل قيد التنفيذ',
      'en': 'You have a delivery in progress',
    },
    'active_delivery_body': {
      'ar': 'افتح الطلب لمتابعة التوصيل وتأكيد التسليم',
      'en': 'Open the order to continue and confirm delivery',
    },
    'follow_delivery': {'ar': 'متابعة التوصيل', 'en': 'Follow delivery'},
    'stale_figures_note': {
      'ar': 'آخر أرقام محفوظة — تعذّر التحديث',
      'en': 'Last saved figures — refresh failed',
    },
    'what_to_deliver': {
      'ar': 'ماذا تريد أن نوصل لك؟',
      'en': 'What should we deliver for you?',
    },
    'order_description_label': {'ar': 'وصف الطلب', 'en': 'Order description'},
    'order_description_hint': {
      'ar':
          'مثال: دواء من صيدلية، أو طلب بقالة… أخبر السائق ماذا يحتاج أن يحضر لك',
      'en':
          'E.g. medicine from a pharmacy, or groceries… tell the driver what to bring',
    },
    'delivery_location_label': {
      'ar': 'موقع التوصيل',
      'en': 'Delivery location',
    },
    'delivery_location_hint': {
      'ar': 'المدينة، الحي، وأقرب معلم واضح',
      'en': 'City, neighbourhood and the nearest clear landmark',
    },
    'clearer_description_helper': {
      'ar': 'كلما كان الوصف أوضح، كانت عروض السائقين أدق.',
      'en': 'The clearer the description, the more accurate the offers.',
    },
    'contact_phone_label': {'ar': 'رقم الهاتف للتواصل', 'en': 'Contact phone'},
    'order_reaches_drivers': {
      'ar': 'سيصل طلبك إلى السائقين المتاحين في منطقتك',
      'en': 'Your order goes to available drivers in your area',
    },
    'welcome_back': {'ar': 'مرحباً بعودتك', 'en': 'Welcome back!'},
    'create_account_hint': {
      'ar': 'إنشاء حساب جديد',
      'en': 'Create your account',
    },

    // Roles
    'customer': {'ar': 'زبون', 'en': 'Customer'},
    'provider': {'ar': 'سائق', 'en': 'Provider'},
    'customer_subtitle': {'ar': 'أحتاج توصيل', 'en': 'Need delivery'},
    'provider_subtitle': {'ar': 'أقدم خدمة التوصيل', 'en': 'Offer delivery'},

    'service_types': {'ar': 'نوع الخدمة', 'en': 'Service Type'},
    'service_type_required': {
      'ar': 'اختر نوع خدمة واحداً على الأقل',
      'en': 'Select at least one service type',
    },
    'provider_documents_title': {
      'ar': 'وثائق التحقق من السائق',
      'en': 'Provider Verification Documents',
    },
    'provider_documents_hint': {
      'ar': 'أرفق صورة واضحة لرخصة القيادة. JPEG أو PNG وبحد أقصى 5 ميجابايت.',
      'en': 'Attach a clear driver-license image. JPEG or PNG, maximum 5 MB.',
    },
    'driver_license_document': {
      'ar': 'صورة رخصة القيادة',
      'en': 'Driver License',
    },
    'choose_image': {'ar': 'اختيار صورة', 'en': 'Choose Image'},
    'replace_image': {'ar': 'تغيير الصورة', 'en': 'Replace Image'},
    'provider_documents_required': {
      'ar': 'يجب إرفاق صورة رخصة القيادة لإنشاء حساب سائق.',
      'en': 'A driver-license image is required for provider registration.',
    },
    'provider_no_license_option': {
      'ar': 'لا أملك رخصة قيادة',
      'en': 'I do not have a driver license',
    },
    'provider_no_license_hint': {
      'ar':
          'يمكنك متابعة تسجيل حساب السائق بدون رفع صورة الرخصة، وسيراجع المدير طلبك.',
      'en':
          'You can continue provider registration without a license image; an admin will review your request.',
    },
    'provider_no_license_selected': {
      'ar':
          'تم اختيار التسجيل بدون رخصة قيادة. يمكنك إكمال باقي البيانات وإنشاء الحساب.',
      'en':
          'Registration without a driver license is selected. You can finish the remaining fields and create the account.',
    },
    'provider_document_empty': {
      'ar': 'الصورة المختارة فارغة.',
      'en': 'The selected image is empty.',
    },
    'provider_document_too_large': {
      'ar': 'حجم الصورة يتجاوز 5 ميجابايت.',
      'en': 'The selected image exceeds 5 MB.',
    },
    'provider_document_unsupported': {
      'ar': 'يُسمح فقط بصور JPEG وPNG.',
      'en': 'Only JPEG and PNG images are supported.',
    },
    'provider_document_pick_failed': {
      'ar': 'تعذر قراءة الصورة المختارة. حاول مرة أخرى.',
      'en': 'The selected image could not be read. Please try again.',
    },

    // Auth
    'sign_in': {'ar': 'تسجيل الدخول', 'en': 'Sign In'},
    'sign_up': {'ar': 'إنشاء حساب', 'en': 'Sign Up'},
    'create_account': {'ar': 'إنشاء حساب', 'en': 'Create Account'},
    'full_name': {'ar': 'الاسم الكامل', 'en': 'Full Name'},
    'phone_number': {'ar': 'رقم الهاتف', 'en': 'Phone Number'},
    'email': {'ar': 'البريد الإلكتروني', 'en': 'Email'},
    'password': {'ar': 'كلمة المرور', 'en': 'Password'},
    'current_password': {'ar': 'كلمة المرور الحالية', 'en': 'Current Password'},
    'forced_password_title': {
      'ar': 'تغيير كلمة المرور مطلوب',
      'en': 'Password Change Required',
    },
    'forced_password_body': {
      'ar':
          'تم تعيين كلمة مرور جديدة لحسابك من قبل الإدارة. يجب تغييرها الآن قبل استخدام التطبيق.',
      'en':
          'Your password was set by the administration. You must change it now before using the app.',
    },
    'forced_password_hint': {
      'ar': 'أدخل كلمة المرور المؤقتة التي حصلت عليها من الإدارة.',
      'en': 'Enter the temporary password provided by the administration.',
    },
    'forced_password_cannot_leave': {
      'ar': 'يجب تغيير كلمة المرور للمتابعة.',
      'en': 'You must change your password to continue.',
    },
    'change_password': {'ar': 'تغيير كلمة المرور', 'en': 'Change Password'},
    'password_changed_success': {
      'ar': 'تم تغيير كلمة المرور بنجاح. يمكنك استخدام التطبيق الآن.',
      'en': 'Password changed successfully. You can use the app now.',
    },
    'current_password_invalid': {
      'ar': 'كلمة المرور الحالية غير صحيحة',
      'en': 'The current password is incorrect',
    },
    'password_change_failed': {
      'ar': 'تعذر تغيير كلمة المرور. حاول مرة أخرى.',
      'en': 'Could not change the password. Please try again.',
    },
    'password_change_session_failed': {
      'ar':
          'تم تغيير كلمة المرور، لكن تعذر تحديث الجلسة. أعد تشغيل التطبيق وسجّل الدخول بكلمة المرور الجديدة.',
      'en':
          'The password was changed, but the session could not be refreshed. Restart the app and sign in with the new password.',
    },
    'area_region': {'ar': 'المنطقة', 'en': 'Area / Region'},
    'governorate': {'ar': 'المحافظة', 'en': 'Governorate'},
    'city_village': {'ar': 'المدينة / القرية', 'en': 'City / Village'},
    'no_account': {'ar': 'ليس لديك حساب؟ ', 'en': "Don't have an account? "},
    'have_account': {
      'ar': 'لديك حساب بالفعل؟ ',
      'en': 'Already have an account? ',
    },
    'required': {'ar': 'مطلوب', 'en': 'Required'},
    'invalid_email': {'ar': 'بريد إلكتروني غير صالح', 'en': 'Invalid email'},
    'min_password': {'ar': 'بين 12 و128 حرفاً', 'en': '12-128 characters'},
    'confirm_password': {'ar': 'تأكيد كلمة المرور', 'en': 'Confirm Password'},
    'password_mismatch': {
      'ar': 'كلمتا المرور غير متطابقتين',
      'en': 'Passwords do not match',
    },
    'forgot_password': {'ar': 'نسيت كلمة المرور؟', 'en': 'Forgot password?'},
    'password_recovery': {
      'ar': 'استعادة كلمة المرور',
      'en': 'Password Recovery',
    },
    'recovery_email_instructions': {
      'ar': 'أدخل البريد الإلكتروني المرتبط بحسابك.',
      'en': 'Enter the email address associated with your account.',
    },
    'send_recovery_code': {
      'ar': 'إرسال رمز الاستعادة',
      'en': 'Send Recovery Code',
    },
    'recovery_code': {'ar': 'رمز الاستعادة', 'en': 'Recovery Code'},
    'recovery_code_generic_notice': {
      'ar':
          'إذا كان هناك حساب مؤهل مرتبط بهذا البريد، فسيتم إرسال رمز الاستعادة إليه.',
      'en':
          'If an eligible account exists for this email, a recovery code will be sent.',
    },
    'new_password': {'ar': 'كلمة المرور الجديدة', 'en': 'New Password'},
    'reset_password': {'ar': 'تغيير كلمة المرور', 'en': 'Reset Password'},
    'change_recovery_email': {
      'ar': 'استخدام بريد إلكتروني آخر',
      'en': 'Use a different email',
    },
    'invalid_recovery_code': {
      'ar': 'يجب أن يتكون رمز الاستعادة من 8 أرقام.',
      'en': 'Recovery code must contain exactly 8 digits.',
    },
    'recovery_invalid': {
      'ar': 'رمز الاستعادة غير صالح أو منتهي الصلاحية.',
      'en': 'The recovery code is invalid or expired.',
    },
    'recovery_rate_limited': {
      'ar': 'تم إجراء محاولات كثيرة. حاول مرة أخرى لاحقاً.',
      'en': 'Too many recovery attempts. Please try again later.',
    },
    'recovery_unavailable': {
      'ar': 'خدمة استعادة كلمة المرور غير متاحة حالياً.',
      'en': 'Password recovery is temporarily unavailable.',
    },
    'recovery_failed': {
      'ar': 'تعذر إكمال استعادة كلمة المرور. حاول مرة أخرى.',
      'en': 'Password recovery could not be completed. Please try again.',
    },
    'recovery_reset_success': {
      'ar': 'تم تغيير كلمة المرور. سجل الدخول باستخدام كلمة المرور الجديدة.',
      'en': 'Password changed. Sign in with your new password.',
    },

    // Create Order
    'delivery_location': {'ar': 'موقع التوصيل', 'en': 'Delivery Location'},
    'location_hint': {
      'ar': 'إلى أين يأتيك السائق؟',
      'en': 'Where should the driver come to you?',
    },
    'invalid_phone': {'ar': 'رقم هاتف غير صالح', 'en': 'Invalid phone number'},

    // Home
    'new_order': {'ar': 'إنشاء طلب جديد', 'en': 'New Order'},
    'my_orders': {'ar': 'طلباتي', 'en': 'My Orders'},
    'offers_title': {'ar': 'عروض اسعار السائقين', 'en': 'Driver Price Offers'},
    'in_progress_orders_btn': {
      'ar': 'طلبات جاري العمل عليها',
      'en': 'Orders in Progress',
    },
    'report_30': {
      'ar': 'تقرير الطلبات - آخر 30 يوم',
      'en': 'Orders Report - Last 30 Days',
    },

    // Order types
    'product': {'ar': 'طلب منتج', 'en': 'Product Order'},
    'people': {'ar': 'طلب توصيل أشخاص', 'en': 'People Transport'},
    'goods': {'ar': 'طلب نقل بضاعة', 'en': 'Goods Transport'},
    'product_label': {'ar': 'المنتج المطلوب', 'en': 'Required Product'},
    'people_label': {'ar': 'خدمة النقل المطلوبة', 'en': 'Transport Service'},
    'goods_label': {'ar': 'الشحنة المطلوبة', 'en': 'Required Shipment'},
    'desc_hint': {
      'ar':
          'اشرح ماذا تريد بالضبط، ليتسنى للسائق اعطائك عرض سعر بقيمة التوصيل وليس بقيمة المنتجات المطلوبة',
      'en':
          'Describe what you need so the driver can give a delivery price quote',
    },
    'phone_label': {'ar': 'رقم الهاتف للتواصل', 'en': 'Contact Phone'},
    'phone_hint': {
      'ar': 'هذا الرقم لن يظهر للسائق إلا عند قبولك لعرض السعر',
      'en': 'Phone hidden until you accept an offer',
    },
    'submit_order': {'ar': 'إرسال الطلب', 'en': 'Submit Order'},
    'order_sent': {
      'ar': 'تم إرسال الطلب إلى مقدمي الخدمة',
      'en': 'Order sent to providers',
    },
    'max_3_photos': {
      'ar': 'يمكنك إضافة 3 صور كحد أقصى',
      'en': 'Maximum 3 images allowed',
    },
    'add_photos': {'ar': 'إضافة صور (حد أقصى 3)', 'en': 'Add Photos (Max 3)'},
    'add_more_photos': {'ar': 'إضافة صورة أخرى', 'en': 'Add Another Photo'},

    // Order statuses
    'status_pending': {'ar': 'قيد الانتظار', 'en': 'Pending'},
    'status_offered': {'ar': 'عروض متوفرة', 'en': 'Offers Available'},
    'status_accepted': {'ar': 'تم قبول عرض', 'en': 'Offer Accepted'},
    'status_fulfilling': {
      'ar': 'جاري العمل على الطلب',
      'en': 'Working on Order',
    },
    'status_completed': {'ar': 'تم انجاز الطلب', 'en': 'Order Completed'},

    // Provider dashboard
    'provider_dashboard': {
      'ar': 'لوحة تحكم السائق',
      'en': 'Provider Dashboard',
    },
    'daily_earnings': {'ar': 'أرباحك هذا اليوم', 'en': 'Daily Earnings'},
    'monthly_earnings': {'ar': 'أرباحك هذا الشهر', 'en': 'Monthly Earnings'},
    'driver_rating': {'ar': 'تقييم السائق', 'en': 'Driver Rating'},
    'no_ratings_yet': {'ar': 'لا توجد تقييمات بعد', 'en': 'No ratings yet'},
    'rating_count': {'ar': '%d تقييم', 'en': '%d ratings'},
    'rating_stars_total': {'ar': '%d نجمة', 'en': '%d stars'},
    'rating_average': {'ar': '%s من 5', 'en': '%s out of 5'},
    'positive_ratings_count': {
      'ar': 'أعجب به %d زبون',
      'en': '%d customers liked the service',
    },
    'driver_category_public': {'ar': 'سائق عمومي', 'en': 'Public driver'},
    'driver_category_private': {'ar': 'سائق خاص', 'en': 'Private driver'},
    'driver_category_truck': {'ar': 'سائق شاحنة', 'en': 'Truck driver'},
    'driver_category_motorcycle': {
      'ar': 'سائق دراجة',
      'en': 'Motorcycle driver',
    },
    'driver_category_unknown': {
      'ar': 'نوع السائق غير محدد',
      'en': 'Driver type not specified',
    },
    'ad_label': {'ar': 'إعلان', 'en': 'Ad'},
    'ad_ends_in': {'ar': 'ينتهي بعد', 'en': 'Ends in'},
    'ad_ended': {'ar': 'انتهى الإعلان', 'en': 'Ad ended'},
    'ad_position': {'ar': 'الإعلان %1 من %2', 'en': 'Ad %1 of %2'},
    'rating_prompt_title': {
      'ar': 'كيف ترى أداء هذا السائق؟',
      'en': "How was this driver's performance?",
    },
    'rating_prompt_body': {
      'ar': 'اختر عدد النجوم المناسب، وسيتم إرسال التقييم فور اختيارك.',
      'en': 'Choose a star rating; it will be sent as soon as you select it.',
    },
    'rate_driver': {'ar': 'تقييم السائق', 'en': 'Rate the driver'},
    'your_rating': {'ar': 'تقييمك: %d من 5', 'en': 'Your rating: %d of 5'},
    'rating_comment_hint': {
      'ar': 'تعليق اختياري عن الخدمة',
      'en': 'Optional comment about the service',
    },
    'submit_rating': {'ar': 'إرسال التقييم', 'en': 'Submit rating'},
    'rate_customer': {'ar': 'قيّم الزبون', 'en': 'Rate the customer'},
    'guest_waiting_reply': {
      'ar':
          'وصلت رسالتك. سيظهر رد فريق الدعم هنا، وعلى بريدك الإلكتروني أيضاً.',
      'en':
          'Message received. The support reply will appear here and in your email.',
    },
    'guest_thread_closed': {
      'ar': 'لم تعد هذه المحادثة متاحة. يمكنك إرسال رسالة جديدة.',
      'en':
          'This conversation is no longer available. You can send a new message.',
    },
    'guest_new_message': {'ar': 'رسالة جديدة', 'en': 'New message'},
    'rate_customer_title': {
      'ar': 'كيف كان التعامل مع هذا الزبون؟',
      'en': 'How was this customer?',
    },
    'rate_customer_body': {
      'ar': 'تقييمك يساعد السائقين الآخرين. اختر عدد النجوم.',
      'en': 'Your rating helps other drivers. Choose the stars.',
    },
    'your_customer_rating': {
      'ar': 'تقييمك للزبون: %d من 5',
      'en': 'Your rating: %d of 5',
    },
    'customer_rating_label': {'ar': 'تقييم الزبون', 'en': 'Customer rating'},
    'rating_thanks': {
      'ar': 'شكراً لك، تم إرسال تقييمك.',
      'en': 'Thank you, your rating was submitted.',
    },
    'rating_required': {
      'ar': 'اختر عدد النجوم أولاً.',
      'en': 'Select a star rating first.',
    },
    'rating_exists': {
      'ar': 'تم تقييم هذا الطلب مسبقاً.',
      'en': 'This order has already been rated.',
    },
    'today_orders': {'ar': ' طلبات اليوم', 'en': ' orders today'},
    'order_count': {'ar': ' طلب', 'en': ' orders'},
    'pending_orders_btn': {
      'ar': 'طلبات جديدة تنتظر تقديم عرض سعر',
      'en': 'New Orders Awaiting Your Offer',
    },
    'offered_orders_btn': {
      'ar': 'الطلبات التي تم تقديم عرض سعر لها',
      'en': 'Orders With Submitted Offers',
    },
    'active_orders_btn': {
      'ar': 'طلباتي النشطة - التوصيل والتسليم',
      'en': 'My Active Orders - Delivery',
    },
    'rejected_orders_btn': {
      'ar': 'تقرير الطلبات والعروض',
      'en': 'Orders and Offers Report',
    },
    'offer_not_selected_status': {
      'ar': 'تم اختيار سائق آخر',
      'en': 'Another driver selected',
    },
    'offer_not_selected_reason': {
      'ar': 'قبل الزبون عرض سائق آخر لهذا الطلب.',
      'en': "The customer accepted another driver's offer for this order.",
    },
    'your_offer_price': {'ar': 'عرضك: %d شيكل', 'en': 'Your offer: %d shekels'},
    'winning_offer_price': {
      'ar': 'العرض المقبول: %d شيكل',
      'en': 'Accepted offer: %d shekels',
    },
    'view_reports': {'ar': 'عرض التقارير', 'en': 'View reports'},
    'reject_order': {'ar': 'رفض الطلب', 'en': 'Reject Order'},
    'reject_order_confirm': {
      'ar': 'هل تريد رفض هذا الطلب؟ سيُخفى عن قائمة طلباتك فقط.',
      'en': 'Reject this order? It will be hidden from your new orders only.',
    },
    'order_rejected': {'ar': 'تم رفض الطلب', 'en': 'Order rejected'},
    'no_rejected_orders': {
      'ar': 'لا توجد سجلات في التقرير',
      'en': 'No records in this report',
    },
    'reject_reason_driver': {
      'ar': 'تم رفض الطلب من جهتك',
      'en': 'You rejected this order',
    },
    'reject_reason_expired': {
      'ar': 'انتهاء مدة عرض السعر',
      'en': 'Price offer duration expired',
    },
    'platform_commission': {
      'ar': 'عمولة المنصة (مستحقة الدفع):',
      'en': 'Platform Commission (Due):',
    },
    'pending_items_alert': {
      'ar': 'لديك %d طلب/عرض قيد الانتظار',
      'en': 'You have %d pending order(s)/offer(s)',
    },
    'driver_availability': {
      'ar': 'متاح لاستقبال الطلبات',
      'en': 'Available to receive orders',
    },
    'driver_availability_off': {
      'ar': 'غير متاح لاستقبال الطلبات',
      'en': 'Unavailable to receive orders',
    },
    'availability_tap_hint': {
      'ar': 'اضغط على البطاقة لتفعيل أو إيقاف استقبال الطلبات.',
      'en': 'Tap the card to enable or pause receiving orders.',
    },
    'driver_available': {
      'ar': 'متاح - تصلك طلبات جديدة',
      'en': 'Available - new orders will reach you',
    },
    'driver_unavailable': {
      'ar': 'غير متاح - لن تصلك طلبات جديدة',
      'en': 'Unavailable - no new orders will reach you',
    },
    'availability_updated': {
      'ar': 'تم تحديث حالة التوفر',
      'en': 'Availability updated',
    },
    'orders_paused_title': {
      'ar': 'استقبال الطلبات متوقف',
      'en': 'Order reception is paused',
    },
    'orders_paused_pending': {
      'ar':
          'يوجد %d طلب بانتظار عرض سعر. فعّل استقبال الطلبات لتتمكن من فتحها وتقديم عرض سعر.',
      'en':
          '%d order(s) are waiting for a price offer. Enable order reception to open them and submit an offer.',
    },
    'orders_paused_empty': {
      'ar':
          'لا توجد طلبات بانتظار عرض سعر حالياً. سيظهر العداد هنا فور وصول طلبات جديدة.',
      'en':
          'No orders are waiting for a price offer right now. The counter will update here when new orders arrive.',
    },
    'orders_paused_support_hint': {
      'ar': 'التواصل مع الدعم متاح دائماً.',
      'en': 'Contacting support remains available.',
    },
    'available_drivers_count': {
      'ar': 'السائقون المتاحون حالياً في منطقتك: %d',
      'en': 'Drivers currently available in your area: %d',
    },
    'available_drivers_count_governorate': {
      'ar': 'السائقون المتاحون في محافظتك: %d',
      'en': 'Drivers currently available in your governorate: %d',
    },
    'no_available_drivers_governorate': {
      'ar': 'لا يوجد سائقون متاحون حالياً في محافظتك',
      'en': 'No drivers are currently available in your governorate',
    },
    'no_available_drivers': {
      'ar': 'لا يوجد سائقون متاحون حالياً في منطقتك',
      'en': 'No drivers are currently available in your area',
    },
    'recommend_driver_share_hint': {
      'ar': 'يمكنك أن تشارك التطبيق مع سائق توصي به.',
      'en': 'You can share the app with a driver you recommend.',
    },
    'pay_now': {'ar': 'ادفع الآن', 'en': 'Pay now'},
    'commission_payment_title': {
      'ar': 'دفع عمولة المنصة',
      'en': 'Pay platform commission',
    },
    'commission_due_amount': {'ar': 'المبلغ المستحق', 'en': 'Amount due'},
    'payment_method': {'ar': 'طريقة الدفع', 'en': 'Payment method'},
    'payment_contact_sales_whatsapp': {
      'ar':
          'لترتيب دفع عمولة المنصة، تواصل مع فريق المبيعات عبر واتساب على الرقم التالي:',
      'en':
          'To arrange payment of the platform commission, contact our sales team on WhatsApp at:',
    },
    'payment_whatsapp_label': {
      'ar': 'رقم واتساب المبيعات',
      'en': 'Sales WhatsApp number',
    },
    'copy_whatsapp_number': {
      'ar': 'نسخ رقم واتساب',
      'en': 'Copy WhatsApp number',
    },
    'whatsapp_number_copied': {
      'ar': 'تم نسخ رقم واتساب.',
      'en': 'WhatsApp number copied.',
    },
    'payment_follow_up_note': {
      'ar':
          'بعد ترتيب الدفع، ستؤكد الإدارة استلام المبلغ ويُحدَّث عداد المستحقات تلقائياً.',
      'en':
          'After arranging payment, an admin will confirm receipt and update the due commission.',
    },
    'commission_body': {
      'ar': ' شيكل بناء على الطلبات الناجحة',
      'en': ' ILS based on successful orders',
    },
    'commission_due_note': {
      'ar': 'تُحتسب على الطلبات الناجحة المكتملة',
      'en': 'Calculated from completed successful orders',
    },
    'ils': {'ar': 'ILS', 'en': 'ILS'},
    'shekel': {'ar': 'شيكل', 'en': 'SHE'},
    'successful_orders': {'ar': 'طلب ناجح', 'en': 'Successful Orders'},
    'commission_detail': {
      'ar': 'شيكل بناء على الطلبات الناجحة',
      'en': 'SHE based on completed orders',
    },

    // Offers
    'delivery_price': {
      'ar': 'سعر التوصيل (شيكل)',
      'en': 'Delivery Price (ILS)',
    },
    'delivery_time': {
      'ar': 'الوقت المطلوب لتوصيل الطرد',
      'en': 'Estimated Delivery Time',
    },
    'custom_time': {'ar': 'وقت مخصص (دقائق)', 'en': 'Custom Time (minutes)'},
    'offer_time': {'ar': 'الوقت المطلوب', 'en': 'Required time'},
    'submit_offer': {'ar': 'تقديم عرض سعر', 'en': 'Submit Offer'},
    'send_offer': {'ar': 'إرسال العرض', 'en': 'Send Offer'},
    'price_required': {'ar': 'السعر مطلوب', 'en': 'Price required'},
    'invalid_price': {
      'ar': 'أدخل السعر بالأرقام فقط، مثل 15 أو 12.5',
      'en': 'Enter the price in numbers only, like 15 or 12.5',
    },
    'price_below_minimum': {
      'ar': 'أقل سعر مسموح هو {min} شيكل',
      'en': 'The lowest allowed price is {min} ILS',
    },
    'min_offer_price_hint': {
      'ar': 'أقل سعر مسموح: {min} شيكل',
      'en': 'Lowest allowed price: {min} ILS',
    },
    'time_required': {'ar': 'الوقت مطلوب', 'en': 'Time required'},
    'invalid_time': {
      'ar': 'أدخل الوقت بالدقائق من 1 إلى 1440',
      'en': 'Enter the time in minutes, from 1 to 1440',
    },
    'offer_sent': {'ar': 'تم إرسال عرض السعر', 'en': 'Offer sent successfully'},
    'delivery_progress': {
      'ar': 'مضى: %d من %t دقيقة',
      'en': 'Elapsed: %d of %t minutes',
    },
    'delivery_remaining': {
      'ar': 'المتبقي: %d دقيقة',
      'en': 'Remaining: %d minutes',
    },
    'delivery_overdue': {'ar': 'تجاوز الوقت المحدد', 'en': 'Overdue'},
    'delivery_not_started': {
      'ar': 'بانتظار بدء السائق للتوصيل',
      'en': 'Waiting for the driver to start delivery',
    },
    'track_driver': {'ar': 'تتبع السائق', 'en': 'Track driver'},
    'driver_location': {'ar': 'موقع السائق', 'en': 'Driver location'},
    'driver_location_unavailable': {
      'ar': 'لم يرسل السائق موقعه بعد',
      'en': "The driver hasn't shared a location yet",
    },
    'driver_location_updated': {
      'ar': 'آخر تحديث للموقع متاح',
      'en': 'Location is up to date',
    },
    'driver_location_updated_at': {
      'ar': 'آخر تحديث للموقع: %s',
      'en': 'Location updated at %s',
    },
    'awaiting_delivery_confirmation': {
      'ar': 'بانتظار تأكيد التسليم',
      'en': 'Awaiting delivery confirmation',
    },
    'delivery_confirmation_requested_title': {
      'ar': 'السائق يطلب تأكيد التسليم',
      'en': 'Driver requested delivery confirmation',
    },
    'delivery_confirmation_requested_body': {
      'ar': 'يرجى تأكيد استلام الطلب أو عدم الموافقة على التسليم.',
      'en': 'Please approve the delivery or reject it.',
    },
    'approve_delivery': {
      'ar': 'الموافقة على التسليم',
      'en': 'Approve delivery',
    },
    'reject_delivery': {
      'ar': 'عدم الموافقة على التسليم',
      'en': 'Reject delivery',
    },
    'delivery_approved_message': {
      'ar': 'تم تأكيد التسليم وإكمال الطلب.',
      'en': 'Delivery confirmed and order completed.',
    },
    'delivery_rejected_message': {
      'ar': 'تم رفض تأكيد التسليم. سيبقى الطلب قيد التنفيذ.',
      'en': 'Delivery confirmation rejected. The order remains in progress.',
    },
    'reject_delivery_confirm_title': {
      'ar': 'رفض تأكيد التسليم؟',
      'en': 'Reject delivery confirmation?',
    },
    'reject_delivery_confirm_message': {
      'ar':
          'سيتم إبلاغ السائق بأنك لم توافق على التسليم، وسيبقى الطلب قيد التنفيذ.',
      'en':
          'The driver will be notified that you rejected the delivery, and the order will remain in progress.',
    },
    'waiting_customer_confirmation': {
      'ar': 'تم إرسال طلب تأكيد التسليم إلى الزبون.',
      'en': 'Delivery confirmation request sent to the customer.',
    },
    'delivery_confirmed_provider': {
      'ar': 'أكد الزبون استلام الطلب وتم إكماله.',
      'en': 'The customer confirmed delivery and the order was completed.',
    },
    'delivery_rejected_provider': {
      'ar': 'رفض الزبون تأكيد التسليم. يمكنك إعادة المحاولة.',
      'en': 'The customer rejected the delivery. You can try again.',
    },
    'offer_already_submitted': {
      'ar': 'لقد قدمت عرض سعر لهذا الطلب مسبقاً.',
      'en': 'You have already submitted an offer for this order.',
    },
    'provider_busy_offer': {
      'ar':
          'لا يمكنك تقديم عرض الآن لأن لديك طلباً نشطاً. أكمل طلبك الحالي أولاً.',
      'en':
          'You cannot submit an offer while you have an active order. Complete your current order first.',
    },
    'provider_unavailable_offer': {
      'ar':
          'استقبال الطلبات متوقف. فعّل خيار استقبال الطلبات أولاً لتتمكن من تقديم عرض سعر.',
      'en':
          'Order reception is paused. Enable receiving orders before submitting your offer.',
    },
    'offer_cooldown_active': {
      'ar': 'لا يمكن تقديم عرض سعر حاليا',
      'en': 'You cannot submit an offer right now',
    },
    'cooldown_remaining': {
      'ar': 'متبقي: %d ثانية',
      'en': 'Remaining: %d seconds',
    },
    'resend_order': {
      'ar': 'إعادة إرسال الطلب للسائقين',
      'en': 'Resend Order to Drivers',
    },
    'order_resent': {
      'ar': 'تم إعادة إرسال الطلب للسائقين',
      'en': 'Order resent to drivers',
    },
    'offer_expires_in': {
      'ar': 'ينتهي العرض خلال %d ثانية',
      'en': 'Offer expires in %d seconds',
    },
    'offer_expired': {'ar': 'انتهت صلاحية العرض', 'en': 'Offer expired'},
    'offer_window_expired': {
      'ar': 'انتهت مدة قبول السعر',
      'en': 'Price offer acceptance period expired',
    },
    'offer_window_expired_short': {'ar': 'انتهت المدة', 'en': 'Expired'},
    'driver_taken_notification_title': {
      'ar': 'السائق لم يعد متاحاً',
      'en': 'Driver no longer available',
    },
    'driver_taken_notification_body': {
      'ar':
          'هذا السائق استلم طلباً آخر، لذلك أُلغي عرض سعره. يمكنك إعادة إرسال الطلب مرة أخرى لسائق آخر متاح، أو قبول عرض سائق آخر.',
      'en':
          'This driver took another order, so their offer was cancelled. You can resend the order to another available driver, or accept another driver offer.',
    },
    'another_driver_selected_title': {
      'ar': 'تم اختيار سائق آخر',
      'en': 'Another driver was selected',
    },
    'another_driver_selected_body': {
      'ar': 'تم قبول عرض سائق آخر لهذا الطلب بقيمة %d شيكل.',
      'en': 'Another driver offer was accepted for this order at %d shekels.',
    },
    'continue_viewing_offers': {
      'ar': 'متابعة العروض',
      'en': 'Continue viewing offers',
    },
    'driver_taken_short': {
      'ar': 'هذا السائق استلم طلباً آخر',
      'en': 'This driver took another order',
    },
    'order_suspended': {'ar': 'الطلب معلق', 'en': 'Order suspended'},
    'order_suspended_report_in': {
      'ar': 'سيُنقل الطلب إلى التقارير خلال %d ثانية',
      'en': 'Order will move to reports in %d seconds',
    },
    'your_price': {'ar': 'سعر التوصيل', 'en': 'Delivery Price'},
    'price_hint': {
      'ar': 'أدخل سعر التوصيل بالشيكل',
      'en': 'Enter delivery price in SHE',
    },
    'offers_list': {'ar': 'عروض الأسعار', 'en': 'Price Offers'},
    'awaiting_driver_offers': {
      'ar': 'قيد انتظار عروض السائقين',
      'en': 'Waiting for driver offers',
    },
    'order_rejected_by_drivers_count': {
      'ar': 'تم رفض طلبك من قبل %d سائقين',
      'en': 'Your order was rejected by %d drivers',
    },
    'no_offers': {'ar': 'لا توجد عروض بعد', 'en': 'No offers yet'},
    'accepted': {'ar': 'مقبول', 'en': 'Accepted'},
    'rejected': {'ar': 'مرفوض', 'en': 'Rejected'},
    'accept_offer': {'ar': 'قبول العرض', 'en': 'Accept Offer'},

    // Notifications
    'notifications': {'ar': 'الإشعارات', 'en': 'Notifications'},
    'mark_all_read': {'ar': 'تحديد الكل كمقروء', 'en': 'Mark All as Read'},
    'no_notifications': {'ar': 'لا توجد إشعارات', 'en': 'No notifications'},

    // Pending orders
    'new_orders_title': {'ar': 'الطلبات الجديدة', 'en': 'New Orders'},
    'no_new_orders': {'ar': 'لا توجد طلبات جديدة', 'en': 'No new orders'},
    'hidden_phone': {'ar': 'رقم مخفي', 'en': 'Hidden Phone'},
    'submit_offer_btn': {'ar': 'تقديم عرض سعر', 'en': 'Submit Offer'},

    // General
    'loading': {'ar': 'جاري التحميل...', 'en': 'Loading...'},
    'error': {'ar': 'خطأ', 'en': 'Error'},
    'back': {'ar': 'رجوع', 'en': 'Back'},
    'save': {'ar': 'حفظ', 'en': 'Save'},
    'cancel': {'ar': 'إلغاء', 'en': 'Cancel'},
    'confirm': {'ar': 'تأكيد', 'en': 'Confirm'},
    'cancel_order': {'ar': 'إلغاء الطلب', 'en': 'Cancel Order'},
    'cancel_order_confirm': {
      'ar': 'هل أنت متأكد من إلغاء هذا الطلب؟',
      'en': 'Are you sure you want to cancel this order?',
    },
    'order_cancelled': {'ar': 'تم إلغاء الطلب', 'en': 'Order cancelled'},
    'no_orders': {'ar': 'لا توجد طلبات', 'en': 'No orders'},
    'order_details': {'ar': 'تفاصيل الطلب', 'en': 'Order Details'},
    'orders_report': {'ar': 'تقرير الطلبات', 'en': 'Orders Report'},
    'order_report': {'ar': 'تقرير الطلب', 'en': 'Order Report'},
    'offers_history': {'ar': 'سجل العروض', 'en': 'Offers History'},
    'order_rejected_by_drivers': {
      'ar': 'تم رفض الطلب من السائقين',
      'en': 'The order was rejected by drivers',
    },
    'status_cancelled': {'ar': 'تم إلغاء الطلب', 'en': 'Order Cancelled'},
    'status_expired': {'ar': 'انتهت صلاحية الطلب', 'en': 'Order Expired'},
    'orders_load_failed': {
      'ar': 'تعذّر تحميل طلباتك. تحقّق من الاتصال ثم أعد المحاولة.',
      'en': 'Could not load your orders. Check your connection and try again.',
    },
    'dashboard_load_failed': {
      'ar': 'تعذّر تحميل لوحة التحكم. تحقّق من الاتصال ثم أعد المحاولة.',
      'en':
          'Could not load your dashboard. Check your connection and try again.',
    },
    'dashboard_refresh_failed': {
      'ar': 'تعذّر تحديث البيانات. الأرقام المعروضة هي آخر قيم محفوظة.',
      'en': 'Could not refresh. The figures shown are the last known values.',
    },
    'order_date': {'ar': 'تاريخ الطلب', 'en': 'Order Date'},
    'description': {'ar': 'الوصف', 'en': 'Description'},
    'images': {'ar': 'الصور', 'en': 'Images'},
    'phone_hidden': {'ar': 'رقم مخفي', 'en': 'Hidden Phone'},
    'settings': {'ar': 'الإعدادات', 'en': 'Settings'},
    'language': {'ar': 'اللغة', 'en': 'Language'},
    'theme': {'ar': 'المظهر', 'en': 'Theme'},
    'light': {'ar': 'فاتح', 'en': 'Light'},
    'dark': {'ar': 'داكن', 'en': 'Dark'},

    // Real-time
    'new_offer_received': {'ar': 'عرض سعر جديد:', 'en': 'New offer:'},

    // Offers screen
    'driver_offers_for': {
      'ar': 'عروض السائقين للطلب',
      'en': 'Driver Offers for Order',
    },
    'accept': {'ar': 'قبول', 'en': 'Accept'},
    'offers_not_loaded': {
      'ar': 'اضغط على الطلب لعرض عروض الأسعار',
      'en': 'Tap order to view offers',
    },

    // My orders screen
    'tap_to_view_offers': {
      'ar': 'اضغط لعرض العروض',
      'en': 'Tap to view offers',
    },

    // Active orders
    'start_delivery': {'ar': 'بدء التوصيل', 'en': 'Start Delivering'},
    'confirm_delivery': {'ar': 'تأكيد التسليم', 'en': 'Confirm Delivery'},
    'status_updated': {'ar': 'تم تحديث الحالة', 'en': 'Status Updated'},
    'order_completed_msg': {
      'ar': 'تم اكتمال الطلب بنجاح',
      'en': 'Order completed successfully',
    },
    'price': {'ar': 'السعر', 'en': 'Price'},

    // Reports
    'report_driver': {'ar': 'الابلاغ عن سائق', 'en': 'Report a Driver'},
    'report_customer': {'ar': 'الابلاغ عن زبون', 'en': 'Report a Customer'},
    'report_sent': {
      'ar': 'تم إرسال البلاغ بنجاح',
      'en': 'Report sent successfully',
    },
    'in_review': {'ar': 'قيد المراجعة', 'en': 'In Review'},
    'in_progress': {'ar': 'قيد المعالجة', 'en': 'In Progress'},
    'resolved': {'ar': 'تم الحل', 'en': 'Resolved'},
    'enter_id': {
      'ar': 'أدخل ID الشخص المراد الإبلاغ عنه',
      'en': 'Enter the ID of the person to report',
    },
    'problem_desc': {'ar': 'وصف المشكلة', 'en': 'Problem Description'},
    'explain_problem': {
      'ar': 'اشرح المشكلة التي تواجهها',
      'en': 'Explain the problem you are facing',
    },
    'send_report_btn': {'ar': 'إرسال البلاغ', 'en': 'Send Report'},
    'last_reports': {'ar': 'آخر البلاغات', 'en': 'Previous Reports'},
    'no_reports': {'ar': 'لا توجد بلاغات سابقة', 'en': 'No previous reports'},
    'support_team': {'ar': 'الدعم الفني', 'en': 'Support Team'},
    'you': {'ar': 'أنت', 'en': 'You'},

    // Chat
    'start_chat': {
      'ar': 'ابدأ محادثة مع فريق الدعم',
      'en': 'Start a conversation with support',
    },
    'type_message': {'ar': 'اكتب رسالتك...', 'en': 'Type your message...'},

    // Time
    'est_time': {
      'ar': 'الوقت المطلوب: %d دقيقة',
      'en': 'Estimated time: %d minutes',
    },
    'minutes_suffix': {'ar': 'د', 'en': 'm'},

    // Offered orders
    'no_offered_orders': {'ar': 'لا توجد طلبات', 'en': 'No orders'},
    'awaiting_response': {'ar': 'بانتظار الرد', 'en': 'Awaiting Response'},

    // Contact form
    'name_field': {'ar': 'الاسم', 'en': 'Name'},
    'email_field': {'ar': 'البريد الإلكتروني', 'en': 'Email'},
    'phone_field': {'ar': 'رقم الجوال', 'en': 'Phone Number'},
    'message_field': {'ar': 'رسالتك', 'en': 'Your Message'},
    'message_hint': {
      'ar': 'اكتب مشكلتك هنا...',
      'en': 'Type your issue here...',
    },
    'contact_success': {
      'ar': 'تم إرسال رسالتك. سنتواصل معك قريباً.',
      'en': 'Message sent. We will contact you soon.',
    },
    'contact_failed': {
      'ar': 'فشل الإرسال. حاول مرة أخرى.',
      'en': 'Send failed. Try again.',
    },
    'retry': {'ar': 'إعادة المحاولة', 'en': 'Retry'},
    'governoratesLoading': {
      'ar': 'جاري تحميل المحافظات...',
      'en': 'Loading governorates...',
    },
    'governoratesLoadFailed': {
      'ar': 'تعذّر تحميل المحافظات. تحقق من الاتصال بالخادم ثم أعد المحاولة.',
      'en':
          'Could not load the governorates. Check the connection to the server and try again.',
    },
    'profile': {'ar': 'الملف الشخصي', 'en': 'Profile'},
    'logout': {'ar': 'تسجيل الخروج', 'en': 'Log out'},
    'send': {'ar': 'إرسال', 'en': 'Send'},
    'home_quick_actions': {'ar': 'الإجراءات السريعة', 'en': 'Quick actions'},
    'new_order_subtitle': {
      'ar': 'أنشئ طلبك وأرسله للسائقين في دقائق.',
      'en': 'Create your order and send it to drivers in minutes.',
    },
    'my_orders_section': {'ar': 'طلباتي', 'en': 'My orders'},
    'order_settings_section': {'ar': 'إعدادات الطلب', 'en': 'Order settings'},
    'help_and_report_section': {
      'ar': 'المساعدة والإبلاغ',
      'en': 'Help & reporting',
    },
    'financial_summary_section': {
      'ar': 'الأرباح والعمولة',
      'en': 'Earnings & commission',
    },
    'driver_orders_section': {'ar': 'الطلبات', 'en': 'Orders'},
    'work_settings_section': {'ar': 'إعدادات العمل', 'en': 'Work settings'},
    'support_contact_title': {
      'ar': 'التواصل مع الدعم',
      'en': 'Contact support',
    },
    'contact_support': {'ar': 'التواصل مع الدعم', 'en': 'Contact support'},
    'agree': {'ar': 'أوافق', 'en': 'Agree'},
    'decline': {'ar': 'أرفض', 'en': 'Decline'},

    // Legal dialogs (UX01-003). Dialog titles are ordinary UI and localized;
    // the bodies remain the approved Arabic-only legal documents and are
    // rendered explicitly RTL independent of the app locale.
    'legal_terms_title': {'ar': 'شروط الخدمة', 'en': 'Terms of Service'},
    'legal_privacy_title': {'ar': 'سياسة الخصوصية', 'en': 'Privacy Policy'},
    'reject_terms_title': {'ar': 'الشروط مطلوبة', 'en': 'Agreement Required'},
    'reject_terms_body': {
      'ar':
          'الموافقة على شروط الخدمة وسياسة الخصوصية هي جزء أساسي من استخدام هذا التطبيق. لا يمكنك إنشاء حساب دون الموافقة عليهما.',
      'en':
          'Agreeing to the Terms of Service and Privacy Policy is a required part of using this app. You cannot create an account without agreeing to them.',
    },
    'ok': {'ar': 'حسناً', 'en': 'OK'},
    'account_under_review': {
      'ar': 'حسابك قيد المراجعة',
      'en': 'Your account is under review',
    },
    'invalid_credentials': {
      'ar': 'البريد الإلكتروني أو كلمة المرور أو نوع الحساب غير صحيح',
      'en': 'Wrong email, password or account type',
    },

    // UX-03 shared UI foundation.
    'logout_confirm_title': {'ar': 'تسجيل الخروج؟', 'en': 'Log out?'},
    'logout_confirm_message': {
      'ar': 'ستحتاج إلى تسجيل الدخول مجدداً لاستخدام التطبيق.',
      'en': 'You will need to sign in again to use the app.',
    },
    'unread_notifications': {
      'ar': '%d إشعارات غير مقروءة',
      'en': '%d unread notifications',
    },
    'unread': {'ar': 'غير مقروء', 'en': 'Unread'},
    'pinned': {'ar': 'مثبت', 'en': 'Pinned'},
    'remove_photo': {'ar': 'إزالة الصورة', 'en': 'Remove photo'},
    'view_image': {'ar': 'عرض الصورة', 'en': 'View image'},
    'send_message': {'ar': 'إرسال الرسالة', 'en': 'Send message'},
    'message_failed': {
      'ar': 'فشل إرسال الرسالة',
      'en': 'Message failed to send',
    },
    'add_phone': {'ar': 'إضافة رقم هاتف', 'en': 'Add phone number'},
    'edit_phone': {'ar': 'تعديل رقم الهاتف', 'en': 'Change phone number'},
    'new_phone_number': {'ar': 'الرقم الجديد', 'en': 'New number'},
    'phone_updated': {
      'ar': 'تم تحديث رقم الهاتف',
      'en': 'Phone number updated',
    },
    'phone_update_failed': {
      'ar': 'تعذر حفظ رقم الهاتف',
      'en': 'Could not save the phone number',
    },
    'delete': {'ar': 'حذف', 'en': 'Delete'},

    // Governorate-level work mode.
    'governorate_scope_customer_title': {
      'ar': 'إرسال الطلبات على مستوى المحافظة',
      'en': 'Send orders across the governorate',
    },
    'governorate_scope_customer_subtitle': {
      'ar':
          'عند التفعيل تصل طلباتك الجديدة إلى السائقين في كل قرى ومدن محافظة %s الذين فعّلوا هذا الخيار.',
      'en':
          'When enabled, your new orders can reach drivers across %s governorate who enabled this option.',
    },
    'governorate_scope_provider_title': {
      'ar': 'استقبال الطلبات من كل المحافظة',
      'en': 'Receive orders from the whole governorate',
    },
    'governorate_scope_provider_subtitle': {
      'ar':
          'عند التفعيل تستقبل الطلبات من كل قرى ومدن محافظة %s. عند الإيقاف تستقبل طلبات منطقتك فقط.',
      'en':
          'When on, you receive orders from every city and village in %s governorate. When off, only orders from your own area.',
    },
    'governorate_scope_enabled': {
      'ar': 'تم تفعيل العمل على مستوى المحافظة.',
      'en': 'Governorate-level mode enabled.',
    },
    'governorate_scope_disabled': {
      'ar': 'تم إيقاف العمل على مستوى المحافظة.',
      'en': 'Governorate-level mode disabled.',
    },
    'governorate_scope_update_failed': {
      'ar': 'تعذر تحديث إعداد مستوى المحافظة. حاول مرة أخرى.',
      'en': 'Could not update the governorate-level setting. Try again.',
    },
    'governorate_scope_loading': {'ar': 'جاري الحفظ...', 'en': 'Saving...'},
    'your_governorate': {'ar': 'محافظتك', 'en': 'your governorate'},
    'governorate_scope_banner_customer': {
      'ar': 'وضع المحافظة مفعّل: طلبك سيُرسل إلى كل مدن وقرى محافظة %s.',
      'en':
          'Governorate mode is on: your order goes to every city and village in %s.',
    },
    'governorate_scope_banner_provider': {
      'ar': 'وضع المحافظة مفعّل: تستقبل طلبات من كل مدن وقرى محافظة %s.',
      'en': 'Governorate mode is on: you receive orders from across %s.',
    },
    'governorate_order_warning_title': {
      'ar': 'تنبيه: طلب على مستوى المحافظة',
      'en': 'Warning: governorate-level order',
    },
    'governorate_order_warning_message': {
      'ar':
          'سيتم عرض طلبك على السائقين في كل قرى ومدن محافظة %s الذين فعّلوا استقبال طلبات المحافظة، وقد يستلمه سائق من خارج منطقتك (%s).',
      'en':
          'Your order will be shown to drivers across %s governorate who enabled governorate-level orders, and may be received by a driver outside your area (%s).',
    },
    'governorate_order_warning_note': {
      'ar':
          'لا تتابع إلا إذا كنت موافقاً على أن يعمل على طلبك سائق من قرية أو مدينة أخرى داخل محافظتك.',
      'en':
          'Continue only if you accept that a driver from another village or city in your governorate may handle your order.',
    },
    'governorate_order_warning_confirm': {
      'ar': 'إرسال الطلب',
      'en': 'Send order',
    },
    'governorate_outside_area_title': {
      'ar': 'تحذير: هذا الطلب خارج منطقتك',
      'en': 'Warning: this order is outside your area',
    },
    'governorate_outside_area_message': {
      'ar':
          'الطلب من %s داخل محافظة %s، بينما منطقتك المسجلة هي %s. يمكنك المتابعة إذا كنت مستعداً للعمل خارج قريتك.',
      'en':
          'The order is from %s in %s governorate, while your registered area is %s. Continue only if you are willing to work outside your village.',
    },
    'governorate_outside_area_note': {
      'ar':
          'يظهر لك هذا الطلب لأنك فعّلت خيار العمل على مستوى المحافظة، وصاحب الطلب فعّله أيضاً.',
      'en':
          'You see this order because you enabled governorate-level mode and the customer enabled it too.',
    },
    'governorate_outside_area_confirm': {
      'ar': 'متابعة تقديم العرض',
      'en': 'Continue to offer',
    },
    'governorate_warning_wait': {
      'ar': 'يمكنك المتابعة بعد %d ثوانٍ.',
      'en': 'You can continue in %d seconds.',
    },
    'provider_outside_area_badge': {
      'ar': 'خارج منطقتك',
      'en': 'Outside your area',
    },
    'provider_outside_area_card': {
      'ar': 'هذا العرض من سائق خارج منطقتك: %s — محافظة %s.',
      'en':
          'This offer is from a driver outside your area: %s in %s governorate.',
    },
    'provider_outside_area_title': {
      'ar': 'السائق من خارج منطقتك',
      'en': 'Driver outside your area',
    },
    'provider_outside_area_message': {
      'ar':
          'هذا السائق من %s — محافظة %s، بينما طلبك في %s. هل تريد قبول عرضه؟',
      'en':
          'This driver is from %s in %s governorate, while your order is in %s. Accept this offer?',
    },
    'provider_outside_area_confirm': {'ar': 'قبول العرض', 'en': 'Accept offer'},
  };
}
