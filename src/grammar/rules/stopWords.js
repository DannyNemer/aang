var g = require('../grammar')

// Stopwords that preceed verbs
// (people I) <stop> follow
this.preVerbStopwords = g.addStopWord({
	name: 'pre-verb-stopwords',
	stopWords: [ 'like|liked|likes to' ]
})

// Phrase having the same function as an adverb
// (people) I follow <stop>
this.sentenceAdverbial = g.addStopWord({
	name: 'sentence-adverbial',
	stopWords: [ 'never' ]
})