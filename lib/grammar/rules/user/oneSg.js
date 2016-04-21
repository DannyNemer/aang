var g = require('../../grammar')


exports.semanticArg = g.newSemantic({ isArg: true, name: 'me', cost: 0.2 })
var anaphoraCostPenalty = 2.5

// (people) I (follow); (people followed by) me; (people who follow) me
exports.pronoun = g.newSymbol('1', 'sg').addPronoun({
	insertionCost: 0.5,
	restrictInsertion: true,
	nom: 'I',
	obj: 'me',
	substitutions: [
		'myself',
		// Add cost penalty to prioritize `[3-sg]`. These substitutions primarily exist to handle illegal anaphora, and not to vary suggestions. Edits are to expand on input and handle ill-formed input, but not to offer alternatives to input queries.
		{ symbol: 'he|she|him|her', costPenalty: anaphoraCostPenalty },
		{ symbol: 'they|them', costPenalty: anaphoraCostPenalty },
		'you|it',
		'i\'d|i\'ll|i\'m|i\'ve|id|ill|im|ive',
	],
})

// my (repositories)
exports.possDet = g.newInvariableTerm({
	symbolName: g.hyphenate(exports.pronoun.name, 'poss', 'det'),
	insertionCost: 0,
	acceptedTerms: [ 'my' ],
	substitutedTerms: [
		'mine',
		{ term: 'I', costPenalty: 0.2 },
		{ term: 'me', costPenalty: 0.2 },
		{ term: 'his', costPenalty: anaphoraCostPenalty },
		{ term: 'her', costPenalty: anaphoraCostPenalty },
		{ term: 'their', costPenalty: anaphoraCostPenalty },
	],
})

// (repos of) mine
exports.possPronoun = g.newInvariableTerm({
	symbolName: g.hyphenate(exports.pronoun.name, 'poss', 'pronoun'),
	acceptedTerms: [ 'mine' ],
	substitutedTerms: [
		'my',
		{ term: 'I', costPenalty: 0.2 },
		{ term: 'me', costPenalty: 0.2 },
		{ term: 'his', costPenalty: anaphoraCostPenalty },
		{ term: 'hers', costPenalty: anaphoraCostPenalty },
		{ term: 'theirs', costPenalty: anaphoraCostPenalty },
	],
})