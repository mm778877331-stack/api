const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

// 🛑 مفتاح التشفير (تأكد إنه 32 حرف بالضبط كما في فلاتر)
const ENCRYPTION_KEY = Buffer.from("VX_SUPER_SECRET_KEY_32_CHARS_MAX"); 
const IV_LENGTH = 16; 

// عداد المفاتيح (خارج الـ handler ليبقى مستمراً)
let keyIndex = 0;

function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    return iv.toString("hex") + ":" + encrypted;
}

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

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    // 🚀 مصفوفة المفاتيح الذكية من Vercel
    const keys = [
        process.env.GEMINI_KEY_1,
        process.env.GEMINI_KEY_2,
        process.env.GEMINI_KEY_3
    ].filter(k => k);

    try {
        // تبديل المفتاح مع كل طلب
        const currentKey = keys[keyIndex % keys.length];
        keyIndex++;

        let rawPrompt = req.body.vXRequest || req.body.prompt;
        let decryptedPrompt = decrypt(rawPrompt);

        // الرابط الصحيح مع المفتاح المختار والموديل المستقر
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${currentKey}`;
        
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: decryptedPrompt }] }]
            })
        });

        const data = await response.json();

        if (data.candidates && data.candidates[0].content) {
            const aiText = data.candidates[0].content.parts[0].text;
            res.status(200).json({ vXPayload: encrypt(aiText) });
        } else {
            let errorInfo = data.error ? data.error.message : "Google No Response";
            res.status(200).json({ vXPayload: encrypt("Error" + errorInfo });
        }

    } catch (error) {
        res.status(200).json({ vXPayload: encrypt("Proxy Crash : " + error.message) });
    }
};
