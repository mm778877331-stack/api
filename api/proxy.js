const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

// 🛑 مفتاح التشفير (تأكد إنه 32 حرف بالضبط كما في فلاتر)
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
        if (!text || !text.includes(":")) return text;
        let textParts = text.split(":");
        let iv = Buffer.from(textParts.shift(), "hex");
        let encryptedText = Buffer.from(textParts.join(":"), "hex");
        let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch (e) { return text; }
}

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    // 🚀 الحركة الانتحارية: وضع المفتاح مباشرة داخل الكود
    const hardcodedKey = "AIzaSyASFpa_Vki96Lxbbau20fzsnTMplRsFg6Y"; 

    try {
        let rawPrompt = req.body.vXRequest || req.body.prompt;
        let decryptedPrompt = decrypt(rawPrompt);

        // طلب مباشر لجوجل بدون لف ولا دوران
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${hardcodedKey}`;
        
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
            // إذا جوجل ردت بخطأ، اطبعه لنا عشان نشوفه في الفلاتر
            const errorMsg = data.error ? data.error.message : "خطأ غير معروف من جوجل";
            res.status(200).json({ vXPayload: encrypt(جوجل قالت: ${errorMsg}) });
        }

    } catch (error) {
        res.status(200).json({ vXPayload: encrypt("فشل داخلي في البروكسي: " + error.message) });
    }
};
