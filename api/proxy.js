const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

const ENCRYPTION_KEY = Buffer.from("VX_SUPER_SECRET_KEY_32_CHARS_MAX"); 
const IV_LENGTH = 16; 

// عداد عالمي لتوزيع الطلبات بين المفاتيح (Round Robin)
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

    // 🚀 جلب كل المفاتيح التي تبدأ بـ GEMINI_
    const allKeys = Object.keys(process.env)
        .filter(key => key.startsWith("GEMINI_"))
        .map(key => process.env[key]);

    if (allKeys.length === 0) return res.status(200).json({ vXPayload: encrypt("❌ لا توجد مفاتيح في السيرفر") });

    let decryptedPrompt = decrypt(req.body.vXRequest || req.body.prompt);
    
    // --- الاستراتيجية الصارمة: جرب المفتاح المجدول، وإذا فشل، جرب البقية ---
    let attempts = 0;
    while (attempts < allKeys.length) {
        const currentKey = allKeys[globalIndex % allKeys.length];
        globalIndex++; // حرك العداد للطلب القادم
        attempts++;

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${currentKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: decryptedPrompt }] }],
                    tools: [{ google_search_retrieval: {} }]
                })
            });

            const data = await response.json();

            if (response.ok && data.candidates) {
                return res.status(200).json({ vXPayload: encrypt(data.candidates[0].content.parts[0].text) });
            }

            // لو المفتاح "خالص رصيده" (429)، لا تتوقف، انتقل فوراً للمفتاح التالي في اللوب
            if (response.status === 429) continue;

            // لو خطأ آخر، اخرج وأبلغ المستخدم
            return res.status(200).json({ vXPayload: encrypt("⚠️ " + (data.error?.message || "خطأ مجهول")) });

        } catch (e) {
            if (attempts >= allKeys.length) break;
        }
    }

    res.status(200).json({ vXPayload: encrypt("❌ عذراً.. جميع المفاتيح استنفدت طاقتها، جرب لاحقاً.") });
};
