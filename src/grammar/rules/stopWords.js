var g = require('../grammar')

// NOTE: might need cost penalties

// Phrase having the same function as an adverb
// (people I follow) <stop>
this.sentenceAdverbial = g.addStopWord({
	symbol: new g.Symbol('sentence', 'adverbial'),
	stopWords: [ 'never' ]
})

// Stopwords that preceed verbs
// (people I) <stop> (follow)
this.preVerb = g.addStopWord({
	symbol: new g.Symbol('pre', 'verb', 'stop', 'words'),
	stopWords: [ 'like|liked|likes to', 'to' ]
})
this.preVerb.addRule({ RHS: [ this.sentenceAdverbial ] })

// [cat-filter] -> [stop] [cat-filter]; (repos that) <stop> (I like)
this.preFilter = g.addStopWord({
	symbol: new g.Symbol('pre', 'filter', 'stop', 'words'),
	stopWords: [ '{pre-filter-stop-words}' ]
})

// [cat-lhs] -> [stop] [cat-lhs]; <stop> (issues); <stop> [issue-adjective] (issues)
// [cat-no-relative] -> [stop] [cat-no-relative]; (repos) <stop> (I like)
// [cat-filter] -> [stop] [cat-filter]; (repos that) <stop> (I like)
this.left = g.addStopWord({
	symbol: new g.Symbol('left', 'stop', 'words'),
	stopWords: [ '{left-stop-words}' ]
})