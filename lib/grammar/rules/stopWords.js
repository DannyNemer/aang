var g = require('../grammar')

// Phrase having the same function as an adverb.
// (people I follow) [sentence-adverbial]
exports.sentenceAdverbial = g.newSymbol('sentence', 'adverbial').addStopWord(
	{ symbol: 'never', costPenalty: 0.5 },
	{ symbol: g.newBlankSet('frequently', 'mostly', 'often', 'usually', 'always'), costPenalty: 2 },
	{ symbol: [
		g.newBlankSet('in', 'this', 'next', 'last'),
		g.newBlankSet('january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'),
	], costPenalty: 2 },
	{ symbol: [
		g.newBlankSet('last'),
		g.newBlankSet('night', 'weekend', 'week', 'month', 'year'),
	], costPenalty: 2 },
	{ symbol: 'currently', costPenalty: 2 },
	// { symbol: [ g.newBlankSet('in'), [ g.newBlankSet('the'), g.newBlankSet('past') ] ], costPenalty: 2 },
	{ symbol: [
		g.newBlankSet('this', 'the'),
		g.newBlankSet('morning', 'afternoon', 'evening', 'weekend', 'week', 'month', 'year'),
	], costPenalty: 2 },
	{ symbol: [
		g.newBlankSet('from', 'in', 'within'),
		[
			g.newSymbol('the', 'opt', 'blank').addBlankSet({ optional: true, terms: [ 'the' ] }),
			[ g.newBlankSet('last', 'past', 'next'), g.newBlankSet('hour', 'day', 'week', 'month', 'year') ]
		]
	], costPenalty: 2 }
)

// Stop-words that precede verbs.
// (people I) [pre-verb-stop-word] (follow)
exports.preVerb = g.newSymbol('pre', 'verb', 'stop', 'word').addStopWord(
	// { symbol: [ g.newBlankSet('like', 'liked', 'likes'), g.newBlankSet('to') ], costPenalty: 2 },
	{ symbol: 'to', costPenalty: 1 },
	{ symbol: [
		g.newBlankSet('have', 'has', 'had'),
		[ g.newBlankSet('liked'), g.newBlankSet('to') ],
	], costPenalty: 2 },
	{ symbol: [
		g.newSymbol('|have|has|had|was|were|is|are|am|be', 'blank').addBlankSet({ optional: true, terms: [
			'have', 'has', 'had', 'was', 'were', 'is', 'are', 'am', 'be'
		] }),
		g.newBlankSet('got', 'getting', 'gotten'),
	],
	costPenalty: 1 }
)
// Prevent insertion because `[pre-verb-stop-word]` already has `<empty>`.
exports.preVerb.addRule({ RHS: [ exports.sentenceAdverbial ], noInsertionIndexes: [ 0 ] })

// [cat-filter] -> [pre-filter-stop-word] [cat-filter] -> (repos that) {pre-filter-stop-word} (I like)
exports.preFilter = g.newSymbol('pre', 'filter', 'stop', 'word').addStopWord('{pre-filter-stop-word}')

// [cat-lhs] -> [left-stop-word] [cat-lhs] -> {left-stop-word} (issues); {left-stop-word} [issue-adjective] (issues)
// [cat-no-relative] -> [left-stop-word] [cat-no-relative]; (repos) {left-stop-word} (I like)
// [cat-filter] -> [left-stop-word] [cat-filter]; (repos that) {left-stop-word} (I like)
exports.left = g.newSymbol('left', 'stop', 'word').addStopWord('{left-stop-word}')