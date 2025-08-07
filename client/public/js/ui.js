// ui.js - Global UI functions

function renderHand(hand, containerId, playable = () => true) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    hand.forEach(card => {
        const div = document.createElement('div');
        div.className = 'card';
        div.textContent = cardToString(card);
        div.dataset.suit = card.suit;
        div.dataset.rank = card.rank;

        if (!playable(card)) {
            div.classList.add('unplayable');
        }

        container.appendChild(div);
    });
}

function animateCardPlay(cardElement, tableCenter) {
    if (!cardElement || !tableCenter) return;

    const rect = cardElement.getBoundingClientRect();
    const centerRect = tableCenter.getBoundingClientRect();

    cardElement.style.transition = 'transform 0.4s ease';
    cardElement.style.transform = `translate(${centerRect.left - rect.left}px, ${centerRect.top - rect.top}px)`;

    setTimeout(() => {
        if (tableCenter && cardElement.parentNode) {
            cardElement.style.transform = 'none';
            cardElement.style.transition = 'none';
            tableCenter.appendChild(cardElement);
            cardElement.classList.add('played-card');
        }
    }, 400);
}

function updateScoreboard(scores, bags) {
    const team1Score = document.getElementById('team1Score');
    const team1Bags = document.getElementById('team1Bags');
    const team2Score = document.getElementById('team2Score');
    const team2Bags = document.getElementById('team2Bags');

    if (team1Score) team1Score.textContent = scores[0] || 0;
    if (team1Bags) team1Bags.textContent = bags[0] || 0;
    if (team2Score) team2Score.textContent = scores[1] || 0;
    if (team2Bags) team2Bags.textContent = bags[1] || 0;
}

function showMessage(message, duration = 3000) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'game-message';
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 20px;
        border-radius: 10px;
        z-index: 1000;
        font-size: 18px;
    `;

    document.body.appendChild(messageDiv);
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, duration);
}
