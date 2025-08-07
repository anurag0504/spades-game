// tutorial.js - Fixed version
const steps = [
    "Welcome to Spades! Let's learn the rules.",
    "Each player gets 13 cards.", 
    "You bid how many tricks you'll take.",
    "Spades are always trump.",
    "Play highest card of suit unless trumped.",
    "Points: 10 × bid, 1 per overtrick, Nil bonuses.",
    "First team to 500 wins!"
];

let index = 0;

// Only run if we're on tutorial page
const tutorialStep = document.getElementById('tutorialStep');
if (tutorialStep) {
    tutorialStep.textContent = steps[index];

    const nextBtn = document.getElementById('nextStepBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (index < steps.length - 1) {
                index++;
                tutorialStep.textContent = steps[index];
            }
        });
    }

    const practiceBtn = document.getElementById('startPracticeBtn');
    if (practiceBtn) {
        practiceBtn.addEventListener('click', () => {
            window.location.href = 'game.html?mode=single';
        });
    }
}
