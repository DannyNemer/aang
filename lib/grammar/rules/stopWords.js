var g = require('../grammar')



var stopFrom = g.newTermSequence({
	symbolName: g.hyphenate('stop', 'from'),
	insertionCost: 0.5,
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'from', 'in', 'within' ],
})

var stopThe = g.newTermSequence({
	symbolName: g.hyphenate('stop', 'the'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'the' ],
})

// Phrases with the same function as an adverb.
// (people I follow) `[sentence-adverbial]`
exports.sentenceAdverbial = g.newTermSequence({
	symbolName: g.hyphenate('sentence', 'adverbial'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [
		{ term: 'never', costPenalty: 1.5 },
		{
			term: g.newTermSequence({
				symbolName: g.hyphenate('stop', 'frequently'),
				type: g.termTypes.INVARIABLE,
				acceptedTerms: [ 'frequently', 'mostly', 'often', 'usually', 'always' ],
			}),
			costPenalty: 2,
		}, {
			term: [
				g.newTermSequence({
					symbolName: g.hyphenate('stop', 'month', 'modifier'),
					insertionCost: 1,
					type: g.termTypes.INVARIABLE,
					acceptedTerms: [ 'this', 'next', 'last' ],
				}),
				g.newTermSequence({
					symbolName: g.hyphenate('stop', 'month'),
					type: g.termTypes.INVARIABLE,
					acceptedTerms: [ 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december' ],
				}),
			],
			costPenalty: 2,
		}, {
			term: [
				g.newTermSequence({
					symbolName: g.hyphenate('stop', 'time', 'period', 'modifier'),
					insertionCost: 1.5,
					type: g.termTypes.INVARIABLE,
					acceptedTerms: [ 'last' ],
				}),
				g.newTermSequence({
					symbolName: g.hyphenate('stop', 'time', 'period'),
					type: g.termTypes.INVARIABLE,
					acceptedTerms: [ 'night', 'weekend' ],
				}),
			],
			costPenalty: 2,
		}, {
			term: 'currently',
			costPenalty: 2,
		}, {
			term: [
				g.newTermSequence({
					symbolName: g.hyphenate('stop', 'in'),
					insertionCost: 0.5,
					type: g.termTypes.INVARIABLE,
					acceptedTerms: [ 'in' ],
				}),
				[
					stopThe,
					g.newTermSequence({
						symbolName: g.hyphenate('stop', 'past'),
						type: g.termTypes.INVARIABLE,
						acceptedTerms: [ 'past' ],
					}),
				],
			],
			costPenalty: 2,
		}, {
			term: [
				g.newTermSequence({
					symbolName: g.hyphenate('stop', 'time', 'period', 2, 'modifier'),
					type: g.termTypes.INVARIABLE,
					acceptedTerms: [ 'this', 'the' ],
				}),
				g.newTermSequence({
					symbolName: g.hyphenate('stop', 'time', 'period', 2),
					insertionCost: 0.5,
					type: g.termTypes.INVARIABLE,
					acceptedTerms: [ 'morning', 'afternoon', 'evening', 'weekend', 'week', 'month', 'year' ],
				}),
			],
			costPenalty: 2,
		}, {
			term: [
				g.newTermSequence({
					symbolName: g.hyphenate('stop', 'from', 'the', 'opt'),
					type: g.termTypes.INVARIABLE,
					acceptedTerms: [
						stopFrom,
						[ stopFrom, stopThe ],
					],
				}),
				[
					g.newTermSequence({
						symbolName: g.hyphenate('stop', 'time', 'period', 3, 'modifier'),
						type: g.termTypes.INVARIABLE,
						insertionCost: 1.5,
						acceptedTerms: [ 'last', 'past', 'next' ],
					}),
					g.newTermSequence({
						symbolName: g.hyphenate('stop', 'time', 'period', 3),
						insertionCost: 0.5,
						type: g.termTypes.INVARIABLE,
						acceptedTerms: [ 'hour', 'day', 'week', 'month', 'year' ],
					}),
				],
			],
			costPenalty: 2,
		},
	],
})

// Note: Temporarily not in use.
// Stop-words that preceed verbs.
// (people I) `[pre-verb-stop-word]` (follow)
// exports.preVerb = g.newSymbol('pre', 'verb', 'stop', 'word').addStopWords(
// 	{ symbol: 'to', costPenalty: 1 },
// 	{ symbol: 'can|could|do|may|might|must|shall|should|will|would', costPenalty: 1 },
// 	{ symbol: 'currently|presently|now|previously|formerly|ever|will', costPenalty: 1 },
// 	{ symbol: '|have|has|had|was|were|is|are|am|be got|getting|gotten', costPenalty: 1 },
// 	{ symbol: 'used to', costPenalty: 2 }
// )
// // Prevent insertion because `[pre-verb-stop-word]` already has `<empty>`.
// exports.preVerb.addRule({
// 	rhs: [ {
// 		symbol: exports.sentenceAdverbial,
// 		noInsert: true,
// 	} ],
// })

// Note: It is possible stop-word entity categories are excluded in production, however, their implementation exists to support them whether or not they are used.
// [cat-filter] -> [pre-filter-stop-word] [cat-filter] -> (repos that) {pre-filter-stop-word} (I like)
exports.preFilter = g.newSymbol('pre', 'filter', 'stop', 'word').addStopWords('{pre-filter-stop-word}')

// [cat-lhs] -> [left-stop-word] [cat-lhs] -> {left-stop-word} (issues); {left-stop-word} [issue-adjective] (issues)
// [cat-no-relative] -> [left-stop-word] [cat-no-relative]; (repos) {left-stop-word} (I like)
// [cat-filter] -> [left-stop-word] [cat-filter]; (repos that) {left-stop-word} (I like)
exports.left = g.newSymbol('left', 'stop', 'word').addStopWords('{left-stop-word}')