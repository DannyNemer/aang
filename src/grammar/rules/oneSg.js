var g = require('../grammar')

exports.semantic = g.newSemantic({ name: 'me', cost: 0.2, isArg: true })

// (people) I (follow); (people followed by) me; (people who follow) me
exports.plain = new g.Symbol('1', 'sg')
exports.plain.addPronoun({
	insertionCost: 0.5,
	nom: 'I',
	obj: 'me',
	substitutions: [ 'myself', 'you|he|she|him|her|they|them|it' ]
})

// my (repositories)
exports.poss = new g.Symbol('1', 'sg', 'poss')
exports.poss.addWord({
	insertionCost: 0,
	accepted: [ 'my' ]
})