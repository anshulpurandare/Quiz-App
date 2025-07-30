const { OpenAI } = require('openai');

// Initialize the OpenAI client with the Hugging Face endpoint
// Ensure your .env file has HF_TOKEN=your_api_key
const huggingface = new OpenAI({
  apiKey: process.env.HF_TOKEN,
  baseURL: 'https://router.huggingface.co/v1',
});

/**
 * Extracts a JSON array from a raw AI text response.
 * @param {string} text - The raw text response from the AI.
 * @returns {object[] | null} - The parsed JSON array or null if parsing fails.
 */
function extractJson(text) {
  if (!text) return null;
  const jsonRegex = /\[[\s\S]*\]/; // Matches a JSON array within any text
  const match = text.match(jsonRegex);
  if (!match) {
    console.error("aiService: No JSON array found in the text.");
    return null;
  }
  try {
    return JSON.parse(match[0]);
  } catch (error) {
    console.error("aiService: Failed to parse extracted JSON.", error);
    return null;
  }
}

/**
 * Builds the standardized instruction prompt for quiz generation.
 * @param {object} params - The quiz parameters { topic, subtopics, difficulty, numQuestions }.
 * @returns {string} - The fully constructed prompt.
 */
function buildPrompt(params) {
  const { topic, subtopics, difficulty, numQuestions } = params;
  return `
You are an expert quiz-generating AI. Your task is to create a quiz based on the following specifications.

**Topic:** "${topic}"
**Subtopics:** ${subtopics.join(', ')}
**Difficulty:** ${difficulty}
**Number of Questions:** ${numQuestions}

**Instructions:**
1.  Generate a valid JSON array containing exactly ${numQuestions} multiple-choice question objects.
2.  Your entire response MUST BE ONLY the JSON array. Do not include any other text, explanations, or markdown formatting.
3.  Each JSON object must have these exact keys: "question", "options", "correctAnswer", and "explanation".
4.  You must verify that the value of the "correctAnswer" key is identical to one of the strings in the "options" array.

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

/**
 * CORE FUNCTION: Attempts to generate a quiz from multiple models in a prioritized sequence.
 * @param {object} params - The quiz parameters.
 * @returns {Promise<object[]>} - A promise that resolves to the quiz data array.
 */
async function generateQuiz(params) {
  const prompt = buildPrompt(params);

  const modelsToTry = [
    'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO', // Primary choice (proven to work)
    'zai-org/GLM-4.5:novita',                      // First fallback (your new model)
    'google/gemma-7b-it',                          // Second fallback
    'Open-Orca/Mistral-7B-OpenOrca'                // Final fallback
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    console.log(`--- Attempting to generate quiz with model: ${model} ---`);
    try {
      const response = await huggingface.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
      });

      const rawContent = response.choices[0].message.content;
      console.log(`--- Raw AI Response from ${model} ---`, rawContent);
      const quizData = extractJson(rawContent);

      if (quizData && quizData.length > 0) {
        console.log(`+++ Successfully generated quiz with ${model}! +++`);
        return quizData; // Success!
      }

      lastError = new Error(`Model ${model} returned an invalid or empty format.`);
    } catch (error) {
      console.error(`!!! Failed to generate quiz with model ${model}. Error:`, error.message);
      if (error.response) {
        try {
          const errJson = await error.response.json();
          console.error('Full API error response:', errJson);
        } catch (e) {
          console.error('Could not parse full API error response as JSON:', e.message);
        }
      }
      lastError = error; // Store error and continue to the next model
    }
  }

  console.error("All models failed. Throwing the last encountered error.");
  throw new Error(`Failed to generate quiz after trying all available models. Last error: ${lastError.message}`);
}

// --- [NEW] FUNCTIONS FOR SINGLE QUESTION REGENERATION ---

/**
 * Builds a prompt to generate a single quiz question.
 * @param {object} params - The original quiz parameters.
 * @param {number} questionIndex - The index of the question being replaced (for context).
 * @returns {string} - A prompt optimized for single question generation.
 */
function buildSingleQuestionPrompt(params, questionIndex) {
  const { topic, subtopics, difficulty } = params;
  return `
You are an expert quiz-generating AI. Your task is to create exactly ONE high-quality multiple-choice question to replace question number ${questionIndex + 1} in an existing quiz.

**Topic:** "${topic}"
**Subtopics:** ${subtopics.join(', ')}
**Difficulty:** ${difficulty}

**Instructions:**
1.  Generate a single, valid JSON object. Your entire response MUST be only this JSON object.
2.  The JSON object must have these exact keys: "question", "options", "correctAnswer", and "explanation".
3.  The value for "correctAnswer" MUST be one of the strings in the "options" array.

Now, generate the single best replacement question you can based on these rules.
`.trim();
}

/**
 * Extracts a single JSON object from a raw AI text response.
 * @param {string} text - The raw text response from the AI.
 * @returns {object | null} - The parsed JSON object or null.
 */
function extractSingleJson(text) {
    if (!text) return null;
    // Regex to find a JSON object that starts with { and ends with }
    const jsonRegex = /\{[\s\S]*\}/;
    const match = text.match(jsonRegex);

    if (!match) {
        console.error("aiService: No JSON object found in the text.");
        return null;
    }
    try {
        const parsed = JSON.parse(match[0]);
        // Basic validation
        if (parsed.question && parsed.options && parsed.correctAnswer) {
            return parsed;
        }
        return null;
    } catch (error) {
        console.error("aiService: Failed to parse extracted single JSON object.", error);
        return null;
    }
}

/**
 * Generates a single quiz question to replace an existing one.
 * @param {object} params - The original quiz parameters.
 * @param {number} questionIndex - The index of the question to replace.
 * @returns {Promise<object>} - A promise that resolves to the new question object.
 */
async function generateSingleQuestion(params, questionIndex) {
  const prompt = buildSingleQuestionPrompt(params, questionIndex);

  const modelsToTry = [
    'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
    'zai-org/GLM-4.5:novita',
    'google/gemma-7b-it',
    'Open-Orca/Mistral-7B-OpenOrca'
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    console.log(`--- Attempting to generate single question with model: ${model} ---`);
    try {
      const response = await huggingface.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8, // Slightly higher for more variety
        max_tokens: 1024,
      });

      const rawContent = response.choices[0].message.content;
      console.log(`--- Raw AI Response for single question from ${model} ---`, rawContent);
      const questionObject = extractSingleJson(rawContent);

      if (questionObject) {
        console.log(`+++ Successfully generated single question with ${model}! +++`);
        return questionObject;
      }

      lastError = new Error(`Model ${model} returned an invalid or empty format for a single question.`);
    } catch (error) {
      console.error(`!!! Failed to generate single question with model ${model}. Error:`, error.message);
      lastError = error;
    }
  }

  console.error("All models failed for single question generation.");
  throw new Error(`Failed to generate single question after trying all available models. Last error: ${lastError.message}`);
}

// [MODIFIED] Export the new function alongside the existing one.
module.exports = { 
  generateQuiz,
  generateSingleQuestion,
};
