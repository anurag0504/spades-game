// hints.js
function suggestCard(hand) {
    // Simple suggestion: lowest card
    return hand.sort((a,b) => a.rank.localeCompare(b.rank))[0];
  }
  
  document.getElementById('hintBtn')?.addEventListener('click', () => {
    const hand = [];
    document.querySelectorAll('#yourHand .card').forEach(card => {
      hand.push({ suit: card.dataset.suit, rank: card.dataset.rank });
    });
  
    const suggestion = suggestCard(hand);
    alert(`Suggested card: ${suggestion.rank}${suggestion.suit}`);
  });
  