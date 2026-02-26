const fetch = (...args) => import( 'node-fetch' ).then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  // ترويسات CORS للسماح بالاتصال من فلاتر
  res.setHeader( 'Access-Control-Allow-Origin' ,  '*' );
  res.setHeader( 'Access-Control-Allow-Methods' ,  'GET, POST, OPTIONS' );
  res.setHeader( 'Access-Control-Allow-Headers' ,  'Content-Type' );

  if (req.method ===  'OPTIONS' ) {
    return res.status(200).end();
  }

  // الحصول على المفتاح من الرابط بطريقة حديثة
  const { key } = req.query;
  
  // رابط Gemini المباشر
  const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${key}`;

  try {
    const response = await fetch(targetUrl, {
      method:  'POST' ,
      headers: {  'Content-Type' :  'application/json'  },
      body: JSON.stringify(req.body)
    });

    // تحويل الرد إلى JSON وإرساله
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
};
