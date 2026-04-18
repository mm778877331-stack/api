const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

// 🛑 مفتاح التشفير (يجب أن يطابق فلاتر 100%)
const ENCRYPTION_KEY = Buffer.from("VX_SUPER_SECRET_KEY_32_CHARS_MAX"); 
const IV_LENGTH = 16; 

function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
}

// ✨ دالة فك تشفير الطلب القادم من فلاتر (للمستقبل)
function decrypt(text) {
    let textParts = text.split(":");
    let iv = Buffer.from(textParts.shift(), "hex");
    let encryptedText = Buffer.from(textParts.join(":"), "hex");
    let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    const keys = [process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2, process.env.GEMINI_KEY_3].filter(k => k);
    const selectedKey = keys[Math.floor(Math.random() * keys.length)];

    try {
        // 🔒 استخراج المحتوى (سواء كان مشفراً أو عادياً)
        let promptText = req.body.prompt;
        if (req.body.isEncrypted) {
            promptText = decrypt(req.body.prompt);
        }

        // 🚀 الهيكل الأكثر صرامة في تاريخ جوجل (Grounding Protocol)
        const finalPayload = {
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            tools: [{ google_search: {} }], // الأداة الصافية
            generationConfig: {
                temperature: 0.4, // خفضنا الحرارة لزيادة الدقة في البحث
                topP: 1,
                maxOutputTokens: 1000
            }
        };

        const googleResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${selectedKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalPayload)
            }
        );

        const data = await googleResponse.json();

        // 🛑 فحص الأخطاء قبل التشفير
        if (data.error) {
            return res.status(400).json({ error: "خطأ فني من المصدر", code: data.error.code });
        }

        if (data.candidates && data.candidates[0].content) {
            let aiResponse = data.candidates[0].content.parts[0].text;
            
            // 🔒 التشفير البنكي للرد
            const encryptedData = encrypt(aiResponse);
            return res.status(200).json({ vXPayload: encryptedData });
        } else {
            res.status(500).json({ error: "فشل في استعادة البيانات" });
        }

    } catch (error) {
          // لو جوجل رفضت، شفر رسالة الخطأ وأرسلها عشان نشوفها في التطبيق
            const errorMsg = encrypt("جوجل رفضت الرد: " + (data.error ? data.error.message : "رد فارغ"));
            return res.status(200).json({ vXPayload: errorMsg });
    }
};
