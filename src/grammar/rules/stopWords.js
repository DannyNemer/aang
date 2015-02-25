var g = require('../grammar')

// Stopwords that preceed verbs
// (people I) <stop> follow
this.preVerbStopwords = new g.Symbol('pre', 'verb', 'stopwords')
this.preVerbStopwords.addRule({ terminal: true, RHS: g.emptyTermSym })
this.preVerbStopwords.addRule({ terminal: true, RHS: 'like|liked|likes to' }) // reject

// Phrase having the same function as an adverbial
// (people) I follow <stop>
this.sentenceAdverbial = new g.Symbol('sentence', 'adverbial')
this.sentenceAdverbial.addRule({ terminal: true, RHS: g.emptyTermSym })