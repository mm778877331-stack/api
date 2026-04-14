const fetch = (...args) => import( 'node-fetch' ).then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  // 1. إعدادات الـ CORS والـ Streaming
  res.setHeader( 'Access-Control-Allow-Origin' ,  '*' );
  res.setHeader( 'Access-Control-Allow-Methods' ,  'POST, OPTIONS' );
  res.setHeader( 'Access-Control-Allow-Headers' ,  'Content-Type' );
  res.setHeader( 'Content-Type' ,  'text/event-stream; charset=utf-8' );
  res.setHeader( 'Cache-Control' ,  'no-cache' );
  res.setHeader( 'Connection' ,  'keep-alive' );

  if (req.method ===  'OPTIONS' ) return res.status(200).end();

  // 🛑 التطوير الأول: مصفوفة المفاتيح (أضف مفاتيحك هنا في فيرسل)
  const keys = [
    process.env.GEMINI_KEY_1, 
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3
  ].filter(k => k); // تصفية المفاتيح الموجودة فقط

  // اختيار مفتاح عشوائي لتقليل الضغط على المفتاح الواحد
  const selectedKey = keys[Math.floor(Math.random() * keys.length)];

  if (!selectedKey) {
    return res.status(500).json({ error: "لا توجد مفاتيح API متوفرة في السيرفر" });
  }

  // 🛑 التطوير الثاني: توجيه الطلب لـ Gemini Flash (الأسرع والأنسب لليمن)
  const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?key=${selectedKey}`;

  try {
    const response = await fetch(targetUrl, {
      method:  'POST' ,
      headers: {  'Content-Type' :  'application/json'  },
      body: JSON.stringify(req.body)
    });

    // إذا جوجل رفضت الطلب بسبب الحظر أو استهلاك المفتاح
    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ 
        error: "فشل الاتصال ", 
        details: errorData 
      });
    }

    // 🛑 التطوير الثالث: تمرير البث بأمان
    response.body.pipe(res);

  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};
