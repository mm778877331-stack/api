const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

// 🛑 إعدادات التشفير (يجب أن تطابق الفلاتر تماماً)
const ENCRYPTION_KEY = Buffer.from("VX_SUPER_SECRET_KEY_32_CHARS_MAX"); 
const IV_LENGTH = 16; 

function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
    try {
        let textParts = text.split(":");
        let iv = Buffer.from(textParts.shift(), "hex");
        let encryptedText = Buffer.from(textParts.join(":"), "hex");
        let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch (e) {
        return null;
    }
}

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    // 🔑 جلب المفاتيح من إعدادات Vercel
    const keys = [
        process.env.GEMINI_KEY_1,
        process.env.GEMINI_KEY_2,
        process.env.GEMINI_KEY_3
    ].filter(k => k);

    try {
        // 🔒 فك تشفير الطلب القادم من فلاتر
        const encryptedRequest = req.body.vXRequest;
        const decryptedPrompt = decrypt(encryptedRequest);

        if (!decryptedPrompt) {
            return res.status(200).json({ vXPayload: encrypt("⚠️ عائق في تأمين قناة الاتصال.") });
        }

        // 🚀 وظيفة المحاولة المتكررة (Failover)
        async function tryWithKey(index) {
            if (index >= keys.length) {
                throw new Error("ALL_KEYS_FAILED");
            }

            const currentKey = keys[index];
            // استخدمت لك الموديل flash-latest كما طلبت مع رابط الـ v1beta
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${currentKey}`;

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: decryptedPrompt }] }],
                    tools: [{ googleSearch: {} }] // تفعيل البحث
                })
            });

            const data = await response.json();

            // إذا فشل المفتاح (429 أو 400) جرب التالي
            if (response.status !== 200 || data.error) {
                console.warn(Key ${index + 1} failed, trying next...);
                return await tryWithKey(index + 1);
            }

            return data;
        }

        const result = await tryWithKey(0);
        const aiResponse = result.candidates[0].content.parts[0].text;

        // 🔒 تشفير الرد النهائي
        res.status(200).json({ vXPayload: encrypt(aiResponse) });

    } catch (error) {
        res.status(200).json({ vXPayload: encrypt("نظام Vision X يواجه ضغطاً، حاول مجدداً بعد ثوانٍ.") });
    }
};
