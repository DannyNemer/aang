var g = require('../grammar')

exports.semantic = g.newSemantic({ name: 'me', cost: 0.2, isArg: true })

// (people) I (follow); (people followed by) me; (people who follow) me
exports.plain = new g.Symbol('1', 'sg')
exports.plain.addPronoun({
	insertionCost: 0.5,
	nom: 'I',
	obj: 'me',
	substitutions: [ 'myself' ]
})

// my (repositories)
exports.poss = new g.Symbol('1', 'sg', 'poss')
exports.poss.addWord({
	insertionCost: 0,
	accepted: [ 'my' ]
})
// exports.poss.addRule({ terminal: true, RHS: g.emptySymbol })

// my (female followers' repos)
// Store semantic on terminal symbol because LHS will be in a binary reduction
exports.possSpecial = new g.Symbol('1', 'sg', 'poss', 'special')
exports.possSpecial.addRule({ terminal: true, RHS: 'my', text: 'my', insertionCost: 0, semantic: exports.semantic })

// my (followers)
// WRONG: Use <empty> to simulate an insertion cost of 0 with a base cost of 1e-6
// WRONG: Otherwise, trees with and without the insertion would have the same cost
// Still unsure why
exports.possOmissible = new g.Symbol('1', 'sg', 'poss', 'omissible'),
exports.possOmissible.addRule({ terminal: true, RHS: g.emptySymbol, text: 'my' })
exports.possOmissible.addWord({
	accepted: [ 'my' ]
})