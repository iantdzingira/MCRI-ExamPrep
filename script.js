// ===== CONFIGURATION =====
let NUM_QUESTIONS_TO_LOAD = 40;
const EXAM_DURATION_MINUTES = 45;
const PASSING_SCORE_PERCENTAGE = 80;

// ===== STATE MANAGEMENT =====
let studentName = '';
let studentId = '';
let examType = 'practice';
let examDurationSeconds = EXAM_DURATION_MINUTES * 60;
let timeLeft = examDurationSeconds;
let timerInterval;

let questions = [];
let examQuestions = [];
let userAnswers = [];
let questionsMarked = [];
let currentQuestionIndex = 0;
let isReviewMode = false;
let reviewQuestions = [];
let currentReviewIndex = 0;
let topicPerformance = {};
let wrongAnswers = [];

// ===== DOM ELEMENTS =====
let welcomeScreen, examContainer, modalContainer;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    welcomeScreen = document.getElementById('welcome-screen');
    examContainer = document.getElementById('exam-container');
    modalContainer = document.getElementById('modal-container');
    
    // Setup form submission
    document.getElementById('exam-registration').addEventListener('submit', startExam);
    
    // Set question count based on selection
    document.getElementById('question-count').addEventListener('change', function() {
        NUM_QUESTIONS_TO_LOAD = parseInt(this.value);
        document.getElementById('total-questions').textContent = NUM_QUESTIONS_TO_LOAD;
    });
    
    // Load default values
    updateWelcomeStats();
});

function updateWelcomeStats() {
    const questionCount = document.getElementById('question-count').value;
    const passingScore = PASSING_SCORE_PERCENTAGE;
    const timeLimit = EXAM_DURATION_MINUTES;
    
    document.getElementById('total-questions').textContent = questionCount;
    document.getElementById('passing-score').textContent = passingScore + '%';
    document.getElementById('time-limit').textContent = timeLimit + ' minutes';
}

// ===== EXAM START =====
async function startExam(event) {
    event.preventDefault();
    
    // Get student information
    studentName = document.getElementById('student-name').value.trim();
    studentId = document.getElementById('student-id').value.trim();
    examType = document.getElementById('exam-type').value;
    NUM_QUESTIONS_TO_LOAD = parseInt(document.getElementById('question-count').value);
    
    if (!studentName) {
        showErrorModal('Please enter your name to continue.', 'Missing Information');
        return;
    }
    
    if (!document.getElementById('agree-terms').checked) {
        showErrorModal('You must agree to the honor code before starting the exam.', 'Terms Agreement Required');
        return;
    }
    
    // Display student info in exam header
    document.getElementById('student-name-display').textContent = studentName;
    document.getElementById('exam-type-display').textContent = examType.replace('-', ' ').toUpperCase();
    document.getElementById('total-questions-display').textContent = NUM_QUESTIONS_TO_LOAD;
    
    // Switch to exam screen
    welcomeScreen.style.display = 'none';
    examContainer.style.display = 'block';
    
    // Start loading the exam
    await loadAndStartExam();
}

// ===== EXAM LOADING =====
async function loadAndStartExam() {
    try {
        showLoadingState();
        
        // Use the raw GitHub URL (this is what works for GitHub Pages)
        const response = await fetch('https://raw.githubusercontent.com/iantdzingira/MCRI-ExamPrep/main/questions.json');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const text = await response.text();
        
        // Check if we got an HTML page instead of JSON (GitHub 404)
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            throw new Error('Received HTML instead of JSON. The questions.json file might not exist.');
        }
        
        // Parse the JSON
        questions = JSON.parse(text);
        
        if (!questions || questions.length === 0) {
            throw new Error('No questions found in the database');
        }
        
        initializeTopicTracking(questions);
        shuffleArray(questions);
        
        // Ensure we don't try to load more questions than available
        const actualQuestionsToLoad = Math.min(NUM_QUESTIONS_TO_LOAD, questions.length);
        examQuestions = questions.slice(0, actualQuestionsToLoad);
        
        // Initialize answer tracking
        userAnswers = Array(examQuestions.length).fill(null);
        questionsMarked = [];
        wrongAnswers = [];
        currentQuestionIndex = 0;
        
        // Update UI
        updateQuestionCountDisplay();
        updateProgressBar();
        updateQuickNavigation();
        
        renderQuestion();
        startTimer();
        
    } catch (error) {
        console.error('Error loading exam:', error);
        showErrorModal(
            `Unable to load exam questions. <br><br>
            <strong>Error:</strong> ${error.message}<br><br>
            <strong>Quick Fix:</strong><br>
            1. Go to <a href="https://raw.githubusercontent.com/iantdzingira/MCRI-ExamPrep/main/questions.json" 
                       target="_blank" style="color: #ff7b00;">this link</a><br>
            2. Make sure it shows JSON content, not a 404 page<br>
            3. If it's a 404, upload your questions.json file to GitHub`,
            'Exam Loading Failed'
        );
    }
}

function showLoadingState() {
    document.getElementById('question-area').innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <h3>Initializing Exam</h3>
            <p>Loading questions and setting up your exam environment...</p>
            <div class="loading-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 70%"></div>
                </div>
            </div>
        </div>
    `;
}

// ===== TOPIC TRACKING =====
function initializeTopicTracking(questions) {
    topicPerformance = {};
    
    const topics = [...new Set(questions.map(q => q.topic || 'Uncategorized'))];
    
    topics.forEach(topic => {
        topicPerformance[topic] = {
            total: 0,
            correct: 0,
            percentage: 0
        };
    });
}

// ===== TIMER FUNCTIONS =====
function startTimer() {
    const timerElement = document.getElementById('timer-value');
    timerElement.textContent = formatTime(timeLeft);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.textContent = formatTime(timeLeft);
        
        // Update timer display based on remaining time
        updateTimerDisplay();
        
        // Check for time expiration
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            showTimeUpModal();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timer-display');
    
    if (timeLeft <= 300) { // 5 minutes
        timerDisplay.style.background = 'rgba(255, 107, 0, 0.3)';
        timerDisplay.classList.add('pulse');
    }
    
    if (timeLeft <= 60) { // 1 minute
        timerDisplay.style.background = 'rgba(255, 59, 0, 0.4)';
        timerDisplay.style.animation = 'pulse 0.5s infinite';
    }
}

function stopTimer() {
    clearInterval(timerInterval);
}

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ===== UTILITY FUNCTIONS =====
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// ===== ANSWER NORMALIZATION =====
function normalizeAnswer(answer) {
    if (!answer) return '';
    
    // Convert to string, trim whitespace, and lowercase
    return answer.toString().trim().toLowerCase();
}

function isAnswerCorrect(question, userAnswer) {
    if (!userAnswer) return false;
    
    switch (question.type) {
        case 'multiple-choice':
            return userAnswer === question.answer;
            
        case 'true-false':
            const normalizedTF = normalizeAnswer(userAnswer);
            const correctTF = normalizeAnswer(question.answer);
            return normalizedTF === correctTF;
            
        case 'fill-in':
        case 'code-analysis':
            const normalizedUser = normalizeAnswer(userAnswer);
            const normalizedCorrect = normalizeAnswer(question.answer);
            
            // Remove punctuation for better matching
            const cleanUser = normalizedUser.replace(/[.,;!?]/g, '').trim();
            const cleanCorrect = normalizedCorrect.replace(/[.,;!?]/g, '').trim();
            
            // Exact match or contains
            if (cleanUser === cleanCorrect) return true;
            
            // For programming terms, be more lenient
            const commonVariations = [
                cleanCorrect,
                cleanCorrect.charAt(0).toUpperCase() + cleanCorrect.slice(1),
                cleanCorrect.toUpperCase()
            ];
            
            return commonVariations.includes(cleanUser) || 
                   cleanUser.includes(cleanCorrect) || 
                   cleanCorrect.includes(cleanUser);
            
        case 'drag-and-drop':
            if (typeof userAnswer !== 'object') return false;
            
            let allCorrect = true;
            question.dropZones.forEach((zone, index) => {
                const zoneId = `zone-${index}`;
                const correctItem = zone.correctItem;
                const droppedItem = userAnswer[zoneId];
                
                if (droppedItem !== correctItem) {
                    allCorrect = false;
                }
            });
            return allCorrect;
            
        default:
            return false;
    }
}

// ===== QUESTION RENDERING =====
function renderQuestion() {
    const questionArea = document.getElementById('question-area');
    
    if (isReviewMode) {
        renderReviewQuestion();
        return;
    }
    
    if (currentQuestionIndex >= examQuestions.length) {
        showReviewSection();
        return;
    }

    const q = examQuestions[currentQuestionIndex];
    let html = `
        <div class="question-content" data-type="${q.type}" data-topic="${q.topic || 'Uncategorized'}">
            <div class="question-header">
                <div class="question-number">
                    <i class="fas fa-question-circle"></i>
                    Question ${currentQuestionIndex + 1} of ${examQuestions.length}
                </div>
                <div class="question-topic">${q.topic || 'General'}</div>
                <div class="question-status ${getQuestionStatus(currentQuestionIndex)}"></div>
            </div>
            <div class="question-text">${q.question}</div>
    `;

    if (q.code) {
        html += `<pre class="code-block"><code>${q.code}</code></pre>`;
    }
    
    if (q.type === 'multiple-choice' || q.type === 'true-false') {
        html += '<form class="question-form">';
        q.options.forEach((option, index) => {
            const checked = userAnswers[currentQuestionIndex] === option ? 'checked' : '';
            html += `
                <label class="option-label">
                    <input type="radio" name="answer" value="${option}" ${checked}>
                    <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                    <span class="option-text">${option}</span>
                </label>
            `;
        });
        html += '</form>';
    } else if (q.type === 'fill-in' || q.type === 'code-analysis') {
        const value = userAnswers[currentQuestionIndex] || '';
        html += `
            <div class="fill-in-container">
                <label for="answer-input">Enter your answer:</label>
                <input type="text" id="answer-input" class="fill-in-input" 
                       placeholder="Type your answer here..." value="${value}">
            </div>
        `;
    } else if (q.type === 'drag-and-drop') {
        html += renderDragDropQuestion(q);
    }
    
    html += `</div>`;
    questionArea.innerHTML = html;
    
    // Setup event listeners
    if (q.type === 'drag-and-drop') {
        setupDragAndDrop();
    }
    
    // Update UI
    updateNavigationButtons();
    updateCurrentQuestionDisplay();
    updateProgressBar();
    updateQuickNavigation();
    highlightCurrentQuestion();
}

function getQuestionStatus(index) {
    if (questionsMarked.includes(index)) return 'status-marked';
    if (userAnswers[index] !== null && 
        userAnswers[index] !== '' && 
        !(typeof userAnswers[index] === 'object' && Object.keys(userAnswers[index]).length === 0)) {
        return 'status-answered';
    }
    return 'status-unanswered';
}

function renderDragDropQuestion(question) {
    let itemsHtml = '';
    let zonesHtml = '';
    
    const currentAnswer = userAnswers[currentQuestionIndex] || {};
    const availableItems = [...question.draggableItems];
    
    // First pass: place items that are already dropped
    question.dropZones.forEach((zone, index) => {
        const droppedItem = currentAnswer[`zone-${index}`];
        const itemHtml = droppedItem ? 
            `<div class="draggable-item" draggable="true" id="drag-${droppedItem}" data-item="${droppedItem}">
                ${droppedItem}
                <span class="drag-hint">Drag</span>
            </div>` : '';
        
        if (droppedItem) {
            const itemIndexInSource = availableItems.indexOf(droppedItem);
            if (itemIndexInSource > -1) {
                availableItems.splice(itemIndexInSource, 1);
            }
        }

        zonesHtml += `
            <div class="drop-zone-wrapper">
                <p><strong>${zone.placeholder}</strong></p>
                <div class="drop-zone" id="zone-${index}" data-correct-item="${zone.correctItem}">
                    ${itemHtml}
                </div>
            </div>
        `;
    });
    
    // Second pass: remaining items in the pool
    availableItems.forEach((item) => {
        itemsHtml += `
            <div class="draggable-item" draggable="true" id="drag-${item}" data-item="${item}">
                ${item}
                <span class="drag-hint">Drag</span>
            </div>
        `;
    });

    return `
        <div class="drag-drop-container">
            <div class="drag-drop-instruction">
                <i class="fas fa-hand-point-up"></i>
                Drag items from the pool below to the correct drop zones
            </div>
            <div class="draggable-items-container">
                ${itemsHtml}
            </div>
            <div class="drop-zones-container">
                ${zonesHtml}
            </div>
        </div>
    `;
}

// ===== DRAG AND DROP =====
function setupDragAndDrop() {
    const draggables = document.querySelectorAll('.draggable-item');
    const dropZones = document.querySelectorAll('.drop-zone');

    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', draggable.dataset.item);
            draggable.classList.add('dragging');
        });

        draggable.addEventListener('dragend', () => {
            draggable.classList.remove('dragging');
            document.querySelectorAll('.drop-zone').forEach(zone => {
                zone.classList.remove('drag-over');
            });
        });
    });

    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            
            const itemData = e.dataTransfer.getData('text/plain');
            const draggedItem = document.getElementById(`drag-${itemData}`);
            
            // Clear the zone if it already has an item
            while (zone.firstChild) {
                zone.removeChild(zone.firstChild);
            }
            
            // Clone and add the dragged item
            const clonedItem = draggedItem.cloneNode(true);
            clonedItem.id = `drag-${itemData}-dropped`;
            zone.appendChild(clonedItem);
            
            // Re-enable dragging for the cloned item
            clonedItem.setAttribute('draggable', 'true');
            clonedItem.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', clonedItem.dataset.item);
                clonedItem.classList.add('dragging');
            });
            
            // Save the answer
            saveAnswer();
            updateQuickNavigation();
        });
    });
}

// ===== ANSWER MANAGEMENT =====
function saveAnswer() {
    const q = examQuestions[currentQuestionIndex];
    let answer = null;
    
    if (q.type === 'multiple-choice' || q.type === 'true-false') {
        const form = document.querySelector('.question-form');
        if (form) {
            const selected = form.querySelector('input[name="answer"]:checked');
            if (selected) {
                answer = selected.value;
            }
        }
    } else if (q.type === 'fill-in' || q.type === 'code-analysis') {
        const input = document.getElementById('answer-input');
        if (input) {
            answer = input.value;
        }
    } else if (q.type === 'drag-and-drop') {
        answer = {};
        const dropZones = document.querySelectorAll('.drop-zone');
        dropZones.forEach(zone => {
            if (zone.children.length > 0) {
                const zoneId = zone.id;
                const droppedItemData = zone.children[0].dataset.item;
                answer[zoneId] = droppedItemData;
            }
        });
    }

    userAnswers[currentQuestionIndex] = answer;
    updateQuestionStatus(currentQuestionIndex);
    updateProgressBar();
}

function updateQuestionStatus(index) {
    const statusElement = document.querySelector('.question-status');
    if (statusElement) {
        statusElement.className = `question-status ${getQuestionStatus(index)}`;
    }
}

// ===== NAVIGATION =====
function nextQuestion() {
    saveAnswer();
    
    if (currentQuestionIndex < examQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        showReviewSection();
    }
}

function previousQuestion() {
    saveAnswer();
    
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

function toggleMark() {
    const index = questionsMarked.indexOf(currentQuestionIndex);
    
    if (index > -1) {
        questionsMarked.splice(index, 1);
        document.getElementById('mark-button').innerHTML = '<i class="far fa-bookmark"></i> Mark for Review';
        document.getElementById('mark-button').classList.remove('marked');
    } else {
        questionsMarked.push(currentQuestionIndex);
        document.getElementById('mark-button').innerHTML = '<i class="fas fa-bookmark"></i> Marked for Review';
        document.getElementById('mark-button').classList.add('marked');
    }
    
    updateQuickNavigation();
    updateQuestionStatus(currentQuestionIndex);
    
    // Visual feedback
    const questionElement = document.querySelector('.question-content');
    questionElement.classList.add('highlight');
    setTimeout(() => {
        questionElement.classList.remove('highlight');
    }, 1000);
}

function updateNavigationButtons() {
    const nextButton = document.getElementById('next-button');
    const prevButton = document.getElementById('previous-button');
    const markButton = document.getElementById('mark-button');
    
    if (isReviewMode) {
        nextButton.innerHTML = currentReviewIndex < reviewQuestions.length - 1 ? 
            'Next Review Question <i class="fas fa-arrow-right"></i>' : 
            'Finish Review <i class="fas fa-check"></i>';
        nextButton.onclick = nextReviewQuestion;
        
        prevButton.style.display = currentReviewIndex === 0 ? 'none' : 'flex';
        prevButton.onclick = previousReviewQuestion;
        
        markButton.innerHTML = '<i class="fas fa-times"></i> Remove from Review';
        markButton.onclick = removeFromReview;
        markButton.classList.add('marked');
    } else {
        nextButton.innerHTML = currentQuestionIndex < examQuestions.length - 1 ? 
            'Next Question <i class="fas fa-arrow-right"></i>' : 
            'Submit Exam <i class="fas fa-paper-plane"></i>';
        nextButton.onclick = nextQuestion;
        
        prevButton.style.display = currentQuestionIndex === 0 ? 'none' : 'flex';
        prevButton.onclick = previousQuestion;
        
        if (questionsMarked.includes(currentQuestionIndex)) {
            markButton.innerHTML = '<i class="fas fa-bookmark"></i> Marked for Review';
            markButton.classList.add('marked');
        } else {
            markButton.innerHTML = '<i class="far fa-bookmark"></i> Mark for Review';
            markButton.classList.remove('marked');
        }
        markButton.onclick = toggleMark;
    }
}

// ===== REVIEW MODE =====
function showReviewSection() {
    saveAnswer();
    isReviewMode = false;
    
    const questionArea = document.getElementById('question-area');
    
    let answeredCount = userAnswers.filter(answer => answer !== null && 
        answer !== '' && 
        !(typeof answer === 'object' && Object.keys(answer).length === 0)).length;
    
    let reviewListHtml = '';
    examQuestions.forEach((q, index) => {
        const isMarked = questionsMarked.includes(index);
        const isAnswered = getQuestionStatus(index) === 'status-answered';
        const answerPreview = getAnswerPreview(q, index);
        
        reviewListHtml += `
            <div class="review-question-item" onclick="jumpToQuestion(${index})">
                <div class="review-question-header">
                    <span class="review-question-number">Question ${index + 1}</span>
                    <span class="review-question-type">${q.type}</span>
                </div>
                <div class="review-question-text">${q.question.substring(0, 120)}${q.question.length > 120 ? '...' : ''}</div>
                <div class="review-question-answer">
                    <strong>Your Answer:</strong> ${answerPreview}
                    ${isMarked ? '<span class="marked-badge">Marked</span>' : ''}
                </div>
            </div>
        `;
    });
    
    questionArea.innerHTML = `
        <div class="review-section">
            <div class="review-header">
                <h2><i class="fas fa-clipboard-check"></i> Exam Review</h2>
                <div class="review-count">${questionsMarked.length} Questions Marked</div>
            </div>
            
            <div class="review-summary">
                <h3><i class="fas fa-chart-bar"></i> Exam Summary</h3>
                <div class="review-stats">
                    <div class="review-stat">
                        <div class="review-stat-value">${examQuestions.length}</div>
                        <div class="review-stat-label">Total Questions</div>
                    </div>
                    <div class="review-stat">
                        <div class="review-stat-value">${answeredCount}</div>
                        <div class="review-stat-label">Answered</div>
                    </div>
                    <div class="review-stat">
                        <div class="review-stat-value">${examQuestions.length - answeredCount}</div>
                        <div class="review-stat-label">Unanswered</div>
                    </div>
                    <div class="review-stat">
                        <div class="review-stat-value">${questionsMarked.length}</div>
                        <div class="review-stat-label">Marked</div>
                    </div>
                </div>
            </div>
            
            <div class="review-questions-list">
                ${reviewListHtml}
            </div>
            
            <div class="review-buttons">
                ${questionsMarked.length > 0 ? `
                    <button class="review-all-button" onclick="startReviewMode()">
                        <i class="fas fa-list-check"></i> Review Marked Questions (${questionsMarked.length})
                    </button>
                ` : ''}
                <button class="skip-review-button" onclick="submitExam()">
                    <i class="fas fa-paper-plane"></i> Submit Exam
                </button>
            </div>
        </div>
    `;
    
    // Update navigation
    document.getElementById('navigation-area').style.display = 'none';
    document.getElementById('quick-nav').style.display = 'none';
}

function getAnswerPreview(question, index) {
    const answer = userAnswers[index];
    
    if (!answer || answer === '' || (typeof answer === 'object' && Object.keys(answer).length === 0)) {
        return '<span class="unanswered">Not answered</span>';
    }
    
    if (question.type === 'multiple-choice' || question.type === 'true-false') {
        return answer;
    } else if (question.type === 'fill-in' || question.type === 'code-analysis') {
        return answer.length > 30 ? answer.substring(0, 30) + '...' : answer;
    } else if (question.type === 'drag-and-drop') {
        const zones = Object.keys(answer).length;
        return `${zones} of ${question.dropZones.length} correct`;
    }
    
    return 'Answered';
}

function jumpToQuestion(index) {
    isReviewMode = false;
    currentQuestionIndex = index;
    
    // Restore navigation
    document.getElementById('navigation-area').style.display = 'flex';
    document.getElementById('quick-nav').style.display = 'block';
    
    renderQuestion();
}

function startReviewMode() {
    if (questionsMarked.length === 0) {
        showInfoModal('No questions have been marked for review.', 'No Marked Questions');
        return;
    }
    
    isReviewMode = true;
    reviewQuestions = [...questionsMarked];
    currentReviewIndex = 0;
    currentQuestionIndex = reviewQuestions[currentReviewIndex];
    
    renderQuestion();
}

function renderReviewQuestion() {
    const q = examQuestions[currentQuestionIndex];
    const questionArea = document.getElementById('question-area');
    
    questionArea.innerHTML = `
        <div class="review-mode">
            <div class="question-content" data-type="${q.type}" data-topic="${q.topic || 'Uncategorized'}">
                <div class="review-header" style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <h2><i class="fas fa-search"></i> Review Mode</h2>
                        <button onclick="exitReviewMode()" style="background: #e0e0e0; color: #666; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-sign-out-alt"></i> Exit Review
                        </button>
                    </div>
                    <div class="review-count">${currentReviewIndex + 1} of ${reviewQuestions.length}</div>
                </div>
                
                <div class="review-progress">
                    <div class="review-progress-bar">
                        <div class="review-progress-fill" style="width: ${((currentReviewIndex + 1) / reviewQuestions.length) * 100}%"></div>
                    </div>
                    <div class="review-progress-text">
                        <span>Question ${currentQuestionIndex + 1} of ${examQuestions.length}</span>
                        <span>${currentReviewIndex + 1}/${reviewQuestions.length} in review</span>
                    </div>
                </div>
                
                <div class="question-header">
                    <div class="question-number">
                        <i class="fas fa-question-circle"></i>
                        Question ${currentQuestionIndex + 1}
                    </div>
                    <div class="question-topic">${q.topic || 'General'}</div>
                </div>
                <div class="question-text">${q.question}</div>
                
                ${q.code ? `<pre class="code-block"><code>${q.code}</code></pre>` : ''}
                
                ${renderAnswerInput(q)}
            </div>
        </div>
    `;
    
    if (q.type === 'drag-and-drop') {
        setupDragAndDrop();
    }
    
    updateNavigationButtons();
}

function renderAnswerInput(question) {
    const userAnswer = userAnswers[currentQuestionIndex];
    
    if (question.type === 'multiple-choice' || question.type === 'true-false') {
        let html = '<form class="question-form">';
        question.options.forEach((option, index) => {
            const checked = userAnswer === option ? 'checked' : '';
            html += `
                <label class="option-label">
                    <input type="radio" name="answer" value="${option}" ${checked}>
                    <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                    <span class="option-text">${option}</span>
                </label>
            `;
        });
        html += '</form>';
        return html;
    } else if (question.type === 'fill-in' || question.type === 'code-analysis') {
        return `
            <div class="fill-in-container">
                <label for="answer-input">Enter your answer:</label>
                <input type="text" id="answer-input" class="fill-in-input" 
                       placeholder="Type your answer here..." value="${userAnswer || ''}">
            </div>
        `;
    } else if (question.type === 'drag-and-drop') {
        return renderDragDropQuestion(question);
    }
    
    return '';
}

function nextReviewQuestion() {
    saveAnswer();
    
    if (currentReviewIndex < reviewQuestions.length - 1) {
        currentReviewIndex++;
        currentQuestionIndex = reviewQuestions[currentReviewIndex];
        renderReviewQuestion();
    } else {
        finishReview();
    }
}

function previousReviewQuestion() {
    saveAnswer();
    
    if (currentReviewIndex > 0) {
        currentReviewIndex--;
        currentQuestionIndex = reviewQuestions[currentReviewIndex];
        renderReviewQuestion();
    }
}

function removeFromReview() {
    const index = questionsMarked.indexOf(currentQuestionIndex);
    if (index > -1) {
        questionsMarked.splice(index, 1);
    }
    
    const reviewIndex = reviewQuestions.indexOf(currentQuestionIndex);
    if (reviewIndex > -1) {
        reviewQuestions.splice(reviewIndex, 1);
    }
    
    if (reviewQuestions.length === 0) {
        finishReview();
    } else {
        if (currentReviewIndex >= reviewQuestions.length) {
            currentReviewIndex = reviewQuestions.length - 1;
        }
        currentQuestionIndex = reviewQuestions[currentReviewIndex];
        renderReviewQuestion();
    }
    
    updateQuickNavigation();
}

function exitReviewMode() {
    if (confirm('Exit review mode and return to the exam summary?')) {
        finishReview();
    }
}

function finishReview() {
    isReviewMode = false;
    showReviewSection();
}

// ===== QUICK NAVIGATION =====
function updateQuickNavigation() {
    const questionGrid = document.getElementById('question-grid');
    const answeredCount = document.querySelector('.answered-count');
    const markedCount = document.querySelector('.marked-count');
    
    let answered = 0;
    let marked = 0;
    let html = '';
    
    examQuestions.forEach((_, index) => {
        const status = getQuestionStatus(index);
        const isCurrent = index === currentQuestionIndex;
        let className = 'question-number-btn';
        
        if (status === 'status-answered') {
            className += ' answered';
            answered++;
        } else if (status === 'status-marked') {
            className += ' marked';
            marked++;
        }
        
        if (isCurrent) {
            className += ' current';
        }
        
        html += `<button class="${className}" onclick="jumpToQuestion(${index})">${index + 1}</button>`;
    });
    
    questionGrid.innerHTML = html;
    answeredCount.textContent = answered;
    markedCount.textContent = marked;
}

function highlightCurrentQuestion() {
    const buttons = document.querySelectorAll('.question-number-btn');
    buttons.forEach((btn, index) => {
        btn.classList.remove('current');
        if (index === currentQuestionIndex) {
            btn.classList.add('current');
        }
    });
}

// ===== UI UPDATES =====
function updateCurrentQuestionDisplay() {
    document.getElementById('current-question').textContent = currentQuestionIndex + 1;
}

function updateQuestionCountDisplay() {
    document.getElementById('total-questions-display').textContent = examQuestions.length;
}

function updateProgressBar() {
    const answeredCount = userAnswers.filter(answer => answer !== null && 
        answer !== '' && 
        !(typeof answer === 'object' && Object.keys(answer).length === 0)).length;
    
    const progress = (answeredCount / examQuestions.length) * 100;
    document.getElementById('exam-progress').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = `${answeredCount}/${examQuestions.length}`;
}

// ===== EXAM SUBMISSION =====
function submitExam() {
    if (questionsMarked.length > 0 && !isReviewMode) {
        showConfirmationModal(
            `You have ${questionsMarked.length} question(s) marked for review.<br><br>
            Would you like to review them before submitting?`,
            'Review Marked Questions',
            'Review Questions',
            'Submit Now',
            () => startReviewMode(),
            () => calculateAndDisplayResults()
        );
    } else {
        calculateAndDisplayResults();
    }
}

function calculateAndDisplayResults() {
    stopTimer();
    
    let score = 0;
    let totalQuestions = examQuestions.length;
    wrongAnswers = [];
    
    // Reset topic performance for this exam
    initializeTopicTracking(examQuestions);
    
    // Evaluate answers
    examQuestions.forEach((q, index) => {
        const userAnswer = userAnswers[index];
        const topic = q.topic || 'Uncategorized';
        
        topicPerformance[topic].total++;
        
        if (isAnswerCorrect(q, userAnswer)) {
            score++;
            topicPerformance[topic].correct++;
        } else {
            // Store wrong answer details
            wrongAnswers.push({
                question: q,
                questionNumber: index + 1,
                userAnswer: userAnswer,
                correctAnswer: q.answer,
                topic: q.topic || 'Uncategorized',
                type: q.type
            });
        }
    });
    
    // Calculate percentages
    Object.keys(topicPerformance).forEach(topic => {
        const data = topicPerformance[topic];
        if (data.total > 0) {
            data.percentage = Math.round((data.correct / data.total) * 100);
        }
    });
    
    // Display results
    displayResults(score, totalQuestions);
}

function displayResults(score, totalQuestions) {
    const scorePercentage = Math.round((score / totalQuestions) * 100);
    const isPassed = scorePercentage >= PASSING_SCORE_PERCENTAGE;
    
    // Categorize topics
    const weakTopics = [];
    const averageTopics = [];
    const strongTopics = [];
    
    Object.entries(topicPerformance).forEach(([topic, data]) => {
        if (data.total > 0) {
            if (data.percentage < 60) {
                weakTopics.push({ topic, ...data });
            } else if (data.percentage < 80) {
                averageTopics.push({ topic, ...data });
            } else {
                strongTopics.push({ topic, ...data });
            }
        }
    });
    
    // Create topic cards HTML
    let topicCardsHtml = '';
    [...weakTopics, ...averageTopics, ...strongTopics].forEach(topicData => {
        let className = 'average';
        if (topicData.percentage < 60) className = 'weak';
        if (topicData.percentage >= 80) className = 'strong';
        
        topicCardsHtml += `
            <div class="topic-card ${className}">
                <strong>${topicData.topic}</strong>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${topicData.percentage}%"></div>
                </div>
                <div class="topic-stats">
                    <span>${topicData.correct}/${topicData.total} correct</span>
                    <span class="topic-percentage">${topicData.percentage}%</span>
                </div>
            </div>
        `;
    });
    
    // Create wrong answers HTML
    let wrongAnswersHtml = '';
    if (wrongAnswers.length > 0) {
        wrongAnswers.forEach(wrong => {
            wrongAnswersHtml += `
                <div class="wrong-answer-card">
                    <div class="wrong-answer-header">
                        <div class="wrong-answer-question">
                            <i class="fas fa-times-circle"></i>
                            Question ${wrong.questionNumber}: ${wrong.topic}
                        </div>
                        <div class="wrong-answer-topic">${wrong.type}</div>
                    </div>
                    <p><strong>Question:</strong> ${wrong.question.question}</p>
                    ${wrong.question.code ? `<pre class="code-block"><code>${wrong.question.code}</code></pre>` : ''}
                    <div class="wrong-answer-content">
                        <div class="answer-comparison your-answer">
                            <h4><i class="fas fa-user"></i> Your Answer</h4>
                            <div class="answer-display">${formatAnswerForDisplay(wrong.userAnswer, wrong.question)}</div>
                        </div>
                        <div class="answer-comparison correct-answer">
                            <h4><i class="fas fa-check-circle"></i> Correct Answer</h4>
                            <div class="answer-display">${formatAnswerForDisplay(wrong.correctAnswer, wrong.question)}</div>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        wrongAnswersHtml = `
            <div class="no-wrong-answers">
                <h4><i class="fas fa-trophy"></i> Perfect Score!</h4>
                <p>You answered all questions correctly. Excellent work!</p>
            </div>
        `;
    }
    
    // Display results
    document.getElementById('question-area').innerHTML = `
        <div class="results-section">
            <div class="results-header">
                <h2>Exam Results</h2>
                <div class="student-info-display">
                    <strong>Candidate:</strong> ${studentName} | 
                    <strong>Exam:</strong> ${examType.replace('-', ' ').toUpperCase()} |
                    <strong>Date:</strong> ${new Date().toLocaleDateString()}
                </div>
                <div class="score-display ${isPassed ? 'passed' : 'failed'}">
                    ${isPassed ? 'PASSED' : 'NEEDS IMPROVEMENT'}
                    <div style="font-size: 4rem; margin: 20px 0;">${scorePercentage}%</div>
                    <div style="font-size: 1.3rem;">${score} out of ${totalQuestions} questions</div>
                </div>
            </div>
            
            <div class="result-stats">
                <div class="result-stat">
                    <span class="result-stat-label">Your Score</span>
                    <span class="result-stat-value">${scorePercentage}%</span>
                </div>
                <div class="result-stat">
                    <span class="result-stat-label">Passing Score</span>
                    <span class="result-stat-value">${PASSING_SCORE_PERCENTAGE}%</span>
                </div>
                <div class="result-stat">
                    <span class="result-stat-label">Time Taken</span>
                    <span class="result-stat-value">${formatTime(examDurationSeconds - timeLeft)}</span>
                </div>
                <div class="result-stat">
                    <span class="result-stat-label">Questions Marked</span>
                    <span class="result-stat-value">${questionsMarked.length}</span>
                </div>
            </div>
            
            <div class="topic-performance">
                <h3><i class="fas fa-chart-line"></i> Topic Performance</h3>
                <div class="performance-legend">
                    <div class="legend-item">
                        <div class="legend-color strong"></div>
                        <span>Strong (80%+)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color average"></div>
                        <span>Average (60-79%)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color weak"></div>
                        <span>Needs Improvement (&lt;60%)</span>
                    </div>
                </div>
                <div class="topic-cards">
                    ${topicCardsHtml}
                </div>
            </div>
            
            <div class="wrong-answers-section">
                <h3><i class="fas fa-exclamation-triangle"></i> Questions to Review</h3>
                ${wrongAnswersHtml}
            </div>
            
            <div class="results-actions" style="text-align: center; margin-top: 40px;">
                <h3>Recommendations</h3>
                ${weakTopics.length > 0 ? 
                    `<p style="color: #ff3b00; font-weight: 600; font-size: 1.1rem;">
                        Focus on improving these topics: ${weakTopics.map(t => t.topic).join(', ')}
                    </p>` : 
                    `<p style="color: #00b894; font-weight: 600; font-size: 1.1rem;">
                        Great job! You performed well across all topics.
                    </p>`
                }
                <div style="display: flex; gap: 20px; justify-content: center; margin-top: 30px; flex-wrap: wrap;">
                    <button onclick="location.reload()" style="background: linear-gradient(to right, #ff7b00, #ff5500); color: white; border: none; padding: 15px 40px; border-radius: 10px; font-size: 1.2rem; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-redo"></i> Take Another Exam
                    </button>
                    <button onclick="printResults()" style="background: #f0f0f0; color: #666; border: 2px solid #ddd; padding: 15px 40px; border-radius: 10px; font-size: 1.2rem; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-print"></i> Print Results
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('navigation-area').style.display = 'none';
    document.getElementById('quick-nav').style.display = 'none';
}

function formatAnswerForDisplay(answer, question) {
    if (!answer || answer === '' || (typeof answer === 'object' && Object.keys(answer).length === 0)) {
        return 'No answer provided';
    }
    
    if (question.type === 'drag-and-drop') {
        if (typeof answer === 'object') {
            const zones = Object.keys(answer);
            if (zones.length === 0) return 'No items placed';
            
            return zones.map(zone => {
                const zoneNumber = parseInt(zone.replace('zone-', '')) + 1;
                return `Zone ${zoneNumber}: ${answer[zone]}`;
            }).join('\n');
        }
        return JSON.stringify(answer);
    }
    
    return answer.toString();
}

function printResults() {
    window.print();
}

// ===== MODAL FUNCTIONS =====
function showTimeUpModal() {
    modalContainer.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-clock"></i> Time's Up!</h3>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <p>Your exam time has ended.</p>
                    <p>You have <strong>${questionsMarked.length}</strong> question(s) marked for review.</p>
                    <p>Would you like to review them before final submission?</p>
                </div>
                <div class="modal-footer">
                    <button class="modal-button primary" onclick="startReviewMode(); closeModal();">
                        <i class="fas fa-list-check"></i> Review Questions (${questionsMarked.length})
                    </button>
                    <button class="modal-button secondary" onclick="calculateAndDisplayResults(); closeModal();">
                        <i class="fas fa-paper-plane"></i> Submit Now
                    </button>
                </div>
            </div>
        </div>
    `;
}

function showConfirmationModal(message, title, confirmText, cancelText, confirmAction, cancelAction) {
    modalContainer.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-exclamation-circle"></i> ${title}</h3>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    ${message}
                </div>
                <div class="modal-footer">
                    <button class="modal-button primary" onclick="confirmAction(); closeModal();">
                        <i class="fas fa-check"></i> ${confirmText}
                    </button>
                    <button class="modal-button secondary" onclick="cancelAction(); closeModal();">
                        <i class="fas fa-times"></i> ${cancelText}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Store actions globally so they can be called from onclick
    window.confirmAction = confirmAction;
    window.cancelAction = cancelAction;
}

function showErrorModal(message, title) {
    modalContainer.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-exclamation-triangle"></i> ${title}</h3>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    ${message}
                </div>
                <div class="modal-footer">
                    <button class="modal-button primary" onclick="closeModal()">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        </div>
    `;
}

function showInfoModal(message, title) {
    modalContainer.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-info-circle"></i> ${title}</h3>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    ${message}
                </div>
                <div class="modal-footer">
                    <button class="modal-button primary" onclick="closeModal()">
                        <i class="fas fa-times"></i> OK
                    </button>
                </div>
            </div>
        </div>
    `;
}

function closeModal() {
    modalContainer.innerHTML = '';
    delete window.confirmAction;
    delete window.cancelAction;
}

// ===== DEMO FUNCTION =====
function loadDemoExam() {
    // Set demo values
    document.getElementById('student-name').value = 'John Smith';
    document.getElementById('exam-type').value = 'practice';
    document.getElementById('question-count').value = '20';
    document.getElementById('agree-terms').checked = true;
    
    // Show success message
    showInfoModal(
        'Demo mode activated. Click "Start Exam" to begin a practice exam with 20 questions.',
        'Demo Mode Ready'
    );
}

// ===== EXPORT FUNCTIONS =====
window.startExam = startExam;
window.nextQuestion = nextQuestion;
window.previousQuestion = previousQuestion;
window.toggleMark = toggleMark;
window.showReviewSection = showReviewSection;
window.startReviewMode = startReviewMode;
window.exitReviewMode = exitReviewMode;
window.jumpToQuestion = jumpToQuestion;
window.submitExam = submitExam;
window.printResults = printResults;
window.closeModal = closeModal;
window.loadDemoExam = loadDemoExam;