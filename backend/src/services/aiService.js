const { OpenAI } = require('openai');

const huggingface = new OpenAI({
  apiKey: process.env.HF_TOKEN,
  baseURL: 'https://router.huggingface.co/v1',
});


function extractJson(text) {
  if (!text) return null;

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


function extractSingleJson(text) {
  if (!text) return null;
  const jsonRegex = /\{[\s\S]*\}/;
  const match = text.match(jsonRegex);

  if (!match) {
    console.error("aiService: No JSON object found in the AI text.");
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


async function generateQuiz(params) {
  const prompt = buildPrompt(params);

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
    console.log(`--- Attempting single question generation with model: ${model} ---`);
    try {
      const response = await huggingface.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
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
