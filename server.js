```javascript
import express from "express";
import fetch from "node-fetch";
import sqlite3 from "sqlite3";
import 'dotenv/config';

const app = express();
app.use(express.json());
app.use(express.static("public"));

// ===== CONFIG =====
const GEMINI_KEY = process.env.AIzaSyBwBeBoTpOWnwW5KLwmfwQDf_W5BEQA3Ws;
const OPENAI_KEY = process.env.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;

// ===== DATABASE =====
const db = new sqlite3.Database("memory.db");

db.run(`
CREATE TABLE IF NOT EXISTS memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT,
  text TEXT
)
`);

// ===== USER PROFILE =====
let userProfile = {
  name: null
};

// ===== WAKE WORD =====
function isWakeWord(text) {
  return text.toLowerCase().includes("halo robot");
}

// ===== EMOTION DETECTOR =====
function detectEmotion(text) {
  text = text.toLowerCase();

  if (text.includes("sedih")) return "sad";
  if (text.includes("marah")) return "angry";
  if (text.includes("senang")) return "happy";

  return "neutral";
}

// ===== UPDATE MEMORY (PROFILE) =====
function updateProfile(text) {
  if (text.toLowerCase().includes("nama aku")) {
    const name = text.split("nama aku")[1]?.trim();
    if (name) userProfile.name = name;
  }
}

// ===== BUILD CONTEXT =====
function buildContext(rows) {
  return rows.map(r => `${r.role}: ${r.text}`).join("\n");
}

// ===== CHAT ENDPOINT =====
app.post("/chat", async (req, res) => {
  try {
    const userText = req.body.text || "";

    updateProfile(userText);

    // simpan user ke DB
    db.run("INSERT INTO memory (role, text) VALUES (?, ?)", ["user", userText]);

    db.all("SELECT * FROM memory ORDER BY id DESC LIMIT 10", async (err, rows) => {

      if (err) {
        return res.json({ reply: "Database error 😅" });
      }

      const context = buildContext(rows.reverse());
      const emotion = detectEmotion(userText);

      const systemPrompt = `
Kamu adalah robot AI bernama Zio.

Kepribadian:
- santai
- ramah
- sedikit humor
- tidak kaku

User:
Nama: ${userProfile.name || "belum diketahui"}

Emosi saat ini: ${emotion}

Riwayat percakapan:
${context}

Balas dengan:
- singkat
- natural
- enak didengar
- seperti teman ngobrol
`;

      // ===== GEMINI =====
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: systemPrompt }]
              }
            ]
          })
        }
      );

      const data = await response.json();

      const reply =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "hmm aku kurang ngerti 😅";

      // simpan AI ke DB
      db.run("INSERT INTO memory (role, text) VALUES (?, ?)", ["ai", reply]);

      res.json({ reply, emotion });
    });

  } catch (err) {
    res.json({ reply: "error server 😅" });
  }
});

// ===== TTS (VOICE) =====
app.post("/tts", async (req, res) => {
  try {
    const text = req.body.text || "";
    const emotion = req.body.emotion || "neutral";

    let voice = "nova"; // default cewek natural

    if (emotion === "sad") voice = "alloy";
    if (emotion === "angry") voice = "onyx";

    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: voice,
        input: text
      })
    });

    const buffer = await ttsRes.arrayBuffer();

    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(buffer));

  } catch (err) {
    res.status(500).send("TTS error");
  }
});

// ===== TEST ROUTE =====
app.get("/ping", (req, res) => {
  res.send("AI Robot Server aktif 🚀");
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔥 Server jalan di port ${PORT}`);
});
```
