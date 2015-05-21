var g = require('../grammar')

this.semantic = g.newSemantic({ name: 'me', cost: 0.2, isArg: true })

// (people) I (follow); (people followed by) me; (people who follow) me
this.plain = new g.Symbol('1', 'sg')
this.plain.addPronoun({
	insertionCost: 0.5,
	nom: 'I',
	obj: 'me',
	substitutions: [ 'myself' ]
})

// my (repositories)
this.poss = new g.Symbol('1', 'sg', 'poss')
this.poss.addWord({
	insertionCost: 0,
	accepted: [ 'my' ]
})
// this.poss.addRule({ terminal: true, RHS: g.emptySymbol })

// my (followers)
// WRONG: Use <empty> to simulate an insertion cost of 0 with a base cost of 1e-6
// WRONG: Otherwise, trees with and without the insertion would have the same cost
// Still unsure why
this.possOmissible = new g.Symbol('1', 'sg', 'poss', 'omissible'),
this.possOmissible.addRule({ terminal: true, RHS: g.emptySymbol, text: 'my' })
this.possOmissible.addWord({
	accepted: [ 'my' ]
})