var g = require('../grammar')


exports.semantic = g.newSemantic({ isArg: true, name: 'me', cost: 0.2 })

// (people) I (follow); (people followed by) me; (people who follow) me
exports.plain = g.newSymbol('1', 'sg').addPronoun({
	insertionCost: 0.5,
	nom: 'I',
	obj: 'me',
	substitutions: [ 'myself', 'you|he|she|him|her|they|them|it' ],
})

// my (repositories)
exports.poss = g.newSymbol(exports.plain.name, 'poss').addWord({
	insertionCost: 0,
	accepted: [ 'my' ],
})