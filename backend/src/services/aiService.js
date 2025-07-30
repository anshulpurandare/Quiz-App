const { OpenAI } = require('openai');

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
  "explanation": "Paris is the capital and most populous city of France, located in the north-central part of the country."
}

Now, generate the quiz based on these rules.
`.trim();

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

module.exports = { generateQuiz };
