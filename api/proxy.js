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

        const isImageReq = /صمم|ارسم|صورة لـ|image for|draw|generate image/i.test(decryptedPrompt);

        // --- محاولة مع Google أولاً (تدعم البحث والرسم) ---
        if (googleKeys.length > 0) {
            const currentKey = googleKeys[globalIndex % googleKeys.length];
            globalIndex++;

            let finalPrompt = isImageReq 
                ? `Act as an expert Image Prompt Engineer. Create a highly detailed, cinematic, 8k professional drawing prompt in ENGLISH for: "${decryptedPrompt}". Respond ONLY with the description.`
                : `Today is ${today}. Answer: ${decryptedPrompt}`;

            try {
                const gResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${currentKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                       contents: [{ 
                           role: "user", 
                           parts: [{ text: finalPrompt }] 
                       }],
                         tools: [{
                           // هذا هو المسمى الصحيح والوحيد لتفعيل البحث في REST API
                            google_search_retrieval: {
                                dynamic_retrieval_config: {
                                    mode: "MODE_DYNAMIC",
                                    dynamic_threshold: 0.1
                                }
                            } 
                        }
                      ]
                    
                    })
                });

                const gData = await gResponse.json();

                if (gData.candidates && gData.candidates[0].content) {
                    let aiText = gData.candidates[0].content.parts[0].text.trim();

                    if (isImageReq) {
                        const encodedPrompt = encodeURIComponent(aiText);
                        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&model=flux`;
                        return res.status(200).json({ vXPayload: encrypt(`VX_IMAGE_URL: ${imageUrl}`) });
                    }
                    return res.status(200).json({ vXPayload: encrypt(aiText) });
                }
            } catch (gErr) {
                console.error("Google failed, moving to Groq...");
            }
        }

        // --- البديل الصلب (Groq) لو فشل جوجل أو لم يوجد مفاتيح ---
        if (groqKey) {
            const qResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {

                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${groqKey}`,
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: decryptedPrompt }]
                })
            });

            const qData = await qResponse.json();
            if (qData.choices && qData.choices[0].message) {
                let qText = qData.choices[0].message.content;
                
                // حتى البديل الصلب نخليه يدعم الرسم لو طلب المستخدم
                if (isImageReq) {
                    const encodedPrompt = encodeURIComponent(qText);
                    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&model=flux`;
                    return res.status(200).json({ vXPayload: encrypt(`VX_IMAGE_URL: ${imageUrl}`) });
                }
                return res.status(200).json({ vXPayload: encrypt(qText) });
            }
        }

        return res.status(200).json({ vXPayload: encrypt("⚠️ المحركات تحت الصيانة، حاول لاحقاً.") });

    } catch (err) {
        return res.status(200).json({ vXPayload: encrypt("🚨 خطأ تقني: " + err.message) });
    }
};
