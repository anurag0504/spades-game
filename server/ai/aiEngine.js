const BeginnerAI = require('./beginnerAI');
const ExpertAI = require('./expertAI');

module.exports = {
  getAI(level = 'beginner') {
    switch (level) {
      case 'expert': return ExpertAI;
      default: return BeginnerAI;
    }
  }
};
