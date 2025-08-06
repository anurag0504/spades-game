// stats.js
let stats = JSON.parse(localStorage.getItem('spadesStats')) || { games: 0, tricks: 0, nilSuccess: 0 };

function updateStats(key) {
  stats[key] = (stats[key] || 0) + 1;
  localStorage.setItem('spadesStats', JSON.stringify(stats));
}

function showStats() {
  console.log("Games:", stats.games, "Tricks:", stats.tricks, "Nil success:", stats.nilSuccess);
}
