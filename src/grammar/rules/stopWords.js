var g = require('../grammar')

// NOTE: might need cost penalties

// Phrase having the same function as an adverb
// (people I follow) <stop>
exports.sentenceAdverbial = g.newSymbol('sentence', 'adverbial')
exports.sentenceAdverbial.addStopWord({
	stopWords: [ 'never', 'frequently|mostly|often|usually|always', 'currently', 'this|the morning|afternoon|evening|weekend|week|month|year' ]
})

// Stopwords that preceed verbs
// (people I) <stop> (follow)
exports.preVerb = g.newSymbol('pre', 'verb', 'stop', 'words')
exports.preVerb.addStopWord({
	stopWords: [ 'like|liked|likes to', 'to' ]
})
exports.preVerb.addRule({ RHS: [ exports.sentenceAdverbial ] })

// [cat-filter] -> [stop] [cat-filter]; (repos that) <stop> (I like)
exports.preFilter = g.newSymbol('pre', 'filter', 'stop', 'words')
exports.preFilter.addStopWord({
	stopWords: [ '{pre-filter-stop-words}' ]
})

// [cat-lhs] -> [stop] [cat-lhs]; <stop> (issues); <stop> [issue-adjective] (issues)
// [cat-no-relative] -> [stop] [cat-no-relative]; (repos) <stop> (I like)
// [cat-filter] -> [stop] [cat-filter]; (repos that) <stop> (I like)
exports.left = g.newSymbol('left', 'stop', 'words')
exports.left.addStopWord({
	stopWords: [ '{left-stop-words}' ]
})