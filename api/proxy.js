const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

const ENCRYPTION_KEY = Buffer.from("VX_SUPER_SECRET_KEY_32_CHARS_MAX"); 
const IV_LENGTH = 16; 

let globalIndex = 0;

function decrypt(text) {
    try {
        if (!text || !text.includes(":")) return text;
        let textParts = text.split(":");
        let iv = Buffer.from(textParts.shift(), "hex"); 
        let encryptedText = textParts.join(":"); 
        let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, "base64", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch (e) { return text; }
}

function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    return iv.toString("hex") + ":" + encrypted;
}

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    const allKeys = Object.keys(process.env)
        .filter(key => key.startsWith("GEMINI_"))
        .map(key => process.env[key]);

    if (allKeys.length === 0) return res.status(200).json({ vXPayload: encrypt("❌ لا توجد مفاتيح في السيرفر") });

    // 1. استلام البرومبت وفك تشفيره
    let rawPrompt = req.body.vXRequest || req.body.prompt;
    let decryptedPrompt = decrypt(rawPrompt);
    
    // 2. الفحص الذكي: هل يحتاج البحث؟ (عشان نوفر الكوتا)
    const needsSearch = /سعر|أخبار|مباراة|نتيجة|رابط|تحميل|بحث|أين|متى|من هو|ماهي|news|search/i.test(decryptedPrompt);

    // 3. تجهيز الـ Body
    let bodyContent = {
        contents: [{ role: "user", parts: [{ text: decryptedPrompt }] }]
    };

    if (needsSearch) {
        bodyContent.tools = [{ google_search_retrieval: {} }];
    }

    // 4. محاولة الإرسال مع جيش المفاتيح
    let attempts = 0;
    while (attempts < allKeys.length) {
        const currentKey = allKeys[globalIndex % allKeys.length];
        globalIndex++;
        attempts++;

        try {
            // استخدام الموديل المستقر 1.5-flash
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${currentKey}`;
            
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyContent)
            });

            const data = await response.json();

            if (response.ok && data.candidates && data.candidates[0].content) {
                const aiText = data.candidates[0].content.parts[0].text;
                return res.status(200).json({ vXPayload: encrypt(aiText) });
            }

            // لو المفتاح خالص، كمل للـ Key اللي بعده
            if (response.status === 429) continue;

            // لو خطأ فادح غير الكوتا، وقفه هنا وقولنا ايش السبب
            return res.status(200).json({ vXPayload: encrypt("⚠️ عائق: " + (data.error?.message || "خطأ غير متوقع")) });

        } catch (e) {
            if (attempts >= allKeys.length) break;
        }
    }

    res.status(200).json({ vXPayload: encrypt("❌ جميع المفاتيح استنزفت، جرب بعد دقيقة.") });
};
