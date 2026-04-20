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

    // جيش مفاتيح جوجل
    const googleKeys = Object.keys(process.env)
        .filter(key => key.startsWith("GEMINI_"))
        .map(key => process.env[key]);

    // مفتاح Groq (الاحتياطي الاستراتيجي)
    const groqKey = process.env.GROQ_KEY;

    let rawPrompt = req.body.vXRequest || req.body.prompt;
    let decryptedPrompt = decrypt(rawPrompt);
    
    const needsSearch = /سعر|أخبار|مباراة|نتيجة|رابط|تحميل|بحث|news|search/i.test(decryptedPrompt);

    // --- المحاولة الأولى: جيش جوجل (لأن فيه ميزة البحث) ---
    if (googleKeys.length > 0) {
        let attempts = 0;
        while (attempts < Math.min(googleKeys.length, 3)) { // جرب أول 3 مفاتيح متاحة
            const currentKey = googleKeys[globalIndex % googleKeys.length];
            globalIndex++;
            attempts++;

            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${currentKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: decryptedPrompt }] }],
                        tools: needsSearch ? [{ google_search_retrieval: {} }] : []
                    })
                });

                const data = await response.json();
                if (response.ok && data.candidates) {
                    return res.status(200).json({ vXPayload: encrypt(data.candidates[0].content.parts[0].text) });
                }
                if (response.status !== 429 && response.status !== 503) break; // لو الخطأ مش زحمة ولا كوتا، اخرج
            } catch (e) { continue; }
        }
    }

    // --- الخطة البديلة: محرك Groq (المنقذ الصامت) ---
    if (groqKey) {
        try {
            const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": Bearer ${groqKey},
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile", // موديل قوي جداً ومجاني حالياً
                    messages: [{ role: "user", content: decryptedPrompt }]
                })
            });

            const groqData = await groqResponse.json();
            if (groqResponse.ok && groqData.choices) {
                let aiText = groqData.choices[0].message.content;
                return res.status(200).json({ vXPayload: encrypt(aiText + "\n\n(تم الرد عبر المحرك الاحتياطي ⚡)") });
            }
        } catch (e) {
            console.error("Groq Error:", e);
        }
    }

..., [21/04/2026 02:50 ص]
res.status(200).json({ vXPayload: encrypt("❌ جميع المحركات مشغولة حالياً، جرب بعد ثوانٍ.") });
};
