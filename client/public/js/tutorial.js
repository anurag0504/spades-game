// tutorial.js
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
  document.getElementById('tutorialStep').textContent = steps[index];
  
  document.getElementById('nextStepBtn').addEventListener('click', () => {
    if (index < steps.length - 1) {
      index++;
      document.getElementById('tutorialStep').textContent = steps[index];
    }
  });
  
  document.getElementById('startPracticeBtn').addEventListener('click', () => {
    window.location.href = 'game.html?mode=single';
  });
  