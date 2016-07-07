var g = require('../grammar')


// Phrases with the same function as an adverb.
// (people I follow) [sentence-adverbial]
exports.sentenceAdverbial = g.newSymbol('sentence', 'adverbial').addStopWords(
	{ symbol: 'never', costPenalty: 1.5 },
	{ symbol: 'frequently|mostly|often|usually|always', costPenalty: 2 },
	// Note: Remove "in" from first token set. Might modify by excluding this terminal rule set from date phrases.
	{ symbol: 'this|next|last january|february|march|april|may|june|july|august|september|october|november|december', costPenalty: 2 },
	{ symbol: 'last night|weekend|week|month|year', costPenalty: 2 },
	{ symbol: 'currently', costPenalty: 2 },
	{ symbol: 'in the past', costPenalty: 2 },
	{ symbol: 'this|the morning|afternoon|evening|weekend|week|month|year', costPenalty: 2 },
	// FIXME: There is ambiguity with this stop-word and "in the past" (above), because the last term here is insertable (using the insertion cost for one of the token set's terms, defined in `date`).
	{ symbol: 'from|in|within |the last|past|next hour|day|week|month|year', costPenalty: 2 }
)

// Stop-words that preceed verbs.
// Note: Temporarily not in use.
// (people I) `[pre-verb-stop-word]` (follow)
exports.preVerb = g.newSymbol('pre', 'verb', 'stop', 'word').addStopWords(
	{ symbol: 'to', costPenalty: 1 },
	{ symbol: 'can|could|do|may|might|must|shall|should|will|would', costPenalty: 1 },
	{ symbol: 'currently|presently|now|previously|formerly|ever|will', costPenalty: 1 },
	{ symbol: '|have|has|had|was|were|is|are|am|be got|getting|gotten', costPenalty: 1 },
	{ symbol: 'used to', costPenalty: 2 }
)
// Prevent insertion because `[pre-verb-stop-word]` already has `<empty>`.
exports.preVerb.addRule({
	rhs: [ {
		symbol: exports.sentenceAdverbial,
		noInsert: true,
	} ],
})

// Note: It is possible stop-word entity categories are excluded in production, however, their implementation exists to support them whether or not they are used.
// [cat-filter] -> [pre-filter-stop-word] [cat-filter] -> (repos that) {pre-filter-stop-word} (I like)
exports.preFilter = g.newSymbol('pre', 'filter', 'stop', 'word').addStopWords('{pre-filter-stop-word}')

// [cat-lhs] -> [left-stop-word] [cat-lhs] -> {left-stop-word} (issues); {left-stop-word} [issue-adjective] (issues)
// [cat-no-relative] -> [left-stop-word] [cat-no-relative]; (repos) {left-stop-word} (I like)
// [cat-filter] -> [left-stop-word] [cat-filter]; (repos that) {left-stop-word} (I like)
exports.left = g.newSymbol('left', 'stop', 'word').addStopWords('{left-stop-word}')