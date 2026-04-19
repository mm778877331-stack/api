const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

const ENCRYPTION_KEY = Buffer.from("VX_SUPER_SECRET_KEY_32_CHARS_MAX"); 
const IV_LENGTH = 16; 

function encrypt(text) {
    try {
        let iv = crypto.randomBytes(IV_LENGTH);
        let cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
        let encrypted = cipher.update(text, "utf8", "hex");
        encrypted += cipher.final("hex");
        return iv.toString("hex") + ":" + encrypted;
    } catch (e) { return text; }
}

function decrypt(text) {
    try {
        if (!text || !text.includes(":")) return text; // إذا النص غير مشفر، ارجعه كما هو
        let textParts = text.split(":");
        let iv = Buffer.from(textParts.shift(), "hex");
        let encryptedText = Buffer.from(textParts.join(":"), "hex");
        let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch (e) { return text; } // في حال فشل التشفير، نعتبر النص عادي للنجاة
}

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    const keys = [
        "AIzaSyASFpa_Vki96Lxbbau20fzsnTMplRsFg6Y"
    ].filter(k => k);

    try {
        // 🛡️ استلام السؤال (مشفر أو عادي)
        let rawPrompt = req.body.vXRequest || req.body.prompt;
        let decryptedPrompt = decrypt(rawPrompt);

        async function tryRequest(index) {
            if (index >= keys.length) throw new Error("ALL_KEYS_FAILED");

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${keys[index]}`;
            
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: decryptedPrompt }] }],
                    tools: [{ googleSearch: {} }]
                })
            });

            const data = await response.json();
            if (response.status !== 200 || data.error) return await tryRequest(index + 1);
            return data;
        }

        const result = await tryRequest(0);
        const aiText = result.candidates[0].content.parts[0].text;
        res.status(200).json({ vXPayload: encrypt(aiText) });

    } catch (error) {
        // 🚨 رد الطوارئ النهائي
        res.status(200).json({ vXPayload: encrypt("حليفي، نظام Vision X يحتاج إعادة تشغيل المفاتيح في فيرسل.") });
    }
};
