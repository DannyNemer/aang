var g = require('../grammar')

// Stopwords that preceed verbs
// (people I) <stop> follow
this.preVerbStopWords = g.addStopWord({
	symbol: new g.Symbol('pre', 'verb', 'stop', 'words'),
	stopWords: [ 'like|liked|likes to' ]
})

// Phrase having the same function as an adverb
// (people) I follow <stop>
this.sentenceAdverbial = g.addStopWord({
	symbol: new g.Symbol('sentence', 'adverbial'),
	stopWords: [ 'never' ]
})