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
=======
// Initialize the OpenAI-compatible client configured to use the Hugging Face inference router
const client = new OpenAI({
  baseURL: 'https://router.huggingface.co/v1',  // Hugging Face API router endpoint
  apiKey: process.env.HF_TOKEN,                  // Your Hugging Face API token (env var)
});

/**
 * Extracts a JSON array from raw AI model response text.
 * Handles occasional markdown or extraneous text by extracting the first JSON array it finds.
 * @param {string} text - Raw string returned by the AI.
 * @returns {object[] | null} - Parsed array of quiz question objects or null if parsing fails.
 */
function extractJson(text) {
  if (!text) return null;

  // Regex to extract the first JSON array found in the text
  const jsonRegex = /\[[\s\S]*\]/;
  const match = text.match(jsonRegex);

  if (!match) {
    console.error("aiService: No JSON array found in the AI response.");
    return null;
  }

  try {
    return JSON.parse(match[0]);
  } catch (error) {
    console.error("aiService: Failed to parse JSON from AI response:", error);
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
=======
 * Generates a quiz by calling the Hugging Face model with a carefully designed prompt.
 * The prompt enforces strict JSON output formatting rules and content checks.
 * 
 * @param {object} params - Quiz generation parameters:
 *   - topic {string} - Main quiz topic
 *   - subtopics {string[]} - Subtopics to focus on
 *   - difficulty {string} - Difficulty of questions (e.g. "Easy", "Medium", "Hard")
 *   - numQuestions {number} - Number of questions to generate
 * 
 * @returns {Promise<object[]>} - Promise resolving to an array of quiz questions, each containing:
 *   - question {string}
 *   - options {string[]}
 *   - correctAnswer {string}
 *   - explanation {string}
 */
async function generateQuiz(params) {
  const { topic, subtopics, difficulty, numQuestions } = params;

  const prompt = `
You are a helpful AI assistant that creates educational quizzes. Your task is to generate exactly ${numQuestions} high-quality multiple-choice questions on the topic "${topic}", focusing on these subtopics: ${subtopics.join(', ')}. The difficulty level should be ${difficulty}.

**Output Format Rules:**
1. Your entire response MUST be a single, valid JSON array.
2. Do NOT include any introductory text, explanations, or markdown formatting like \`\`\`json outside of the JSON array itself.
3. Each object in the array must have these exact keys: "question", "options", "correctAnswer", and "explanation".

**Content Verification Rules:**
1. **Factual Accuracy:** Ensure all questions, options, and explanations are factually correct.
2. **Answer Integrity:** For each question object, you MUST verify that the value of the "correctAnswer" key is IDENTICAL to one of the strings in the "options" array.

**Example of a single question object in the final array:**

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
=======

  // Request chat completion from the selected Hugging Face model
  const response = await client.chat.completions.create({
    model: 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',  // Chosen stable and supported model
    messages: [{ role: 'user', content: prompt }],          // User role message with prompt
    temperature: 0.7,                                       // Creativity level (adjust as needed)
    max_tokens: 2048,                                       // Max token length to support large quizzes
  });

  // Extract chat message content from response
  const rawContent = response.choices[0].message.content;
  console.log("--- Raw AI Response ---\n", rawContent);

  // Extract and parse JSON quiz data from the raw content
  const quizData = extractJson(rawContent);

  if (!quizData) {
    throw new Error("The AI model did not return a valid quiz format. Please try again.");
  }

  return quizData;
}

// [MODIFIED] Export the new function alongside the existing one.
module.exports = { 
  generateQuiz,
  generateSingleQuestion,
};
