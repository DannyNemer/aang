var g = require('../../grammar')
var anaphora = require('./anaphora')


exports.semanticArg = g.newSemantic({
	isArg: true,
	name: 'me',
	// Currently, perfectly matched entities have cost of 0, which compares poorly to `me`. This will change when properly implementing entity recognition, which will assign costs to matches with greater complexity than primitive token matching.
	cost: 0.2,
})

var firstPersonCostPenalty = 0.2
var thirdPersonCostPenalty = 2.5

// (people) I (follow)
// (people followed by) me
// (people who follow) me
var oneSgPronoun = g.newPronoun({
	symbolName: g.hyphenate(1, 'sg', 'pronoun'),
	insertionCost: 0.5,
	pronounFormsTermSet: {
		nom: 'I',
		obj: 'me',
	},
})

exports.pronoun = g.newTermSequence({
	symbolName: g.hyphenate(1, 'sg'),
	type: 'pronoun',
	acceptedTerms: [
		oneSgPronoun,
	],
	substitutedTerms: [
		// Exclude "my" as a substituted term, which otherwise halves entire test suite benchmark.
		'myself',
		'you',
		'it',
		// Add cost penalty when substituting third-person pronouns with first-person to prioritize correct matches to anaphoric query. These substitutions primarily exist to handle illegal anaphora, and not to vary suggestions. Edits exist to expand input and correct ill-formed input, and not to suggest alternative queries.
		{ term: anaphora.threeSg, costPenalty: thirdPersonCostPenalty },
		{ term: anaphora.threePl, costPenalty: thirdPersonCostPenalty },
		g.newTermSequence({
			symbolName: g.hyphenate(1, 'sg', 'nominative', 'contractions'),
			type: 'invariable',
			acceptedTerms: [
				'i\'d', 'id',
				'i\'ll', 'ill',
				'i\'m', 'im',
				// Perhaps substitute with "I have".
				'i\'ve', 'ive',
			],
		}),
	],
})

// my (repositories)
exports.possDet = g.newTermSequence({
	symbolName: g.hyphenate(exports.pronoun.name, 'poss', 'det'),
	/**
	 * The insertion cost for "my" is tricky. If too low, it is common for each alternate query suggestion to be "my + ${preceding_suggestion}".
	 *
	 * Yet, sometimes prepending "my" yields an excellent second suggestion; e.g., "open issues" -> "my open issues".
	 *
	 * Yet again, it is possible to remove the insertion cost and use semantically identical insertions: "repos" -> "repos I created". This insertion disorients the user less by expanding via the end of the input query.
	 */
	insertionCost: 1,
	type: 'invariable',
	acceptedTerms: [ 'my' ],
	substitutedTerms: [
		'mine',
		{ term: oneSgPronoun, costPenalty: firstPersonCostPenalty },
		{ term: anaphora.threeSgPossDet, costPenalty: thirdPersonCostPenalty },
		{ term: anaphora.threePlPossDet, costPenalty: thirdPersonCostPenalty },
	],
})

// (repos of) mine
exports.possPronoun = g.newTermSequence({
	symbolName: g.hyphenate(exports.pronoun.name, 'poss', 'pronoun'),
	insertionCost: 1.5,
	type: 'invariable',
	acceptedTerms: [ 'mine' ],
	substitutedTerms: [
		'my',
		{ term: oneSgPronoun, costPenalty: firstPersonCostPenalty },
		{ term: anaphora.threeSgPossPronoun, costPenalty: thirdPersonCostPenalty },
		{ term: anaphora.threePlPossPronoun, costPenalty: thirdPersonCostPenalty },
	],
})