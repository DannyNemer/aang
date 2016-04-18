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
exports.be = g.newSymbol('be').addVerb({
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

// (people who) are employed by `[companies+]`
// NOTE: This rule set is a temporary solution until we finalize the design for "be".
exports.bePresent = g.newVerbSet({
	symbolName: g.hyphenate('be', 'present'),
	insertionCost: 1,
	acceptedVerbTermSets: [ {
		oneSg: 'am',
		threeSg: 'is',
		pl: 'are',
	} ],
})

// (people who) were employed by `[companies+]`
// NOTE: This rule set is a temporary solution until we finalize the design for "be".
exports.bePast = g.newVerbSet({
	symbolName: g.hyphenate('be', 'past'),
	insertionCost: 1,
	acceptedVerbTermSets: [ {
		oneSg: 'was',
		threeSg: 'was',
		pl: 'were',
	} ],
})

// (people who have) been (followed by me)
var been = g.newSymbol('been').addWord({
	insertionCost: 1,
	accepted: [ 'been' ],
	substitutions: [ 'be' ],
})

// (pull requests I/{user}/[nom-users]) am/is/are not (mentioned in)
exports.beNegation = g.newBinaryRule({
	rhs: [ exports.be, negation.createRuleSet(exports.be) ],
})

// (people who) have (been followed by me)
exports.have = g.newVerbSet({
	symbolName: 'have',
	insertionCost: 0.8,
	acceptedVerbTermSets: [ {
		oneSg: 'have',
		threeSg: 'has',
		pl: 'have',
		presentParticiple: 'having',
		/**
		 * Define "had" as past participle instead of past tense (i.e., preterite) because "had" as an auxiliary verb implies the associated verb is no longer true: "had followed" -> no longer follows.[pastParticiple description]
		 *
		 * Also, do not define "had" as `past`, otherwise the nonterminal rule `[have]``[create]`, defined with grammatical form "past", would yield "had created".
		 */
		pastParticiple: 'had',
	} ],
})

// (people who have) <stop> (been followed by me); (people who have) <stop> (been following me)
var haveSentenceAdverbial = g.newBinaryRule({
	rhs: [ exports.have, stopWords.sentenceAdverbial ],
	personNumber: 'pl',
})
exports.haveSentenceAdverbialBeen = g.newBinaryRule({ rhs: [ haveSentenceAdverbial, been ] })

// Temporary rule until finalizing use of stop-words.
exports.haveBeen = g.newBinaryRule({
	rhs: [ exports.have, been ],
})

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
exports.haveNegationBeen = g.newBinaryRule({ rhs: [ haveNegationPlSubj, been ] })


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
	grammaticalForm: 'past',
})

// (issues that) do not have (`<int>` comments)
exports.doPresentNegationHave = g.newBinaryRule({
	rhs: [ exports.doPresentNegation, exports.have ],
})