require('dotenv').config();
const axios = require('axios');

// Utility functions for extracting expected JSON from raw LLM output
function extractJson(text) {
  if (!text) return null;
  const jsonRegex = /\[[\s\S]*\]/;
  const match = text.match(jsonRegex);
  if (!match) {
    console.error("aiService: No JSON array found in AI response.");
    return null;
  }
  try {
    return JSON.parse(match[0]);
  } catch (error) {
    console.error("aiService: Failed to parse JSON from AI response:", error);
    return null;
  }
}

function extractSingleJson(text) {
  if (!text) return null;
  const jsonRegex = /\{[\s\S]*\}/;
  const match = text.match(jsonRegex);
  if (!match) {
    console.error("aiService: No JSON object found in AI text.");
    return null;
  }
  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.question && parsed.options && parsed.correctAnswer) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.error("aiService: Failed to parse single JSON object:", error);
    return null;
  }
}

// Prompt builder utilities
function buildPrompt(params) {
  const { topic, subtopics, difficulty, numQuestions } = params;
  return `
You are an expert quiz-generating AI. Your task is to create a quiz based on the following specifications.

**Topic:** "${topic}"
**Subtopics:** ${subtopics.join(', ')}
**Difficulty:** ${difficulty}
**Number of Questions:** ${numQuestions}

**Instructions:**
1. Generate a valid JSON array containing exactly ${numQuestions} multiple-choice question objects.
2. Your entire response MUST BE ONLY the JSON array. Do not include any other text, explanations, or markdown formatting.
3. Each JSON object must have these exact keys: "question", "options", "correctAnswer", and "explanation".
4. You must verify that the value of the "correctAnswer" key is identical to one of the strings in the "options" array.

**Example of one question object in the final array:**

{
  "question": "What is the capital of France?",
  "options": ["London", "Berlin", "Paris", "Madrid"],
  "correctAnswer": "Paris",
  "explanation": "Paris is the capital and most populous city of France."
}

Now, generate the quiz based on these rules.
`.trim();
}

function buildSingleQuestionPrompt(params, questionIndex) {
  const { topic, subtopics, difficulty } = params;
  return `
You are an expert quiz-generating AI. Your task is to create exactly ONE high-quality multiple-choice question to replace question number ${questionIndex + 1} in an existing quiz.

**Topic:** "${topic}"
**Subtopics:** ${subtopics.join(', ')}
**Difficulty:** ${difficulty}

**Instructions:**
1. Generate a single, valid JSON object. Your entire response MUST be only this JSON object.
2. The JSON object must have these exact keys: "question", "options", "correctAnswer", and "explanation".
3. The value for "correctAnswer" MUST be one of the strings in the "options" array.

Now, generate the single best replacement question you can based on these rules.
`.trim();
}

// Main function to call Groq API with OpenAI Chat-compatible interface
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
      console.error("Groq API response data:", response.data);
      throw new Error("No choices returned from Groq API");
    }
    return choices[0].message.content;
  } catch (err) {
    if (err.response && err.response.data) {
      console.error("Groq API HTTP error:", err.response.status, err.response.data);
      throw new Error(`Groq API HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`);
    }
    console.error("Error calling Groq API:", err.message);
    throw err;
  }
}

// Model fallback logic (select your preferred new Groq models here)
const modelsToTry = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "deepseek-r1-distill-llama-70b",
  "llama-3.3-70b-versatile",
  "gemma2-9b-it"
];

// Quiz generator: tries all models in sequence
async function generateQuiz(params) {
  const prompt = buildPrompt(params);
  let lastError = null;
  for (const model of modelsToTry) {
    console.log(`--- Attempting quiz generation with model: ${model} ---`);
    try {
      const aiText = await callGroqAPI(
        model,
        [{ role: "user", content: prompt }],
        2048
      );
      console.log(`--- Raw AI Response from ${model} ---`, aiText);
      const quizData = extractJson(aiText);
      if (quizData && quizData.length > 0) {
        console.log(`+++ Quiz generation successful with ${model} +++`);
        return quizData;
      }
      lastError = new Error(`Model ${model} returned invalid or empty quiz.`);
    } catch (error) {
      console.error(`!!! Quiz generation failed with model ${model}. Error:`, error.message);
      lastError = error;
    }
  }
  console.error("All models failed. Throwing last error.");
  throw new Error(`Failed to generate quiz after trying all models. Last error: ${lastError.message}`);
}

// Single question generator
async function generateSingleQuestion(params, questionIndex) {
  const prompt = buildSingleQuestionPrompt(params, questionIndex);
  let lastError = null;
  for (const model of modelsToTry) {
    console.log(`--- Attempting single question generation with model: ${model} ---`);
    try {
      const aiText = await callGroqAPI(
        model,
        [{ role: "user", content: prompt }],
        1024
      );
      console.log(`--- Raw AI Response for single question from ${model} ---`, aiText);
      const questionObject = extractSingleJson(aiText);
      if (questionObject) {
        console.log(`+++ Single question generation successful with ${model} +++`);
        return questionObject;
      }
      lastError = new Error(`Model ${model} returned invalid or empty question.`);
    } catch (error) {
      console.error(`!!! Single question generation failed with model ${model}. Error:`, error.message);
      lastError = error;
    }
  }
  console.error("All models failed to generate a single question.");
  throw new Error(`Failed to generate single question after trying all models. Last error: ${lastError.message}`);
}

module.exports = {
  generateQuiz,
  generateSingleQuestion,
};
