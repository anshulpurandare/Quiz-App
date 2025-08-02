const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const axios = require("axios");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function splitTextIntoChunks(text, chunkSize = 4000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function extractJson(text) {
  if (!text) return null;
  text = text.replace(/``````/g, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) return null;
  const jsonStr = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("extractJson parse failed on:", jsonStr, err);
    return null;
  }
}

function isValidQuestionObj(q) {
  return (q &&
    typeof q.question === "string" && q.question.length > 0 &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    typeof q.correctAnswer === "string" &&
    q.options.includes(q.correctAnswer) &&
    typeof q.explanation === "string"
  );
}

router.post("/", upload.single("pdf"), async (req, res) => {
  if (!req.file || !(req.file.buffer instanceof Buffer)) {
    return res.status(400).json({ error: "No PDF file uploaded or invalid buffer." });
  }
  const {
    topic = "Uploaded Document",
    subtopics = "General Knowledge",
    difficulty = "Medium",
    numQuestions = 5,
    timerDuration = 15
  } = req.body;

  let subtopicsArray = Array.isArray(subtopics)
    ? subtopics
    : typeof subtopics === "string"
      ? subtopics.split(",").map(s => s.trim()).filter(Boolean)
      : ["General Knowledge"];

  try {
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text?.trim();

    if (!text || text.length < 100) {
      return res.status(400).json({ error: "Extracted PDF text is empty or too short." });
    }

    const chunks = splitTextIntoChunks(text, 4000);
    const firstChunk = chunks[0] || "";

    const prompt = `
You are an expert quiz-generating AI. Your task is to create a quiz based on these specifications:

Topic: "${topic}"
Subtopics: ${subtopicsArray.join(', ')}
Difficulty: ${difficulty}
Number of Questions: ${numQuestions}

Instructions:
1. Generate a valid JSON array containing exactly ${numQuestions} multiple-choice question objects.
2. Your entire response MUST BE ONLY the JSON array. No extra text, explanation, or markdown.
3. Each question object must have "question", "options", "correctAnswer", "explanation" keys.
4. For the "correctAnswer" field, do NOT use a letter such as "A", "B", "C", or "D". The value MUST be the full, exact answer string from the "options" array (e.g., "A marketplace and civic center for public gatherings").
Example:
[
  {
    "question": "What is the capital of France?",
    "options": ["London", "Berlin", "Paris", "Madrid"],
    "correctAnswer": "Paris",
    "explanation": "Paris is the capital of France."
  }
]
Now, generate the quiz.

Based ONLY on the following text:
${firstChunk}
`.trim();
    const groqRes = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions?wait_for_completion=true",
      {
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          { role: "system", content: "You are a helpful assistant and expert quiz creator." },
          { role: "user", content: prompt }
        ],
        max_tokens: 2048,
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000
      }
    );

    const aiRaw = groqRes.data.choices?.[0]?.message?.content;
    const quizArr = extractJson(aiRaw);

    if (Array.isArray(quizArr)) {
      quizArr.forEach(q => {
        if (Array.isArray(q.options))
          q.options = q.options.map(opt => typeof opt === "string" ? opt.trim() : opt);
        if (typeof q.correctAnswer === "string")
          q.correctAnswer = q.correctAnswer.trim();
      });
    }

    if (!Array.isArray(quizArr) || quizArr.length < 1) {
      return res.status(400).json({ error: "AI did not return a valid set of quiz questions." });
    }

    for (const q of quizArr) {
      if (!isValidQuestionObj(q)) {
        console.error("Invalid question detected:", q);
        return res.status(400).json({ error: "At least one AI-generated question is improperly formatted." });
      }
    }

    res.json({quiz: quizArr, timerDuration: Number(timerDuration) });

  } catch (error) {
    console.error("UploadQuiz error:", error.message, error.stack);
    res.status(500).json({ error: error.message || "Failed to generate quiz from PDF." });
  }
});

module.exports = router;
