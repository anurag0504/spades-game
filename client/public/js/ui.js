// ui.js
export function renderHand(hand, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    hand.forEach(card => {
      const div = document.createElement('div');
      div.className = 'card';
      div.textContent = cardToString(card);
      div.dataset.suit = card.suit;
      div.dataset.rank = card.rank;
      container.appendChild(div);
    });
  }
  
  export function animateCardPlay(cardElement, tableCenter) {
    const rect = cardElement.getBoundingClientRect();
    const centerX = tableCenter.offsetLeft;
    const centerY = tableCenter.offsetTop;
  
    cardElement.style.transition = 'transform 0.4s ease';
    cardElement.style.transform = `translate(${centerX - rect.left}px, ${centerY - rect.top}px)`;
  
    setTimeout(() => {
      tableCenter.appendChild(cardElement);
      cardElement.classList.add('played-card');
      cardElement.style.transform = 'none';
    }, 400);
  }
  
  export function updateScoreboard(scores, bags) {
    document.getElementById('team1Score').textContent = scores[0];
    document.getElementById('team1Bags').textContent = bags[0];
    document.getElementById('team2Score').textContent = scores[1];
    document.getElementById('team2Bags').textContent = bags[1];
  }
  