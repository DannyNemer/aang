var g = require('../grammar')
var stopWords = require('./stopWords')
var negation = require('./negation')


exports.notSemantic = negation.semantic
// The default rule set for "not", with all "not" stop-words.
// (people) not (followed by me)
exports.negation = negation.symbol

// (people who) are (followed by me)
exports.beNon1Sg = g.newSymbol('be', 'non', '1', 'sg').addWord({
	insertionCost: 1,
	accepted: [ 'are', 'were' ],
	substitutions: [ 'is|are|be being', 'being|been' ],
})

// (issues that are) <stop> (open/closed)
// (people who are) <stop> (followed by me)
exports.beNon1SgSentenceAdverbial = g.newBinaryRule({ rhs: [ exports.beNon1Sg, stopWords.sentenceAdverbial ] })

// (issues that) are not (open)
// (people who) are not (followers of mine)
// (people who) are not (followed by me)
exports.beNon1SgNegation = g.newBinaryRule({
	rhs: [ exports.beNon1Sg, negation.createRuleSet(exports.beNon1Sg) ],
})

// (pull requests I/{user}/[nom-users]) am/is/are (mentioned in)
exports.beGeneral = g.newSymbol('be', 'general').addVerb({
	insertionCost: 1,
	oneSg: 'am',
	threeSg: 'is',
	pl: 'are',
	presentSubjunctive: 'be',
	presentParticiple: 'being',
	pastParticiple: 'been',
	// FIXME: "being|been" creates ambiguity, e.g.,  "repos that been created" -> "are created" AND "have been created"
	substitutions: [ 'am|is|are|be being' ],
}).addVerb({
	oneSg: 'was',
	threeSg: 'was',
	pl: 'were',
}).addVerb({
	oneSg: 'have been',
	threeSg: 'has been',
	pl: 'have been',
	pastParticiple: 'had been',
	substitutions: [ 'has|have been being' ],
})

// (pull requests I/{user}/[nom-users]) am/is/are not (mentioned in)
exports.beGeneralNegation = g.newBinaryRule({
	rhs: [ exports.beGeneral, negation.createRuleSet(exports.beGeneral) ],
})

// (people who) have (been followed by me)
exports.have = g.newSymbol('have').addVerb({
	insertionCost: 0.8,
	oneSg: 'have',
	threeSg: 'has',
	pl: 'have',
	presentParticiple: 'having',
	// Define as past participle instead of past tense (i.e., preterite) because "had" as an auxiliary verb implies the associated verb is no longer true: "had followed" -> no longer follows.
	pastParticiple: 'had',
})

// (repos I) have (created)
exports.haveOpt = exports.have.createNonterminalOpt()

// (repos I) have <stop> (contributed to)
// No insertion to prevent semantically identical trees from being created, such as "repos I like" suggesting "repos I have liked".
exports.haveNoInsertPreVerbStopWord = g.newBinaryRule({
	rhs: [ exports.have, stopWords.preVerb ],
	noInsertionIndexes: [ 0 ],
})

// (people who have) been (followed by me)
exports.bePast = g.newSymbol('be', 'past').addWord({
	insertionCost: 1,
	accepted: [ 'been' ],
})

// (people who have) <stop> (been followed by me); (people who have) <stop> (been following me)
var haveSentenceAdverbial = g.newBinaryRule({
	rhs: [ exports.have, stopWords.sentenceAdverbial ],
	personNumber: 'pl',
})
exports.haveSentenceAdverbialBePast = g.newBinaryRule({ rhs: [ haveSentenceAdverbial, exports.bePast ] })

// (people I) have not (followed)
// (repos I) have not (liked)
// (people who) have not (liked my repos)
// No insertion for '[have]' to prevent "people I not" suggesting two semantically identical trees: "have not" and "do not".
var haveNotStopWordNegation = negation.createRuleSet(exports.have)
exports.haveNoInsertNegation = g.newBinaryRule({
	rhs: [ exports.have, haveNotStopWordNegation ],
	noInsertionIndexes: [ 0 ],
})
// (people who) have not been (followed by me)
var haveNegationPlSubj = g.newBinaryRule({
	rhs: [ exports.have, haveNotStopWordNegation ],
	personNumber: 'pl',
})
exports.haveNegationBePast = g.newBinaryRule({ rhs: [ haveNegationPlSubj, exports.bePast ] })


var doTerm = g.newSymbol('do').addVerb({
	insertionCost: 0.2,
	oneSg: 'do',
	threeSg: 'does',
	pl: 'do',
	past: 'did',
	presentParticiple: 'doing',
	pastParticiple: 'had|have|has done',
})

// (people I) do not (follow)
var doNotStopWordNegation = negation.createRuleSet(doTerm)
exports.doPresentNegation = g.newSymbol(doTerm.name, 'present', exports.negation.name).addRule({
	rhs: [ doTerm, doNotStopWordNegation ],
})
// (repos/pull-requests I) did not (create)
exports.doPastNegation = g.newSymbol(doTerm.name, 'past', exports.negation.name).addRule({
	rhs: [ doTerm, doNotStopWordNegation ],
	tense: 'past',
})