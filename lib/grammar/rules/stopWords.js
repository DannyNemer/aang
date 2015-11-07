var g = require('../grammar')

// Phrase having the same function as an adverb
// (people I follow) [sentence-adverbial]
exports.sentenceAdverbial = g.newSymbol('sentence', 'adverbial').addStopWord({
	stopWords: [
		{ name: 'never', costPenalty: 0.5 },
		{ name: 'frequently|mostly|often|usually|always', costPenalty: 2 },
		{ name: 'currently', costPenalty: 2 },
		{ name: 'this|the morning|afternoon|evening|weekend|week|month|year', costPenalty: 2 },
	],
})

// Stopwords that preceed verbs
// (people I) [pre-verb-stop-word] (follow)
exports.preVerb = g.newSymbol('pre', 'verb', 'stop', 'word').addStopWord({
	stopWords: [
		{ name: 'like|liked|likes to', costPenalty: 2 },
		{ name: 'to', costPenalty: 1 },
	],
})
// Prevent insertion because `[pre-verb-stop-word]` already has `<empty>`
exports.preVerb.addRule({ RHS: [ exports.sentenceAdverbial ], noInsertionIndexes: [ 0 ] })

// [cat-filter] -> [pre-filter-stop-word] [cat-filter] -> (repos that) {pre-filter-stop-word} (I like)
exports.preFilter = g.newSymbol('pre', 'filter', 'stop', 'word').addStopWord({
	stopWords: [ '{pre-filter-stop-word}' ],
})

// [cat-lhs] -> [left-stop-word] [cat-lhs] -> {left-stop-word} (issues); {left-stop-word} [issue-adjective] (issues)
// [cat-no-relative] -> [left-stop-word] [cat-no-relative]; (repos) {left-stop-word} (I like)
// [cat-filter] -> [left-stop-word] [cat-filter]; (repos that) {left-stop-word} (I like)
exports.left = g.newSymbol('left', 'stop', 'word').addStopWord({
	stopWords: [ '{left-stop-word}' ],
})