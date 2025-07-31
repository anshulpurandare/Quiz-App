import React, { useState, useEffect } from 'react';
import { socket } from '../../socket';
import QuizReview from '../quiz/QuizReview';
import './HostView.css';
import axios from 'axios';

function HostView({ roomCode, participants }) {
    // ----- PROMPT-BASED (STANDARD) QUIZ GENERATION -----
    const [quizParams, setQuizParams] = useState({
        topic: 'World History',
        subtopics: 'Ancient Rome',
        difficulty: 'medium',
        numQuestions: 5,
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [timerDuration, setTimerDuration] = useState(15);
    const [quizForReview, setQuizForReview] = useState(null);

    // ----- FILE UPLOAD-BASED QUIZ GENERATION -----
    const [file, setFile] = useState(null);
    const [fileQuiz, setFileQuiz] = useState(null);
    const [fileUploadError, setFileUploadError] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [fileQuizParams, setFileQuizParams] = useState({
        topic: '',
        subtopics: '',
        difficulty: 'medium',
        numQuestions: 5,
        timerDuration: 15,
    });

    useEffect(() => {
        const handleQuizData = (data) => {
            setQuizForReview(data);
            setIsGenerating(false);
        };
        const handleError = (error) => {
            alert(`Error: ${error.message}`);
            setIsGenerating(false);
        };

        socket.on('quiz-review-data', handleQuizData);
        socket.on('error', handleError);
        return () => {
            socket.off('quiz-review-data', handleQuizData);
            socket.off('error', handleError);
        };
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setQuizParams(prev => ({ ...prev, [name]: value }));
    };
    const handleGenerateQuiz = (e) => {
        e.preventDefault();
        setIsGenerating(true);
        setQuizForReview(null);
        setFileQuiz(null);
        socket.emit('host-generate-quiz', {
            ...quizParams,
            subtopics: quizParams.subtopics.split(',').map(s => s.trim()),
            numQuestions: Number(quizParams.numQuestions),
            roomCode,
        });
    };
    const handleRegenerateAll = () => {
        setIsGenerating(true);
        setQuizForReview(null);
        setFileQuiz(null);
        socket.emit('host-regenerate-quiz', { roomCode });
    };

    const handleStartQuiz = () => {
        if (fileQuiz) {
            setIsGenerating(true);
            socket.emit('host-uploaded-quiz', {
                roomCode,
                quiz: fileQuiz,
                timerDuration: fileQuizParams.timerDuration
            });
        } else {
            socket.emit('start-quiz', { roomCode, timerDuration });
        }
    };

    const handleFileInputChange = (e) => {
        setFileUploadError('');
        setFileQuiz(null);
        const selected = e.target.files[0];
        if (selected && selected.type === 'application/pdf') {
            setFile(selected);
        } else {
            setFile(null);
            setFileUploadError('Please select a valid PDF file.');
        }
    };
    const handleFileQuizParamChange = (e) => {
        const { name, value } = e.target;
        setFileQuizParams(prev => ({ ...prev, [name]: value }));
    };
    const handleUploadQuizFile = async (e) => {
        e.preventDefault();
        setFileQuiz(null);
        setFileUploadError('');
        if (!file) {
            setFileUploadError('Please select a PDF file.');
            return;
        }
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('pdf', file);
            formData.append('topic', fileQuizParams.topic);
            formData.append('subtopics', fileQuizParams.subtopics);
            formData.append('difficulty', fileQuizParams.difficulty);
            formData.append('numQuestions', fileQuizParams.numQuestions);
            formData.append('timerDuration', fileQuizParams.timerDuration);

            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
            const url = backendUrl.replace(/\/+$/, '') + '/api/upload-quiz';

            const res = await axios.post(url, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const cleanedQuiz = res.data.quiz.map(q => ({
                ...q,
                options: q.options.map(opt =>
                    typeof opt === 'string' ? opt.trim() : opt
                ),
                correctAnswer:
                    typeof q.correctAnswer === 'string'
                        ? q.correctAnswer.trim()
                        : q.correctAnswer,
            }));
            setFileQuiz(cleanedQuiz);
            setFileUploadError('');
        } catch (err) {
            setFileUploadError(
                err.response?.data?.error || 'Quiz generation from file failed.'
            );
        }
        setIsUploading(false);
    };

    // ---- RENDER: Review view ----
    if (quizForReview || fileQuiz) {
        // Only show Regenerate for prompt-based quizzes for now.
        return (
            <QuizReview
                initialQuizData={quizForReview || fileQuiz}
                roomCode={roomCode}
                isHostReview={true}
                onRegenerate={quizForReview ? handleRegenerateAll : undefined}
                onStart={handleStartQuiz}
                // Optionally: show info if fileQuiz and you want to guide about re-upload for regeneration.
            />
        );
    }

    return (
        <div className="host-view">
            <div className="lobby-info">
                <h2>
                    Room Code:{' '}
                    <span className="room-code-display">{roomCode}</span>
                </h2>
                <p>Share this code with participants to join.</p>
                <h3>Participants ({participants.length})</h3>
                <ul>
                    {participants.map(p => (
                        <li key={p.id}>{p.name}</li>
                    ))}
                    {participants.length === 0 && (
                        <li>Waiting for participants...</li>
                    )}
                </ul>
            </div>

            {/* Section for prompt-based AI quiz generation */}
            <div className="quiz-setup">
                <h3>Setup Your Quiz</h3>
                <form onSubmit={handleGenerateQuiz}>
                    <input
                        name="topic"
                        value={quizParams.topic}
                        onChange={handleInputChange}
                        placeholder="Topic"
                    />
                    <input
                        name="subtopics"
                        value={quizParams.subtopics}
                        onChange={handleInputChange}
                        placeholder="Subtopics (comma-separated)"
                    />
                    <select
                        name="difficulty"
                        value={quizParams.difficulty}
                        onChange={handleInputChange}
                    >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                    <input
                        name="numQuestions"
                        type="number"
                        min="1"
                        max="10"
                        value={quizParams.numQuestions}
                        onChange={handleInputChange}
                    />
                    <div className="timer-setup">
                        <label htmlFor="timer">Time per Question (s)</label>
                        <input
                            id="timer"
                            type="number"
                            min="5"
                            max="60"
                            value={timerDuration}
                            onChange={e =>
                                setTimerDuration(Number(e.target.value))
                            }
                        />
                    </div>
                    <button type="submit" disabled={isGenerating}>
                        {isGenerating ? 'Generating...' : 'Generate Quiz'}
                    </button>
                </form>
            </div>

            {/* Section for file PDF quiz generation */}
            <div className="file-quiz-setup">
                <h3>Or Generate Quiz from PDF</h3>
                <form onSubmit={handleUploadQuizFile}>
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileInputChange}
                    />
                    <input
                        name="topic"
                        value={fileQuizParams.topic}
                        onChange={handleFileQuizParamChange}
                        placeholder="Quiz Topic"
                    />
                    <input
                        name="subtopics"
                        value={fileQuizParams.subtopics}
                        onChange={handleFileQuizParamChange}
                        placeholder="Subtopics (comma-separated)"
                    />
                    <select
                        name="difficulty"
                        value={fileQuizParams.difficulty}
                        onChange={handleFileQuizParamChange}
                    >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                    <input
                        name="numQuestions"
                        type="number"
                        min="1"
                        max="10"
                        value={fileQuizParams.numQuestions}
                        onChange={handleFileQuizParamChange}
                        placeholder="Number of Questions"
                    />
                    <input
                        name="timerDuration"
                        type="number"
                        min="5"
                        max="60"
                        value={fileQuizParams.timerDuration}
                        onChange={handleFileQuizParamChange}
                        placeholder="Timer (seconds)"
                    />
                    <button type="submit" disabled={isUploading || !file}>
                        {isUploading ? 'Generating...' : 'Upload & Generate'}
                    </button>
                </form>
                {fileUploadError && (
                    <p className="file-upload-error">{fileUploadError}</p>
                )}
                {/* Optionally preview quiz questions before full review: */}
                {fileQuiz && (
                    <div className="file-quiz-preview">
                        <h4>Quiz Preview:</h4>
                        <ol>
                            {fileQuiz.map((q, i) => (
                                <li key={i}>
                                    <strong>{q.question}</strong>
                                    <ul>
                                        {q.options.map((opt, j) => (
                                            <li key={j}>{opt}</li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ol>
                        <button onClick={handleStartQuiz}>
                            Start Quiz with This Set
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default HostView;
