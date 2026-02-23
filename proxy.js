const fetch = (...args) => import( node-fetch ).then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  // إعدادات السماح بالاتصال من أي مكان (CORS)
  res.setHeader( 'Access-Control-Allow-Origin' ,  '*' );
  res.setHeader( 'Access-Control-Allow-Methods' ,  'GET, POST, OPTIONS' );
  res.setHeader( 'Access-Control-Allow-Headers' ,  'Content-Type' );

  // التعامل مع طلبات الاختبار (Preflight)
  if (req.method ===  'OPTIONS' ) {
    return res.status(200).end();
  }

  const { key } = req.query;
  // رابط جوجل الرسمي
  const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${key}`;

  try {
    const response = await fetch(targetUrl, {
      method:  'POST' ,
      headers: {  'Content-Type' :  'application/json'  },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
