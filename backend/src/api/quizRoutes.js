const express = require('express');
const { generateQuiz } = require('../services/aiService'); // Import the service
const router = express.Router();

// This route handles POST requests to /quiz
router.post('/quiz', async (req, res) => {
    console.log("Received request on /quiz endpoint.");
    try {
        const quizData = await generateQuiz(req.body);
        res.json({ quiz: quizData });
    } catch (error) {
        console.error('API /quiz Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
