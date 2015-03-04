var g = require('../grammar')

// Stopwords that preceed verbs
// (people I) <stop> follow
this.preVerbStopwords = g.addWord({
	name: 'pre-verb-stopwords',
	accepted: [ g.emptyTermSym ],
	substitutions: [ 'like|liked|likes to' ]
})

// Phrase having the same function as an adverb
// (people) I follow <stop>
this.sentenceAdverbial = g.addWord({
	name: 'sentence-adverbial',
	accepted: [ g.emptyTermSym ]
})