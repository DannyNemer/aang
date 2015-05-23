var g = require('../grammar')

// NOTE: might need cost penalties

// Phrase having the same function as an adverb
// (people I follow) <stop>
exports.sentenceAdverbial = new g.Symbol('sentence', 'adverbial')
exports.sentenceAdverbial.addStopWord({
	stopWords: [ 'never', 'this|the morning|afternoon|evening|weekend|week|month|year' ]
})

// Stopwords that preceed verbs
// (people I) <stop> (follow)
exports.preVerb = new g.Symbol('pre', 'verb', 'stop', 'words')
exports.preVerb.addStopWord({
	stopWords: [ 'like|liked|likes to', 'to' ]
})
exports.preVerb.addRule({ RHS: [ exports.sentenceAdverbial ] })

// [cat-filter] -> [stop] [cat-filter]; (repos that) <stop> (I like)
exports.preFilter = new g.Symbol('pre', 'filter', 'stop', 'words')
exports.preFilter.addStopWord({
	stopWords: [ '{pre-filter-stop-words}' ]
})

// [cat-lhs] -> [stop] [cat-lhs]; <stop> (issues); <stop> [issue-adjective] (issues)
// [cat-no-relative] -> [stop] [cat-no-relative]; (repos) <stop> (I like)
// [cat-filter] -> [stop] [cat-filter]; (repos that) <stop> (I like)
exports.left = new g.Symbol('left', 'stop', 'words')
exports.left.addStopWord({
	stopWords: [ '{left-stop-words}' ]
})