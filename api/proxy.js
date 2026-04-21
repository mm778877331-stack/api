const crypto = require("crypto");
const fetch = require("node-fetch");

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

    try {
        const googleKeys = Object.keys(process.env).filter(k => k.startsWith("GEMINI_")).map(k => process.env[k]);
        const groqKey = process.env.GROQ_KEY;

        let rawPrompt = req.body.vXRequest || req.body.prompt;
        let decryptedPrompt = decrypt(rawPrompt);
         const today = new Date().toLocaleDateString( 'ar-YE' , { year:  'numeric' , month:  'long' , day:  'numeric' , weekday:  'long'  });

        // --- محاولة مع Google ---
        if (googleKeys.length > 0) {
            const currentKey = googleKeys[globalIndex % googleKeys.length];
            globalIndex++;

            const gResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${currentKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: Today is ${today}. Search the web and answer: ${decryptedPrompt} }] }],
                    // الطريقة الأكثر استقراراً في Vercel حالياً
                    tools: [{ google_search_retrieval: {} }] 
                })
            });

            const gData = await gResponse.json();
            
            // لو الـ Search سبب مشكلة، بنحاول مرة ثانية "بدون بحث" عشان المستخدم ما يشوف رسالة "مشغول"
            if (!gResponse.ok || !gData.candidates) {
                const retryRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${currentKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: `Today is ${today}. (Search failed, use memory): ${decryptedPrompt}` }] }]
                    })
                });
                const retryData = await retryRes.json();
                if (retryRes.ok && retryData.candidates) {
                    return res.status(200).json({ vXPayload: encrypt(retryData.candidates[0].content.parts[0].text) });
                }
            } else {
                return res.status(200).json({ vXPayload: encrypt(gData.candidates[0].content.parts[0].text) });
            }
        }

        // --- البديل الصلب (Groq) ---
        if (groqKey) {
            const qResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: decryptedPrompt }]
                })
            });
            const qData = await qResponse.json();
            if (qResponse.ok) return res.status(200).json({ vXPayload: encrypt(qData.choices[0].message.content) });
        }

        return res.status(200).json({ vXPayload: encrypt("⚠️ المحرك تحت الصيانة، حاول ثانية.") });

    } catch (err) {
        return res.status(200).json({ vXPayload: encrypt("🚨 خطأ: " + err.message) });
    }
};
