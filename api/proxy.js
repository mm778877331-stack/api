// 1. الاستدعاءات الأساسية (كاملة وبدون نسيان)
const crypto = require("crypto");
const fetch = require("node-fetch");

// 2. مفاتيح التشفير (ثابتة لضمان توافق فلاتر)
const ENCRYPTION_KEY = Buffer.from("VX_SUPER_SECRET_KEY_32_CHARS_MAX"); 
const IV_LENGTH = 16; 
let globalIndex = 0;

// --- دالات التشفير ---
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

// 3. المحرك الهجين
module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    try {
        // جلب كل المفاتيح
        const googleKeys = Object.keys(process.env).filter(k => k.startsWith("GEMINI_")).map(k => process.env[k]);
        const groqKey = process.env.GROQ_KEY;

        let rawPrompt = req.body.vXRequest || req.body.prompt;
        let decryptedPrompt = decrypt(rawPrompt);

        // --- محاولة مع جيش Google أولاً ---
        if (googleKeys.length > 0) {
            let attempts = 0;
            // بنجرب مفتاحين من جوجل كحد أقصى قبل ما نحول لـ Groq عشان السرعة
            while (attempts < Math.min(googleKeys.length, 2)) {
                const currentKey = googleKeys[globalIndex % googleKeys.length];
                globalIndex++;
                attempts++;

                try {
                    const gResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${currentKey}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ role: "user", parts: [{ text: decryptedPrompt }] }]
                        })
                    });

                    const gData = await gResponse.json();
                    if (gResponse.ok && gData.candidates) {
                        return res.status(200).json({ vXPayload: encrypt(gData.candidates[0].content.parts[0].text) });
                    }
                    // لو زحمة (429) كمل اللوب وجرب المفتاح اللي بعده
                    if (gResponse.status !== 429) break;
                } catch (e) { continue; }
            }
        }

        // --- الخطة البديلة: التحويل الفوري لـ Groq (المنقذ) ---
        if (groqKey) {
            const qResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": Bearer ${groqKey}, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: decryptedPrompt }]
                })
            });

            const qData = await qResponse.json();
            if (qResponse.ok && qData.choices) {
                return res.status(200).json({ vXPayload: encrypt(qData.choices[0].message.content) });
            }
        }

        return res.status(200).json({ vXPayload: encrypt("⚠️ حالياً جميع المحركات مشغولة، ثوانٍ وجرب.") });

    } catch (err) {
        // حماية من الـ 500 اللعينة
        return res.status(200).json({ vXPayload: encrypt("🚨 حدث خطأ غير متوقع: " + err.message) });
    }
};
