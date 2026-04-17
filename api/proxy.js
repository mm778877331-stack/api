const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

// 🛑 إعدادات التشفير (نفسها التي في فلاتر - حافظت عليها تماماً)
const ENCRYPTION_KEY = Buffer.from("VX_SUPER_SECRET_KEY_32_CHARS_MAX"); 
const IV_LENGTH = 16; 

function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
}

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    // 🛑 جلب المفاتيح الثلاثة من إعدادات البيئة
    const keys = [
        process.env.GEMINI_KEY_1,
        process.env.GEMINI_KEY_2,
        process.env.GEMINI_KEY_3
    ].filter(k => k);

    const selectedKey = keys[Math.floor(Math.random() * keys.length)];

    if (!selectedKey) {
        return res.status(500).json({ error: "لا توجد مفاتيح مضبوطة في فيرسل!" });
    }

    try {
        // ✨ الإضافة السحرية: زرع محرك البحث داخل جسم الطلب
        const requestBody = {
            ...req.body, 
            tools: [
                {
                    googleSearchRetrieval: {
                        dynamicRetrievalConfig: {
                            mode: "dynamic",
                            dynamicThreshold: 0.3,
                        },
                    },
                },
            ],
        };

        const response = await fetch(
           `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${selectedKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            }
        );

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            let originalText = data.candidates[0].content.parts[0].text;
            
            // 🛑 تشفير الرد بالكامل لضمان الخصوصية في التطبيق
            let encryptedPayload = encrypt(originalText);
            
            res.status(200).json({ vXPayload: encryptedPayload });
        } else {
          res.status(500).json({ error: "رد غير متوقع من جوجل", details: data });
        }
    } catch (error) {
        res.status(500).json({ error: "عائق تقني في السيرفر", details: error.message });
    }
};
