require('dotenv').config();
const axios = require('axios');

// Updated to your working production Groq models (in order of preference)
const modelsToTry = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.3-70b-versatile",
  "deepseek-r1-distill-llama-70b",
  "gemma2-9b-it"
];

function extractJson(text) {
  if (!text) return null;
  // Try to find a JSON array anywhere
  const jsonRegex = /\[[\s\S]*\]/;
  const match = text.match(jsonRegex);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (error) {
    console.error("aiService: Failed JSON parse:", error);
    return null;
  }
}

function extractSingleJson(text) {
  if (!text) return null;
  const jsonRegex = /\{[\s\S]*\}/;
  const match = text.match(jsonRegex);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.question && parsed.options && parsed.correctAnswer) {
      return parsed;
    }
    return null;
  } catch (error) {
    return null;
  }
}

function buildPrompt(params) {
  const { topic, subtopics, difficulty, numQuestions } = params;
  return `
You are an expert quiz-generating AI. Your task is to create a quiz based on these specifications:

Topic: "${topic}"
Subtopics: ${subtopics.join(', ')}
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
`.trim();
}

function buildSingleQuestionPrompt(params, questionIndex) {
  const { topic, subtopics, difficulty } = params;
  return `
You are an expert quiz-generating AI. Your task is to create exactly ONE high-quality multiple-choice question to replace question number ${questionIndex + 1} in an existing quiz.

Topic: "${topic}"
Subtopics: ${subtopics.join(', ')}
Difficulty: ${difficulty}

Instructions:
1. Generate a single valid JSON object. Your entire response MUST be only this JSON object.
2. It must have "question", "options", "correctAnswer", "explanation" keys.
3. "correctAnswer" MUST be one of the "options".
4. For the "correctAnswer" field, do NOT use a letter such as "A", "B", "C", or "D". The value MUST be the full, exact answer string from the "options" array (e.g., "A marketplace and civic center for public gatherings").

Now, generate the single best replacement question.
`.trim();
}

async function callGroqAPI(model, messages, maxTokens) {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions?wait_for_completion=true",
      {
        model,
        messages,
        max_tokens: maxTokens
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );
    const choices = response.data.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new Error("No choices returned from Groq API");
    }
    return choices[0].message.content;
  } catch (err) {
    throw err;
  }
}

async function generateQuiz(params) {
  const prompt = buildPrompt(params);
  let lastError = null;
  for (const model of modelsToTry) {
    try {
      const aiText = await callGroqAPI(
        model,
        [{ role: "user", content: prompt }],
        2048
      );
      const quizData = extractJson(aiText);
      if (quizData && quizData.length > 0) {
        return quizData;
      }
      lastError = new Error(`Model ${model} returned invalid or empty quiz.`);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Failed to generate quiz after trying all models. Last error: ${lastError.message}`);
}

async function generateSingleQuestion(params, questionIndex) {
  const prompt = buildSingleQuestionPrompt(params, questionIndex);
  let lastError = null;
  for (const model of modelsToTry) {
    try {
      const aiText = await callGroqAPI(
        model,
        [{ role: "user", content: prompt }],
        1024
      );
      const questionObj = extractSingleJson(aiText);
      if (questionObj) {
        return questionObj;
      }
      lastError = new Error(`Model ${model} returned invalid or empty question.`);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Failed to generate single question after all models. Last error: ${lastError.message}`);
}

module.exports = {
  generateQuiz,
  generateSingleQuestion,
};
