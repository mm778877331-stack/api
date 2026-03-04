const fetch = (...args) => import( 'node-fetch' ).then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  // إعدادات الـ CORS للسماح لفلاتر بالاتصال
  res.setHeader( 'Access-Control-Allow-Origin' ,  '*' );
  res.setHeader( 'Access-Control-Allow-Methods' ,  'GET, POST, OPTIONS' );
  res.setHeader( 'Access-Control-Allow-Headers' ,  'Content-Type' );

  if (req.method ===  'OPTIONS' ) {
    return res.status(200).end();
  }

  // الحصول على الـ Key من الرابط
  const { key } = req.query;
  
  if (!key) {
    return res.status(400).json({ error: "Missing API Key" });
  }

  // الرابط الجديد بصيغة جوجل الرسمية
  const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;

  try {
    const response = await fetch(targetUrl, {
      method:  'POST' ,
      headers: {  'Content-Type' :  'application/json'  },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};
