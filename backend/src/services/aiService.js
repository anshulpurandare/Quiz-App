const { OpenAI } = require('openai');

// Initialize the client once to be reused
const huggingface = new OpenAI({
  apiKey: process.env.HUGGINGFACE_API_KEY,
  baseURL: 'https://router.huggingface.co/v1',
});

/**
 * Extracts a JSON array from a raw text string from the AI model.
 * @param {string} text - The raw text response from the AI.
 * @returns {object[] | null} - The parsed JSON array or null if parsing fails.
 */
function extractJson(text) {
    if (!text) return null;
    
    // This regex looks for a JSON array that might be wrapped in markdown backticks.
    const jsonRegex = /\[[\s\S]*\]/;
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
 * Generates a quiz by calling the Hugging Face API with a refined, self-correcting prompt.
 * @param {object} params - The quiz parameters { topic, subtopics, difficulty, numQuestions }.
 * @returns {Promise<object[]>} - A promise that resolves to the quiz data array.
 */
async function generateQuiz(params) {
    const { topic, subtopics, difficulty, numQuestions } = params;
    
    // --- REFINED PROMPT WITH SELF-CORRECTION AND EXAMPLE ---
    const prompt = `
You are a helpful AI assistant that creates educational quizzes. Your task is to generate exactly ${numQuestions} high-quality multiple-choice questions on the topic "${topic}", focusing on these subtopics: ${subtopics.join(', ')}. The difficulty level should be ${difficulty}.

**Output Format Rules:**
1.  Your entire response MUST be a single, valid JSON array.
2.  Do NOT include any introductory text, explanations, or markdown formatting like \`\`\`json outside of the JSON array itself.
3.  Each object in the array must have these exact keys: "question", "options", "correctAnswer", and "explanation".

**Content Verification Rules:**
1.  **Factual Accuracy:** Ensure all questions, options, and explanations are factually correct.
2.  **Answer Integrity:** For each question object, you MUST verify that the value of the "correctAnswer" key is IDENTICAL to one of the strings in the "options" array.

**Example of a single question object in the final array:**
{
  "question": "What is the capital of France?",
  "options": ["London", "Berlin", "Paris", "Madrid"],
  "correctAnswer": "Paris",
  "explanation": "Paris is the capital and most populous city of France, located in the north-central part of the country."
}

Now, generate the quiz based on these rules.
`.trim();
    
    const response = await huggingface.chat.completions.create({
        model: 'mistralai/Mistral-7B-Instruct-v0.2',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
    });

    const rawContent = response.choices[0].message.content;
    console.log("--- Raw AI Response ---", rawContent); // Added for easier debugging
    const quizData = extractJson(rawContent);

    if (!quizData) {
        throw new Error("The AI model did not return a valid quiz format. Please try again.");
    }
    return quizData;
}

module.exports = { generateQuiz };
