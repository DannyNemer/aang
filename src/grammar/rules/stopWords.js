var g = require('../grammar')

// NOTE: might need cost penalties

// Phrase having the same function as an adverb
// (people) I follow <stop>
this.sentenceAdverbial = g.addStopWord({
	symbol: new g.Symbol('sentence', 'adverbial'),
	stopWords: [ 'never' ]
})

// Stopwords that preceed verbs
// (people I) <stop> follow
this.preVerbStopWords = g.addStopWord({
	symbol: new g.Symbol('pre', 'verb', 'stop', 'words'),
	stopWords: [ 'like|liked|likes to', 'to' ]
})

this.preVerbStopWords.addRule({ RHS: [ this.sentenceAdverbial ] })