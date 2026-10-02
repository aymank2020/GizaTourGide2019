# مراجعة وتطوير دليل الجيزة

الأساس مستودع فارغ. الخطة المحددة والمنفذة: دليل أربعة أماكن بأوصاف عربية/إنجليزية قصيرة وروابط رسمية؛ بحث باللغتين، اتجاه RTL/LTR، قائمة زيارة محفوظة محليًا، وحالة فارغة ورسائل فشل التخزين. المواقع: أهرامات الجيزة، سقارة، دهشور والمتحف المصري الكبير. لا مواعيد أو تذاكر مفترضة؛ المصدر الحالي يحسمها وقت الزيارة.

المصادر المقروءة في2أكتوبر2026: [هضبة الجيزة](https://egymonuments.gov.eg/en/archaeological-sites/giza-plateau/)، [سقارة](https://egymonuments.gov.eg/archaeological-sites/saqqara/)، [دهشور](https://egymonuments.gov.eg/archaeological-sites/dahshur/)، [المتحف المصري الكبير](https://www.experienceegypt.eg/en/attraction-details/346/the-grand-egyptian-museum-gem). الأوصاف ملخصات جديدة وليست نسخًا من المقالات؛ لا صور أو أصول محمية من المواقع.

التحقق: ثلاثة اختبارات Node22 ناجحة لسجل الأماكن ومصادره والبحث/schema؛ متصفح Edge عبر HTTP أثبت ظهور الأماكن الأربعة، المفضلة بعد reload، البحث الإنجليزي وتبديل الاتجاه، رابط مصدر صحيح، عرض هاتف390px وdesktop1280px، وفشل localStorage.setItem برسالة «لهذه الجلسة فقط» مع بقاء التغيير في الواجهة. صفر أخطاء JavaScript في المسارين الأساسيين. اللقطة وreceipt في evidence خارج المستودع؛ git diff --check نجح.

التكامل والأثر: index.html -> app.mjs -> places.mjs -> filterPlaces -> بطاقات فعلية؛ نقر قائمة الزيارة -> Set -> localStorage -> parseFavorites بعد reload. اللغة تعيد رسم النص واتجاه html دون تكرار listeners للأدوات؛ أزرار البطاقات الجديدة تحل محل القديمة. جميع روابط المصدر static موثقة، والعناوين textContent. لا أسماء/صور شخصية أو خدمات حجز/خرائط.

المتبقي: ترتيب رحلة يدوي وسجل تحديث المحتوى؛ الحفظ دون اتصال نُفذ في الشريحة التالية؛ القائمة محلية وليست حسابًا أو مزامنة. لا بناء Android/iOS في هذا المشروع الويب. قارئ الواجهة يعمل عبر تقديم الملفات محليًا، والمصادر الخارجية تحتاج اتصالًا بالإنترنت.

مراجعة مستقلة لاحقة كشفت مسار استبدال البيانات التالفة بعد أول تعديل؛ أُضيف حارس readFailed، وأعيد اختبار الواجهة عبر فسادJSON ثم إضافة/تفضيل. النسخة القديمة بقيت كما هي والتعديل للجلسة فقط.


## الشريحة التالية المنفذة: فتح الدليل دون اتصال

بحث التنفيذ: توثيق MDN الرسمي لـ[Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) و[caching](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching). الزيارة الأولى عبر HTTPS أو localhost تنزل ستة ملفات محددة من مجلد المشروع. cache ثابتة الإصدار تحفظ اتساق الملفات، والتحديث ينتظر زرًا صريحًا؛ فشل تنزيل أي ملف يرفض النسخة الجديدة ويحفظ النسخة القديمة. لا تُخزّن مصادر السياحة الخارجية ولا المسارات المجهولة، ولا يُحذف cache تطبيق آخر على المضيف نفسه.

التحقق الفعلي: 10 اختبارات Node (سجل/بحث/تخزين وworker install/fetch/activate/failure وregistration fallback)؛ 10 مجموعات Edge فعلية. أُوقف خادم HTTP وجُعل المتصفح offline، ثم أعاد فتح الدليل والبحث العربي والإنجليزي والتصفية مع المفضلة السابقة. اختُبر index.html مع query؛ 404 أثناء update ثم reload offline من النسخة السابقة؛ تنزيل صحيح ينتظر المستخدم، وزر التحديث يفعّل worker ويعيد الصفحة ويحفظ قائمة الزيارة. cache مجاور بقي دون حذف. اختبار فشل التثبيت الأول وتصفح بلا ServiceWorker يعرض رسالة فشل واضحة مع استمرار الدليل المتصل. هاتف390 وdesktop1280 دون overflow، صفر pageerror. اللقطة وJSON وharness في evidence؛ برنامج المتصفح القابل للإعادة في scripts/verify-offline.cjs يحتاج Playwright وEdge ولا ينزل حزمًا تلقائيًا.

مراجعة الكود/الاختبارات ثم integration-impact-review: index.html → app.mjs/setupOffline → register(sw.js) → install ستة ملفات → activate/clients.claim → reload فعلي بعد توقف الخادم → أربع بطاقات وقائمة زيارة محفوظة. زر التحديث → waiting.postMessage → skipWaiting → controllerchange → reload؛ فشل install لا يغيّر worker السابق. اللغة تعيد نص الحالة فقط ولا تكرر التسجيل أو listeners؛ رسائل التخزين الحالية مستقلة. helper inverse/بديل غير موجود؛ كل الملفات الجديدة ضمن precache ومستهلكة فعليًا. لم تُمس بيانات localStorage بالـworker.

الفجوات: الزيارة الأولى تحتاج اتصالًا؛ التخزين قد يرفضه المتصفح أو يمسحه لاحقًا. الحالة online من المتصفح ليست ضمان وصول المصادر. روابط المصادر الخارجية تحتاج الإنترنت. يجب رفع الملفات الستة وsw.js عبر مضيف HTTPS وتغيير VERSION مع كل تعديل. لا استضافة إنتاج أو native/PWA store install أو تكامل حجز/خرائط يدّعى.
