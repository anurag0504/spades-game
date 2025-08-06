// singleplayer.js
if (window.location.search.includes('mode=single')) {
    const deck = shuffleDeck(createDeck());
    const players = [[], [], [], []];
  
    for (let i = 0; i < 52; i++) {
      players[i % 4].push(deck[i]);
    }
  
    renderHand(players[0], 'yourHand'); // Human player
  
    // Simple AI auto-playing
    function aiPlay(playerIndex) {
      const card = players[playerIndex].shift();
      const table = document.getElementById('centerTable');
      const div = document.createElement('div');
      div.className = 'card played-card';
      div.textContent = cardToString(card);
      table.appendChild(div);
    }
  
    document.querySelectorAll('#yourHand .card').forEach(card => {
      card.addEventListener('click', () => {
        const table = document.getElementById('centerTable');
        animateCardPlay(card, table);
        card.remove();
  
        for (let ai = 1; ai <= 3; ai++) {
          setTimeout(() => aiPlay(ai), ai * 500);
        }
      });
    });
  }
  