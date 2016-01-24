const g = require('../grammar')


// Phrases with the same function as an adverb.
// (people I follow) [sentence-adverbial]
exports.sentenceAdverbial = g.newSymbol('sentence', 'adverbial').addStopWords(
	{ symbol: 'never', costPenalty: 0.5 },
	{ symbol: 'frequently|mostly|often|usually|always', costPenalty: 2 },
	{ symbol: 'in|this|next|last january|february|march|april|may|june|july|august|september|october|november|december', costPenalty: 2 },
	{ symbol: 'last night|weekend|week|month|year', costPenalty: 2 },
	{ symbol: 'currently', costPenalty: 2 },
	{ symbol: 'in the past', costPenalty: 2 },
	{ symbol: 'this|the morning|afternoon|evening|weekend|week|month|year', costPenalty: 2 },
	{ symbol: 'from|in|within |the last|past|next hour|day|week|month|year', costPenalty: 2 }
)

// Stop-words that preceed verbs.
// (people I) [pre-verb-stop-word] (follow)
exports.preVerb = g.newSymbol('pre', 'verb', 'stop', 'word').addStopWords(
	{ symbol: 'like|liked|likes to', costPenalty: 2 },
	{ symbol: 'to', costPenalty: 1 },
	// FIXME: Insertion of 'have|has|had' creates ambiguity with the first rule.
	{ symbol: 'have|has|had liked to', costPenalty: 2 },
	{ symbol: '|have|has|had|was|were|is|are|am|be got|getting|gotten', costPenalty: 1 }
)
// Prevent insertion because `[pre-verb-stop-word]` already has `<empty>`.
exports.preVerb.addRule({ rhs: [ exports.sentenceAdverbial ], noInsertionIndexes: [ 0 ] })

// Note: It is possible stop-word entity categories are excluded in production, however, their implementation exists to support them whether or not they are used.
// [cat-filter] -> [pre-filter-stop-word] [cat-filter] -> (repos that) {pre-filter-stop-word} (I like)
exports.preFilter = g.newSymbol('pre', 'filter', 'stop', 'word').addStopWords('{pre-filter-stop-word}')

// [cat-lhs] -> [left-stop-word] [cat-lhs] -> {left-stop-word} (issues); {left-stop-word} [issue-adjective] (issues)
// [cat-no-relative] -> [left-stop-word] [cat-no-relative]; (repos) {left-stop-word} (I like)
// [cat-filter] -> [left-stop-word] [cat-filter]; (repos that) {left-stop-word} (I like)
exports.left = g.newSymbol('left', 'stop', 'word').addStopWords('{left-stop-word}')