var g = require('../../grammar')


exports.semantic = g.newSemantic({ isArg: true, name: 'me', cost: 0.2 })

// (people) I (follow); (people followed by) me; (people who follow) me
exports.plain = g.newSymbol('1', 'sg').addPronoun({
	insertionCost: 0.5,
	restrictInsertion: true,
	nom: 'I',
	obj: 'me',
	substitutions: [
		'myself',
		'you|he|she|him|her|they|them|it',
		'i\'d|i\'ll|i\'m|i\'ve|id|ill|im|ive',
	],
})

// my (repositories)
exports.possDet = g.newSymbol(exports.plain.name, 'poss', 'det').addWord({
	insertionCost: 0,
	accepted: [ 'my' ],
	substitutions: [
		'mine',
		{ symbol: 'I', costPenalty: 0.2 },
		{ symbol: 'me', costPenalty: 0.2 },
	]
})

// (repos of) mine
exports.possPronoun = g.newSymbol(exports.plain.name, 'poss', 'pronoun').addWord({
	accepted: [ 'mine' ],
	substitutions: [ 'my', 'I', 'me' ],
})