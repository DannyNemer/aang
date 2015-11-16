var g = require('../grammar')
var stopWords = require('./stopWords')


exports.notSemantic = g.newSemantic({ name: 'not', cost: 0.5, minParams: 1, maxParams: 1 })

exports.negation = g.newSymbol('negation').addWord({
	accepted: [ 'not' ],
	substitutions: [
		[
			g.newSymbol('not', 'auxiliary', 'verb', 'substitution').addBlankSet({
				terms: [ 'are', 'can', 'could', 'did', 'does', 'do', 'had', 'has', 'have', 'is', 'should', 'was', 'were', 'will', 'would' ]
			}),
			g.newSymbol('not', 'substitution').addBlankSet({
				terms: [ 'not' ]
			}),
		],
		g.newSymbol('not', 'contraction', 'substitution').addBlankSet({
			terms: [ 'aren\'t', 'can\'t', 'couldn\'t', 'didn\'t', 'doesn\'t', 'don\'t', 'hadn\'t', 'hasn\'t', 'haven\'t', 'isn\'t', 'shouldn\'t', 'wasn\'t', 'weren\'t', 'won\'t', 'wouldn\'t' ]
		}),
	],
})


// (people who) are (followed by me)
exports.beNon1Sg = g.newSymbol('be', 'non', '1', 'sg').addWord({
	insertionCost: 1,
	accepted: [ 'are', 'were' ],
	substitutions: [ 'is|are|be being', 'being|been' ],
})

// (issues that are) <stop> (open/closed)
// (people who are) <stop> (followed by me)
exports.beNon1SgSentenceAdverbial = g.newBinaryRule({ RHS: [ exports.beNon1Sg, stopWords.sentenceAdverbial ] })

// (issues that) are not (open)
// (people who) are not (followers of mine)
// (people who) are not (followed by me)
exports.beNon1SgNegation = g.newBinaryRule({ RHS: [ exports.beNon1Sg, exports.negation ] })


// (pull requests I/{user}/[nom-users]) am/is/are (mentioned in)
exports.beGeneral = g.newSymbol('be', 'general').addVerb({
	insertionCost: 1,
	oneSg: 'am',
	threeSg: 'is',
	pl: 'are',
	substitutions: [ 'be', 'being|been', 'am|is|are|be being' ],
}).addVerb({
	oneSg: 'was',
	threeSg: 'was',
	pl: 'were',
}).addVerb({
	oneSg: 'have been',
	threeSg: 'has been',
	pl: 'have been',
	substitutions: [ 'has|have been being' ],
})

// (pull requests I/{user}/[nom-users]) am/is/are not (mentioned in)
exports.beGeneralNegation = g.newBinaryRule({ RHS: [ exports.beGeneral, exports.negation ] })


// (people who) have (been followed by me)
// - No past tense ('had') because it implies semantic no longer true; "had liked" -> no longer liked.
exports.have = g.newSymbol('have').addVerb({
	insertionCost: 0.8,
	oneSg: 'have',
	threeSg: 'has',
	pl: 'have',
	substitutions: [ 'had' ],
})

// (repos I) have (created)
exports.haveOpt = exports.have.createNonterminalOpt()

// (repos I) have <stop> (contributed to)
// No insertion to prevent semantically identical trees from being created, such as "repos I like" suggesting "repos I have liked".
exports.haveNoInsertPreVerbStopWord = g.newBinaryRule({ RHS: [ exports.have, stopWords.preVerb ], noInsertionIndexes: [ 0 ] })

// (people who have) been (followed by me)
exports.bePast = g.newSymbol('be', 'past').addWord({
	insertionCost: 1,
	accepted: [ 'been' ],
})

// (people who have) <stop> (been folllowed by me); (people who have) <stop> (been following me)
var haveSentenceAdverbial = g.newBinaryRule({ RHS: [ exports.have, stopWords.sentenceAdverbial ], personNumber: 'pl' })
exports.haveSentenceAdverbialBePast = g.newBinaryRule({ RHS: [ haveSentenceAdverbial, exports.bePast ] })

// (people I) have not (followed)
// (repos I) have not (liked)
// (people who) have not (liked my repos)
// No insertion for '[have]' to prevent "people I not" suggesting two semantically identical trees: "have not" and "do not".
exports.haveNoInsertNegation = g.newBinaryRule({ RHS: [ exports.have, exports.negation ], noInsertionIndexes: [ 0 ] })
// (people who) have not been (followed by me)
var haveNegationPlSubj = g.newBinaryRule({ RHS: [ exports.have, exports.negation ], personNumber: 'pl' })
exports.haveNegationBePast = g.newBinaryRule({ RHS: [ haveNegationPlSubj, exports.bePast ] })


var doTerm = g.newSymbol('do', 'term').addVerb({
	insertionCost: 0.2,
	oneSg: 'do',
	threeSg: 'does',
	pl: 'do',
	past: 'did',
	substitutions: [ 'doing', 'had|have|has done' ],
})

exports.doPresentNegation = g.newSymbol(doTerm.name, 'present', exports.negation.name)
exports.doPresentNegation.addRule({ RHS: [ doTerm, exports.negation ] })

exports.doPastNegation = g.newSymbol(doTerm.name, 'past', exports.negation.name)
exports.doPastNegation.addRule({ RHS: [ doTerm, exports.negation ], tense: 'past' })