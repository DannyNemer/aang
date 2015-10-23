var g = require('../grammar')
var stopWords = require('./stopWords')


exports.notSemantic = g.newSemantic({ name: 'not', cost: 0.5, minParams: 1, maxParams: 1 })

exports.negation = g.newSymbol('negation')
exports.negation.addWord({
	accepted: [ 'not' ],
	substitutions: [ 'are|can|could|did|does|do|had|has|have|is|should|was|were|will|would not' ],
})


// (people who) are (followed by me)
exports.beNon1Sg = g.newSymbol('be', 'non', '1', 'sg')
exports.beNon1Sg.addWord({
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
exports.beGeneral = g.newSymbol('be', 'general')
exports.beGeneral.addVerb({
	insertionCost: 1,
	oneSg: [ 'am' ],
	pl: [ 'are', 'were' ],
	oneOrPl: [ 'have been' ],
	threeSg: [ 'is', 'has been' ],
	oneOrThreeSg: [ 'was' ],
})

// (pull requests I/{user}/[nom-users]) am/is/are not (mentioned in)
exports.beGeneralNegation = g.newBinaryRule({ RHS: [ exports.beGeneral, exports.negation ] })


// (people who) have (been followed by me)
// - No past tense ('had') because it implies semantic no longer true; "had liked" -> no longer liked
exports.have = g.newSymbol('have')
exports.have.addVerb({
	insertionCost: 0.8,
	oneOrPl: [ 'have' ],
	threeSg: [ 'has' ],
	substitutions: [ 'had' ],
})

// (repos I) have <stop> (contributed to)
// No insertion to prevent semantically identical trees from being created, such as "repos I like" suggesting "repos I have liked".
exports.haveNoInsertPreVerbStopWord = g.newBinaryRule({ RHS: [ exports.have, stopWords.preVerb ], noInsertionIndexes: [ 0 ] })

// (people who have) been (followed by me)
exports.bePast = g.newSymbol('be', 'past')
exports.bePast.addWord({
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


var doPresent = g.newSymbol('do', 'present')
doPresent.addVerb({
	insertionCost: 0.2,
	oneOrPl: [ 'do' ],
	threeSg: [ 'does' ],
	substitutions: [ 'did' ],
})

// (people who) do not (follow me)
// (people I/{user}/[nom-users]) do/does not (follow)
exports.doPresentNegation = g.newBinaryRule({ RHS: [ doPresent, exports.negation ] })

var doPast = g.newSymbol('do', 'past')
doPast.addWord({
	insertionCost: 0.2,
	accepted: [ 'did' ],
	substitutions: [ 'do', 'does' ],
})

// (issues/pull-requests I/{user}/[nom-users]) did not (create)
exports.doPastNegation = g.newBinaryRule({ RHS: [ doPast, exports.negation ] })