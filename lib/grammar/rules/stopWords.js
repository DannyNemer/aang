var g = require('../grammar')

// NOTE: might need cost penalties

// Phrase having the same function as an adverb
// (people I follow) [setence-adverbial]
exports.sentenceAdverbial = g.newSymbol('sentence', 'adverbial')
exports.sentenceAdverbial.addStopWord({
	stopWords: [ 'never', 'frequently|mostly|often|usually|always', 'currently', 'this|the morning|afternoon|evening|weekend|week|month|year' ],
})

// Stopwords that preceed verbs
// (people I) [pre-verb-stop-word] (follow)
exports.preVerb = g.newSymbol('pre', 'verb', 'stop', 'word')
exports.preVerb.addStopWord({
	stopWords: [ 'like|liked|likes to', 'to' ],
})
exports.preVerb.addRule({ RHS: [ exports.sentenceAdverbial ] })

// [cat-filter] -> [pre-filter-stop-word] [cat-filter] -> (repos that) {pre-filter-stop-word} (I like)
exports.preFilter = g.newSymbol('pre', 'filter', 'stop', 'word')
exports.preFilter.addStopWord({
	stopWords: [ '{pre-filter-stop-word}' ],
})

// [cat-lhs] -> [left-stop-word] [cat-lhs] -> {left-stop-word} (issues); {left-stop-word} [issue-adjective] (issues)
// [cat-no-relative] -> [left-stop-word] [cat-no-relative]; (repos) {left-stop-word} (I like)
// [cat-filter] -> [left-stop-word] [cat-filter]; (repos that) {left-stop-word} (I like)
exports.left = g.newSymbol('left', 'stop', 'word')
exports.left.addStopWord({
	stopWords: [ '{left-stop-word}' ],
})