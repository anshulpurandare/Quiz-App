const { OpenAI } = require('openai');

// Initialize the OpenAI-compatible client configured to use the Hugging Face inference router.
// Make sure your environment variable HF_TOKEN contains your Hugging Face API key.
const huggingface = new OpenAI({
  apiKey: process.env.HF_TOKEN,
  baseURL: 'https://router.huggingface.co/v1',
});


/**
 * Extracts a JSON array from raw AI text response.
 * Handles occasional markdown or extra text by extracting the first JSON array found.
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
 * Extracts a JSON object from raw AI text response.
 * Similar to extractJson but looking for a single object.
 * @param {string} text - Raw string returned by the AI.
 * @returns {object | null} - Parsed single question object or null if parsing fails.
 */
function extractSingleJson(text) {
  if (!text) return null;
  const jsonRegex = /\{[\s\S]*\}/; // Matches JSON object
  const match = text.match(jsonRegex);

  if (!match) {
    console.error("aiService: No JSON object found in the AI text.");
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
    console.error("aiService: Failed to parse single JSON object:", error);
    return null;
  }
}

/**
 * Builds the standardized instruction prompt for quiz generation.
 * @param {object} params - The quiz parameters { topic, subtopics, difficulty, numQuestions }.
 * @returns {string} The fully constructed prompt.
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

/**
 * Builds a prompt for generating a single quiz question to replace an existing one.
 * @param {object} params - Original quiz parameters.
 * @param {number} questionIndex - Index of the question for context.
 * @returns {string} The prompt text.
 */
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

/**
 * Attempts to generate a quiz from multiple models in prioritized order.
 * @param {object} params - Quiz generation parameters.
 * @returns {Promise<object[]>} - Promise resolving to quiz data array.
 */
async function generateQuiz(params) {
  const prompt = buildPrompt(params);

  // List of models to try in order of preference
  const modelsToTry = [
    'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
    'zai-org/GLM-4.5:novita',
    'google/gemma-7b-it',
    'Open-Orca/Mistral-7B-OpenOrca'
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    console.log(`--- Attempting quiz generation with model: ${model} ---`);
    try {
      const response = await huggingface.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
      });

      const rawContent = response.choices[0].message.content;
      console.log(`--- Raw AI Response from ${model} ---`, rawContent);
      const quizData = extractJson(rawContent);

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

/**
 * Attempts to generate a single quiz question from multiple models.
 * @param {object} params - Quiz generation parameters.
 * @param {number} questionIndex - Index of question to replace.
 * @returns {Promise<object>} - Promise resolving to a single quiz question object.
 */
async function generateSingleQuestion(params, questionIndex) {
  const prompt = buildSingleQuestionPrompt(params, questionIndex);

  // Same model fallback list as full quiz generation
  const modelsToTry = [
    'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
    'zai-org/GLM-4.5:novita',
    'google/gemma-7b-it',
    'Open-Orca/Mistral-7B-OpenOrca'
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    console.log(`--- Attempting single question generation with model: ${model} ---`);
    try {
      const response = await huggingface.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8, // Slightly increased temperature for diversity
        max_tokens: 1024,
      });

      const rawContent = response.choices[0].message.content;
      console.log(`--- Raw AI Response for single question from ${model} ---`, rawContent);
      const questionObject = extractSingleJson(rawContent);

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
