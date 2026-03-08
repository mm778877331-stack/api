const fetch = (...args) => import( 'node-fetch' ).then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  // 1. إعدادات الـ CORS الكاملة
  res.setHeader( 'Access-Control-Allow-Origin' ,  '*' );
  res.setHeader( 'Access-Control-Allow-Methods' ,  'GET, POST, OPTIONS' );
  res.setHeader( 'Access-Control-Allow-Headers' ,  'Content-Type' );

  if (req.method ===  'OPTIONS' ) {
    return res.status(200).end();
  }

  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ error: "Missing API Key" });
  }

  // 2. التغيير الجوهري: استخدام رابط الـ streamGenerateContent
  const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?key=${key}`;

  try {
    const response = await fetch(targetUrl, {
      method:  'POST' ,
      headers: {  'Content-Type' :  'application/json'  },
      body: JSON.stringify(req.body)
    });

    // 3. إعداد الـ Header لإخبار التطبيق أن الرد عبارة عن "بث مباشر"
    res.setHeader( 'Content-Type' ,  'text/event-stream' );
    res.setHeader( 'Cache-Control' ,  'no-cache' );
    res.setHeader( 'Connection' ,  'keep-alive' );

    // 4. تمرير البيانات قطعة قطعة (Stream) من جوجل إلى تطبيقك مباشرة
    response.body.pipe(res);

  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};
