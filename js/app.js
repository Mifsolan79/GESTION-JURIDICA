// Exam Engine - GESTIÓN DE LA DOCUMENTACIÓN JURÍDICA
// Optimized for Purple Theme

const quizState = {
    items: [],
    currentIndex: 0,
    userAnswers: {}, // index: chosenOptionIndex
    results: null // { correct: 0, incorrect: 0, skipped: 0 }
};

const dom = {
    container: document.getElementById('quiz-container'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    feedback: document.getElementById('feedback-container'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    finishBtn: document.getElementById('finish-btn'),
    // Dashboard
    countOk: document.getElementById('count-ok'),
    countKo: document.getElementById('count-ko'),
    countSk: document.getElementById('count-sk'),
    countSc: document.getElementById('count-sc'),
    navigator: document.getElementById('navigator')
};

// URL Params
const urlParams = new URLSearchParams(window.location.search);
const currentTema = urlParams.get('tema') || '01';

async function init() {
    try {
        const response = await fetch(`data/db_tema_${currentTema.padStart(2, '0')}.json`);
        if (!response.ok) throw new Error('No se pudo cargar el examen.');
        const data = await response.json();

        quizState.items = data.items;
        document.title = `${data.title} - Examen`;

        setupNavigator();
        renderQuestion();
        updateDashboard();
    } catch (err) {
        console.error(err);
        dom.container.innerHTML = `<div style="padding:40px;text-align:center;">
            <h2>❌ Error</h2>
            <p>${err.message}</p>
            <br>
            <a href="index.html" style="color:var(--gold)">Volver al menú</a>
        </div>`;
    }
}

function setupNavigator() {
    dom.navigator.innerHTML = '';
    quizState.items.forEach((_, i) => {
        const pill = document.createElement('div');
        pill.className = 'pill';
        pill.textContent = i + 1;
        pill.id = `pill-${i}`;
        pill.onclick = () => {
            if (quizState.results) return; // Locked after finishing
            quizState.currentIndex = i;
            renderQuestion();
        };
        dom.navigator.appendChild(pill);
    });
}

function renderQuestion() {
    const q = quizState.items[quizState.currentIndex];
    const answered = quizState.userAnswers.hasOwnProperty(quizState.currentIndex);
    const resultRevealed = quizState.results !== null;

    dom.questionText.textContent = `${quizState.currentIndex + 1}. ${q.question}`;
    dom.optionsContainer.innerHTML = '';

    q.options.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'option';
        if (quizState.userAnswers[quizState.currentIndex] === i) div.classList.add('selected');
        if (resultRevealed || answered) div.classList.add('disabled');

        // Final coloring
        if (resultRevealed) {
            if (i === q.correctAnswer) div.classList.add('revealed-correct');
            else if (quizState.userAnswers[quizState.currentIndex] === i) div.classList.add('revealed-wrong');
        }

        div.innerHTML = `
            <input type="radio" name="opt" value="${i}" ${quizState.userAnswers[quizState.currentIndex] === i ? 'checked' : ''} ${resultRevealed || answered ? 'disabled' : ''}>
            <span>${opt}</span>
        `;

        if (!resultRevealed && !answered) {
            div.onclick = () => selectOption(i);
        }
        dom.optionsContainer.appendChild(div);
    });

    // Feedback
    dom.feedback.className = 'hidden';
    if (resultRevealed) {
        dom.feedback.classList.remove('hidden');
        const userA = quizState.userAnswers[quizState.currentIndex];
        if (userA === undefined) {
            dom.feedback.textContent = `⚠️ Saltada. La respuesta correcta era: ${String.fromCharCode(65 + q.correctAnswer)}`;
            dom.feedback.className = 'feedback-skipped';
        } else if (userA === q.correctAnswer) {
            dom.feedback.textContent = `✅ ¡Correcto! ${q.explanation || ''}`;
            dom.feedback.className = 'feedback-correct';
        } else {
            dom.feedback.textContent = `❌ Incorrecto. Era la ${String.fromCharCode(65 + q.correctAnswer)}. ${q.explanation || ''}`;
            dom.feedback.className = 'feedback-incorrect';
        }
    }

    // Buttons
    dom.prevBtn.disabled = quizState.currentIndex === 0;
    dom.nextBtn.classList.toggle('hidden', quizState.currentIndex === quizState.items.length - 1);
    dom.finishBtn.classList.toggle('hidden', quizState.currentIndex !== quizState.items.length - 1 || resultRevealed);

    // Navigator Active
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('cur'));
    document.getElementById(`pill-${quizState.currentIndex}`).classList.add('cur');
}

function selectOption(index) {
    quizState.userAnswers[quizState.currentIndex] = index;

    // Auto-advance or just re-render
    const pill = document.getElementById(`pill-${quizState.currentIndex}`);
    pill.classList.add('ok'); // Visual marker that it's answered

    renderQuestion();
    updateDashboard();
}

function updateDashboard() {
    const total = quizState.items.length;
    const answeredCount = Object.keys(quizState.userAnswers).length;

    dom.countSc.textContent = `${answeredCount}/${total}`;

    if (quizState.results) {
        dom.countOk.textContent = quizState.results.correct;
        dom.countKo.textContent = quizState.results.incorrect;
        dom.countSk.textContent = quizState.results.skipped;

        // Progress bar in ring (optional if you want to implement the SVG logic)
        const percent = (quizState.results.correct / total) * 100;
        const circle = document.querySelector('.ring circle:last-child');
        if (circle) {
            const offset = 220 - (220 * percent) / 100;
            circle.style.strokeDashoffset = offset;
        }
        const label = document.querySelector('.ring .label');
        if (label) label.textContent = `${Math.round(percent)}%`;
    }
}

function nextQuestion() {
    if (quizState.currentIndex < quizState.items.length - 1) {
        quizState.currentIndex++;
        renderQuestion();
    }
}

function prevQuestion() {
    if (quizState.currentIndex > 0) {
        quizState.currentIndex--;
        renderQuestion();
    }
}

function finishQuiz() {
    if (quizState.results) return;

    let correct = 0, incorrect = 0, skipped = 0;

    quizState.items.forEach((q, i) => {
        const userA = quizState.userAnswers[i];
        const pill = document.getElementById(`pill-${i}`);
        pill.classList.remove('ok', 'ko', 'sk');

        if (userA === undefined) {
            skipped++;
            pill.classList.add('sk');
        } else if (userA === q.correctAnswer) {
            correct++;
            pill.classList.add('ok');
        } else {
            incorrect++;
            pill.classList.add('ko');
        }
    });

    quizState.results = { correct, incorrect, skipped };
    renderQuestion();
    updateDashboard();

    // Show final overlay
    showFinalResults();
}

function showFinalResults() {
    const overlay = document.getElementById('final-overlay');
    overlay.classList.remove('hidden');

    const total = quizState.items.length;
    const nota = (quizState.results.correct / total) * 10;

    document.getElementById('final-score-text').textContent = `Nota: ${nota.toFixed(1)} / 10`;
    document.getElementById('final-stats-text').textContent =
        `Correctas: ${quizState.results.correct} | Incorrectas: ${quizState.results.incorrect} | Saltadas: ${quizState.results.skipped}`;

    // Fill Summary
    const summaryBody = document.getElementById('summary-body');
    summaryBody.innerHTML = '';

    quizState.items.forEach((q, i) => {
        const userA = quizState.userAnswers[i];
        const isCorrect = userA === q.correctAnswer;

        const item = document.createElement('div');
        item.className = 'final-question-item';
        item.style.borderLeft = `4px solid ${userA === undefined ? 'var(--amber)' : (isCorrect ? 'var(--green)' : 'var(--red)')}`;

        item.innerHTML = `
            <span class="q-num">Pregunta ${i + 1}</span>
            <span class="q-text">${q.question}</span>
            <div class="q-answer">
                ${userA === undefined ? '⚠️ No respondida' : (isCorrect ? '✅ Correcta' : '❌ Tu respuesta: ' + q.options[userA])}
                <br>
                <small style="opacity:0.8">La respuesta correcta era: <strong>${q.options[q.correctAnswer]}</strong></small>
            </div>
        `;
        summaryBody.appendChild(item);
    });

    if (nota >= 5) launchConfetti();
}

function closeOverlay() {
    document.getElementById('final-overlay').classList.add('hidden');
}

function launchConfetti() {
    for (let i = 0; i < 50; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + 'vw';
        c.style.backgroundColor = ['#d46aff', '#e3a3ff', '#00f5d4', '#ff4d6d'][Math.floor(Math.random() * 4)];
        c.style.animation = `fallConfetti ${Math.random() * 3 + 2}s linear forwards`;
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 5000);
    }
}

init();
