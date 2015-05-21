var g = require('../grammar')

// NOTE: might need cost penalties

// Phrase having the same function as an adverb
// (people I follow) <stop>
this.sentenceAdverbial = new g.Symbol('sentence', 'adverbial')
this.sentenceAdverbial.addStopWord({
	stopWords: [ 'never', 'this|the morning|afternoon|evening|weekend|week|month|year' ]
})

// Stopwords that preceed verbs
// (people I) <stop> (follow)
this.preVerb = new g.Symbol('pre', 'verb', 'stop', 'words')
this.preVerb.addStopWord({
	stopWords: [ 'like|liked|likes to', 'to' ]
})
this.preVerb.addRule({ RHS: [ this.sentenceAdverbial ] })

// [cat-filter] -> [stop] [cat-filter]; (repos that) <stop> (I like)
this.preFilter = new g.Symbol('pre', 'filter', 'stop', 'words')
this.preFilter.addStopWord({
	stopWords: [ '{pre-filter-stop-words}' ]
})

// [cat-lhs] -> [stop] [cat-lhs]; <stop> (issues); <stop> [issue-adjective] (issues)
// [cat-no-relative] -> [stop] [cat-no-relative]; (repos) <stop> (I like)
// [cat-filter] -> [stop] [cat-filter]; (repos that) <stop> (I like)
this.left = new g.Symbol('left', 'stop', 'words')
this.left.addStopWord({
	stopWords: [ '{left-stop-words}' ]
})