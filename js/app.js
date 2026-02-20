const state = {
    quizData: [],
    currentQuestionIndex: 0,
    correctCount: 0,
    incorrectCount: 0,
    skippedCount: 0,
    results: [],
    order: [],
    totalQuestions: 0,
    settings: {
        penaltyMode: 'auto',
        customT: 3,
        timerEnabled: false
    }
};

// DOM Elements
const elements = {
    quizContainer: document.getElementById('quiz-container'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    feedbackContainer: document.getElementById('feedback-container'),
    submitBtn: document.getElementById('submit-btn'),
    skipBtn: document.getElementById('skip-btn'),
    nextBtn: document.getElementById('next-btn'),
    restartBtn: document.getElementById('restart-btn'),
    scoreContainer: document.getElementById('score-container'),
    finalOverlay: document.getElementById('final-overlay'),
    finalScoreBig: document.getElementById('final-score-big'),
    finalMsg: document.getElementById('final-msg'),
    ringProgress: document.getElementById('ring-progress'),
    ringLabel: document.getElementById('ring-label'),
    ringStep: document.getElementById('ring-step'),
    ringAcc: document.getElementById('ring-acc'),
    liveCorrect: document.getElementById('s-ok'),
    liveIncorrect: document.getElementById('s-ko'),
    liveSkipped: document.getElementById('s-sk'),
    liveScore: document.getElementById('s-sc'),
    miniNav: document.getElementById('mini-nav')
};

// Utils
const getPenaltyT = () => 3; // Default penalty divisor
const computeScore = () => {
    const T = getPenaltyT();
    const penalty = state.incorrectCount / T;
    const net = Math.max(0, state.correctCount - penalty);
    return Math.min(10, (net / state.totalQuestions) * 10);
};

// Initialization
async function init() {
    const params = new URLSearchParams(window.location.search);

    let themeValue = params.get('tema') || params.get('exam');

    if (!themeValue) {
        console.error('No exam ID found in URL parameters.');
        alert('No se ha especificado un examen.');
        window.location.href = 'index.html';
        return;
    }
    console.log('Loading exam:', themeValue);

    // Normalize: if it's just a number, make it 'tema_N'. If it's 'tema_N', keep it.
    if (!themeValue.startsWith('tema_')) {
        themeValue = `tema_${themeValue}`;
    }

    try {
        // Force new filename to bypass cache completely
        const dbName = themeValue.replace('tema_', 'db_tema_');
        const url = `data/${dbName}.json`;
        console.log('Fetching new DB:', url);
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                alert('⚠️ Este examen (' + themeValue.replace('tema_', 'TEMA ') + ') aún no está disponible.\n\nPróximamente añadiremos más contenidos.');
                window.location.href = 'index.html';
                return;
            }
            throw new Error('No se pudo cargar el archivo del examen.');
        }

        const data = await response.json();
        state.quizData = data.items;
        state.totalQuestions = state.quizData.length;
        state.order = Array.from({ length: state.totalQuestions }, (_, i) => i);

        // Format the title
        const themeNum = themeValue.replace('tema_', '');
        const formattedNum = themeNum.padStart(2, '0');
        const genericTitle = `GESTIÓN JURÍDICA - TEMA ${formattedNum}`;

        document.querySelector('h1').textContent = genericTitle;
        document.title = genericTitle;

        loadQuestion();
        updateUI();
    } catch (error) {
        console.error(error);
        alert('Error cargando el examen: ' + error.message);
    }

    setupEventListeners();
}

function loadQuestion() {
    const qIndex = state.order[state.currentQuestionIndex];
    const question = state.quizData[qIndex];

    elements.questionText.textContent = question.question;
    elements.optionsContainer.innerHTML = '';

    // Check if already answered
    const existingResult = state.results.find(r => r.qIndex === qIndex);

    elements.feedbackContainer.classList.add('hidden');
    elements.feedbackContainer.innerHTML = '';

    question.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'answer';
        input.value = idx;
        input.id = `opt${idx}`;
        input.disabled = !!existingResult; // Disable if already answered

        const label = document.createElement('label');
        label.htmlFor = `opt${idx}`;
        label.textContent = opt;

        div.append(input, label);

        if (!existingResult) {
            div.addEventListener('click', (e) => {
                if (e.target !== input && !input.disabled) {
                    input.checked = true;
                    document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
                    div.classList.add('selected');
                }
            });
        }

        elements.optionsContainer.appendChild(div);
    });

    if (existingResult) {
        // Restore State
        if (existingResult.chosen !== null) {
            const chosenInput = document.getElementById(`opt${existingResult.chosen}`);
            if (chosenInput) {
                chosenInput.checked = true;
                chosenInput.closest('.option').classList.add('selected');
            }
        }

        // Show feedback immediately
        const isCorrect = existingResult.outcome === 'ok';
        const isSkipped = existingResult.outcome === 'sk';
        showFeedback(isCorrect, question, existingResult.chosen, isSkipped);

        elements.submitBtn.classList.add('hidden');
        elements.skipBtn.classList.add('hidden');
        elements.nextBtn.classList.remove('hidden');

    } else {
        // New Question State
        elements.submitBtn.classList.remove('hidden');
        elements.submitBtn.disabled = false;
        elements.skipBtn.classList.remove('hidden');
        elements.skipBtn.disabled = false;
        elements.nextBtn.classList.add('hidden');
    }

    updateMiniNav();
}

function updateMiniNav() {
    if (!elements.miniNav) return;
    elements.miniNav.innerHTML = '';
    state.order.forEach((qIdx, i) => {
        const pill = document.createElement('div');
        pill.className = 'pill';
        pill.textContent = i + 1;
        pill.style.cursor = 'pointer';

        const res = state.results.find(r => r.qIndex === qIdx);
        if (res) {
            pill.classList.add(res.outcome); // ok, ko, sk
        }

        if (i === state.currentQuestionIndex) pill.classList.add('cur');

        // Add click listener to jump
        pill.onclick = () => {
            state.currentQuestionIndex = i;
            loadQuestion();
        };

        elements.miniNav.appendChild(pill);
    });
}

function submitAnswer() {
    const selected = document.querySelector('input[name="answer"]:checked');
    if (!selected) {
        showToast('Por favor, selecciona una respuesta.');
        return;
    }

    const chosenIdx = parseInt(selected.value);
    const qIndex = state.order[state.currentQuestionIndex];
    const question = state.quizData[qIndex];
    const isCorrect = chosenIdx === question.correctAnswer;

    if (isCorrect) state.correctCount++;
    else state.incorrectCount++;

    state.results.push({
        qIndex,
        outcome: isCorrect ? 'ok' : 'ko',
        chosen: chosenIdx,
        correct: question.correctAnswer
    });

    showFeedback(isCorrect, question, chosenIdx);
    updateUI();
}

function skipQuestion() {
    const qIndex = state.order[state.currentQuestionIndex];
    const question = state.quizData[qIndex];

    state.skippedCount++;
    state.results.push({
        qIndex,
        outcome: 'sk',
        chosen: null,
        correct: question.correctAnswer
    });

    showFeedback(false, question, null, true);
    updateUI();
}

function showFeedback(isCorrect, question, chosenIdx, isSkipped = false) {
    const container = elements.feedbackContainer;
    container.classList.remove('hidden', 'feedback-correct', 'feedback-incorrect', 'feedback-skipped');

    elements.submitBtn.classList.add('hidden');
    elements.skipBtn.classList.add('hidden');
    elements.nextBtn.classList.remove('hidden');

    // Disable inputs
    document.querySelectorAll('input[type="radio"]').forEach(i => i.disabled = true);
    document.querySelectorAll('.option').forEach(o => o.classList.add('disabled'));

    // Highlight options
    const correctOpt = document.getElementById(`opt${question.correctAnswer}`).closest('.option');
    correctOpt.classList.add('revealed-correct');

    if (!isCorrect && !isSkipped && chosenIdx !== null) {
        const chosenOpt = document.getElementById(`opt${chosenIdx}`).closest('.option');
        chosenOpt.classList.add('revealed-wrong');
    }

    // Feedback Text
    let html = '';
    if (isSkipped) {
        container.classList.add('feedback-skipped');
        html = '<div>🟡 Pregunta omitida.</div>';
    } else if (isCorrect) {
        container.classList.add('feedback-correct');
        html = '<div>✅ ¡Correcto!</div>';
    } else {
        container.classList.add('feedback-incorrect');
        html = '<div>❌ Incorrecto.</div>';
    }

    if (question.explanation) {
        html += `<div style="margin-top:10px; font-weight:normal;">${question.explanation}</div>`;
    }

    container.innerHTML = html;
}

function nextQuestion() {
    state.currentQuestionIndex++;
    if (state.currentQuestionIndex < state.totalQuestions) {
        loadQuestion();
    } else {
        showFinalResults();
    }
}

function showFinalResults() {
    const finalScore = computeScore();
    elements.quizContainer.classList.add('hidden');
    elements.finalOverlay.classList.remove('hidden');

    elements.finalScoreBig.textContent = finalScore.toFixed(2);

    let msg = '';
    if (finalScore >= 9) msg = '¡Excelente trabajo! 🌟';
    else if (finalScore >= 7) msg = 'Muy bien, sigue así. 👍';
    else if (finalScore >= 5) msg = 'Aprobado, pero se puede mejorar. 📚';
    else msg = 'No has aprobado. ¡Sigue practicando! 💪';

    elements.finalMsg.textContent = msg;

    // --- Badges de resumen rápido ---
    const summaryBadges = document.getElementById('final-summary-badges');
    if (summaryBadges) {
        summaryBadges.innerHTML = `
            <div class="badge ok">✅ Acertadas <strong>${state.correctCount}</strong></div>
            <div class="badge ko">❌ Falladas <strong>${state.incorrectCount}</strong></div>
            <div class="badge sk">🟡 Saltadas <strong>${state.skippedCount}</strong></div>
            <div class="badge sc">📊 Nota <strong>${finalScore.toFixed(2)}</strong></div>
        `;
    }

    // --- Detalle por categoría ---
    const detail = document.getElementById('final-detail');
    if (detail) {
        detail.innerHTML = '';

        const categories = [
            {
                key: 'ok',
                emoji: '✅',
                label: 'Preguntas acertadas',
                cls: 'ok',
                items: state.results.filter(r => r.outcome === 'ok')
            },
            {
                key: 'ko',
                emoji: '❌',
                label: 'Preguntas falladas — ¡Repásalas!',
                cls: 'ko',
                items: state.results.filter(r => r.outcome === 'ko')
            },
            {
                key: 'sk',
                emoji: '🟡',
                label: 'Preguntas saltadas',
                cls: 'sk',
                items: state.results.filter(r => r.outcome === 'sk')
            }
        ];

        categories.forEach(cat => {
            if (cat.items.length === 0) return;

            const section = document.createElement('div');
            section.className = `final-section ${cat.cls}`;

            const header = document.createElement('div');
            header.className = 'final-section-header';
            header.innerHTML = `
                <span>${cat.emoji} ${cat.label}</span>
                <span class="count-badge">${cat.items.length} preguntas</span>
            `;

            const body = document.createElement('div');
            body.className = 'final-section-body';

            cat.items.forEach((res, idx) => {
                const q = state.quizData[res.qIndex];
                const item = document.createElement('div');
                item.className = 'final-question-item';

                let answerHtml = '';
                if (res.outcome === 'ok') {
                    answerHtml = `<span class="q-answer">✔️ ${q.options[q.correctAnswer]}</span>`;
                } else if (res.outcome === 'ko') {
                    answerHtml = `
                        <span class="q-answer" style="color:#ff6b8a;">✘ Tu respuesta: ${q.options[res.chosen]}</span><br>
                        <span class="q-answer" style="color:#00f5d4;">✔ Correcta: ${q.options[q.correctAnswer]}</span>
                    `;
                } else {
                    answerHtml = `<span class="q-answer" style="color:#00f5d4;">✔ Respuesta correcta: ${q.options[q.correctAnswer]}</span>`;
                }

                item.innerHTML = `
                    <span class="q-num">${idx + 1}.</span>
                    <span class="q-text">${q.question}</span>
                    ${answerHtml}
                `;
                body.appendChild(item);
            });

            header.addEventListener('click', () => {
                body.style.display = body.style.display === 'none' ? 'flex' : 'none';
            });

            section.appendChild(header);
            section.appendChild(body);
            detail.appendChild(section);
        });
    }

    // Confetti
    confettiBurst();
}

function updateUI() {
    // Ring Logic
    const answered = state.correctCount + state.incorrectCount + state.skippedCount;
    const perc = state.totalQuestions > 0 ? answered / state.totalQuestions : 0;
    const offset = 327 - (327 * perc);

    if (elements.ringProgress) elements.ringProgress.style.strokeDashoffset = offset;
    if (elements.ringLabel) elements.ringLabel.textContent = Math.round(perc * 100) + '%';
    if (elements.ringStep) elements.ringStep.textContent = `${state.currentQuestionIndex + 1} / ${state.totalQuestions}`;

    // Stats
    const acc = answered > 0 ? (state.correctCount / answered) * 100 : 0;
    if (elements.ringAcc) elements.ringAcc.textContent = Math.round(acc) + '%';

    if (elements.liveCorrect) elements.liveCorrect.textContent = state.correctCount;
    if (elements.liveIncorrect) elements.liveIncorrect.textContent = state.incorrectCount;
    if (elements.liveSkipped) elements.liveSkipped.textContent = state.skippedCount;
    if (elements.liveScore) elements.liveScore.textContent = computeScore().toFixed(2);

    // Mini Nav
    updateMiniNav();
}

function setupEventListeners() {
    elements.submitBtn.addEventListener('click', submitAnswer);
    elements.skipBtn.addEventListener('click', skipQuestion);
    elements.nextBtn.addEventListener('click', nextQuestion);

    document.getElementById('ovl-restart')?.addEventListener('click', () => location.reload());
    document.getElementById('ovl-close')?.addEventListener('click', () => window.location.href = 'index.html');
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--panel);border:1px solid var(--gold);padding:12px 20px;border-radius:8px;box-shadow:0 5px 15px rgba(0,0,0,0.5);z-index:2000;font-weight:bold;color:var(--text);';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Confetti Effect
function confettiBurst() {
    const colors = ['#d46aff', '#e3a3ff', '#00f5d4', '#ff4d6d', '#ffffff'];
    for (let i = 0; i < 50; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti';
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        conf.style.animation = `fallConfetti ${1 + Math.random() * 2}s linear forwards`;
        document.body.appendChild(conf);
        setTimeout(() => conf.remove(), 3000);
    }
}

// Start
document.addEventListener('DOMContentLoaded', init);
