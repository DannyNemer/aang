const g = require('../../grammar')


exports.semanticArg = g.newSemantic({ isArg: true, name: 'me', cost: 0.2 })
const anaphoraCostPenalty = 2.5

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
exports.possDet = g.newSymbol(exports.pronoun.name, 'poss', 'det').addWord({
	insertionCost: 0,
	accepted: [ 'my' ],
	substitutions: [
		'mine',
		{ symbol: 'I', costPenalty: 0.2 },
		{ symbol: 'me', costPenalty: 0.2 },
		{ symbol: 'his|her', costPenalty: anaphoraCostPenalty },
		{ symbol: 'their', costPenalty: anaphoraCostPenalty },
	]
})

// (repos of) mine
exports.possPronoun = g.newSymbol(exports.pronoun.name, 'poss', 'pronoun').addWord({
	accepted: [ 'mine' ],
	substitutions: [
		'my',
		{ symbol: 'I', costPenalty: 0.2 },
		{ symbol: 'me', costPenalty: 0.2 },
		{ symbol: 'his|hers', costPenalty: anaphoraCostPenalty },
		{ symbol: 'theirs', costPenalty: anaphoraCostPenalty },
	],
})