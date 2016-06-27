var g = require('../grammar')
var stopWords = require('./stopWords')
var negation = require('./negation')


exports.notSemantic = negation.semantic
// The default rule set for "not", with all "not" stop-words.
// (people) not (followed by me)
exports.negation = negation.symbol

var beParticiple =  g.newTermSequence({
	symbolName: g.hyphenate('be', 'participle'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'being', 'been' ],
})

// (people who) are (followed by me)
exports.bePl = g.newTermSequence({
	symbolName: g.hyphenate('be', 'pl'),
	insertionCost: 1,
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'are', 'were' ],
	substitutedTerms: [
		// NOTE: Unsure about these substitution (as well as the rule set altogether). Will be replaced.
		[
			g.newTermSequence({
				symbolName: g.hyphenate('be', 'pl', 'substituted', 'forms'),
				type: g.termTypes.INVARIABLE,
				acceptedTerms: [ 'is', 'are', 'be' ],
			}),
			beParticiple,
		],
		beParticiple,
	],
})

// (issues that are) <stop> (open/closed)
// (people who are) <stop> (followed by me)
exports.bePlSentenceAdverbial = g.newBinaryRule({ rhs: [ exports.bePl, stopWords.sentenceAdverbial ] })

// (issues that) are not (open)
// (people who) are not (followers of mine)
// (people who) are not (followed by me)
exports.bePlNegation = g.newBinaryRule({
	rhs: [ exports.bePl, negation.createRuleSet(exports.bePl) ],
})

// (pull requests I/`{user}`/`[nom-users]`) am/is/are (mentioned in)
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
exports.bePresent = g.newVerb({
	symbolName: g.hyphenate('be', 'present'),
	insertionCost: 1,
	tense: 'present',
	verbFormsTermSet: {
		oneSg: 'am',
		threeSg: 'is',
		pl: 'are',
	},
})

// (people who) were employed by `[companies+]`
// NOTE: This rule set is a temporary solution until we finalize the design for "be".
exports.bePast = g.newVerb({
	symbolName: g.hyphenate('be', 'past'),
	insertionCost: 1,
	// Temporarily define `tense` to allow omission of `past` verb form property.
	tense: 'present',
	verbFormsTermSet: {
		oneSg: 'was',
		threeSg: 'was',
		pl: 'were',
	},
})

// (people who have) been (followed by me)
var been = g.newTermSequence({
	symbolName: 'been',
	insertionCost: 1,
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'been' ],
	substitutedTerms: [ 'be' ],
})

// (pull requests I/`{user}`/`[nom-users]`) am/is/are not (mentioned in)
exports.beNegation = g.newBinaryRule({
	rhs: [ exports.be, negation.createRuleSet(exports.be) ],
})

// (people who) have (been followed by me)
exports.have = g.newVerb({
	symbolName: 'have',
	insertionCost: 0.8,
	/**
	 * Exclude "had", the past tense of the auxiliary verb "have", from display text because it yields the past perfect construction. Past perfect implies the event/action took place in the past and excludes the present.
	 *
	 * The past perfect implication may be undesirable if input when the DB behind the NLI lacks this specific information. For example, "people I had followed" means people the user previously followed and no longer follows. If the DB lacks this information and can only return people the user currently follows, then correct the display text to "have" to accurately reflect the returned data.
	 */
	noPastDisplayText: true,
	verbFormsTermSet: {
		oneSg: 'have',
		threeSg: 'has',
		pl: 'have',
		past: 'had',
		presentParticiple: 'having',
	},
})

// (people who) have <stop> (been followed by me)
var haveSentenceAdverbial = g.newBinaryRule({
	rhs: [ exports.have, stopWords.sentenceAdverbial ],
	// Dictates inflection of `[have]`:
	//   "(people who) `[have]` (been ...)" -> "(people who) have (been ...)"
	grammaticalForm: { 0: 'infinitive' },
})
exports.haveSentenceAdverbialBeen = g.newBinaryRule({ rhs: [ haveSentenceAdverbial, been ] })

// Temporary rule until finalizing use of stop-words.
exports.haveBeen = g.newBinaryRule({
	rhs: [ exports.have, been ],
})


var haveNotStopWordNegation = negation.createRuleSet(exports.have)

/**
 * (people I) have not (followed)
 * (repos `{user}`) has not (liked)
 * (people who) have not (liked my repos)
 *
 * Prevent `[have]` insertion to prevent `pfsearch` from wastefully creating multiple semantically identical trees, which it ultimately discard. For example, were this insertion enabled, it would yield the following semantically duplicate suggestions:
 *   Stop:  "(people who) not like" -> "(people who) do not like", "(people who) have not liked"
 */
exports.haveNoInsertNegation = g.newBinaryRule({
	rhs: [ exports.have, haveNotStopWordNegation ],
	noInsertionIndexes: [ 0 ],
})

// (repos that) have not been (liked by me)
exports.haveNegationBeen = g.newBinaryRule({
	rhs: [
		// NOTE: Could make this rule a term sequence and move `grammaticalForm` to the outer rule, but then `[have]` is not conjugated in the insertion text of the insertion rule created from this inner binary rule.
		g.newBinaryRule({
			// Enable `[have]` insertion for the following suggestion:
			//   "(repos that) not (been ...)" -> "(repos that) have not (been ...)"
			rhs: [ exports.have, haveNotStopWordNegation ],
			// Dictates inflection of `[have]`:
			//   "(people who) `[have]` not (been ...)" -> "(people who) have not (been ...)"
			grammaticalForm: { 0: 'infinitive' },
		}),
		been,
	],
})

var doVerb = g.newVerb({
	symbolName: 'do',
	insertionCost: 0.2,
	verbFormsTermSet: {
		oneSg: 'do',
		threeSg: 'does',
		pl: 'do',
		past: 'did',
		presentParticiple: 'doing',
		// NOTE: Could integrate `[have]` as a leading stop-word:
		//   "(repos `{user}`) has done (not created)" -> "(repos `{user}`) did (not create)"
		pastParticiple: 'done',
	},
})

var doNotStopWordNegation = negation.createRuleSet(doVerb)
// (people I) do not (follow)
exports.doNegation = g.newTermSequenceBinarySymbol({
	type: g.termTypes.VERB,
	termPair: [ doVerb, doNotStopWordNegation ],
})
// (repos/pull-requests I) did not (create)
exports.doPastNegation = g.newSymbol(doVerb.name, 'past', exports.negation.name).addRule({
	rhs: [ doVerb, doNotStopWordNegation ],
	// Dictates inflection of `[do]`:
	//   "(repos I) [do] not (create)" -> "(repos I) did not (create)"
	grammaticalForm: { 0: 'past' },
})

// (issues that) do not have (`<int>` comments)
exports.doPresentNegationHave = g.newBinaryRule({
	rhs: [ exports.doNegation, exports.have ],
	// Dictates inflection of `[do]` and `[have]`:
	//   "(issues that) `[do]` not `[have]` (...)" -> "(issues that) do not have (...)"
	grammaticalForm: { 0: 'infinitive', 1: 'infinitive' },
})