var g = require('../grammar')

this.semantic = new g.Semantic({ name: 'me', cost: 0.2, isArg: true })

var oneSg = g.addPronoun({
	name: '1-sg',
	insertionCost: 0.5,
	nom: [ 'I' ],
	obj: [ 'me' ],
	substitutions: [ 'myself' ]
})

// (people) I (follow)
this.nom = oneSg.nom

// (people followed by) me; (people who follow) me
this.obj = oneSg.obj


// my (repositories)
this.poss = g.addWord({
	symbol: new g.Symbol('1', 'sg', 'poss'),
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
g.addWord({
	symbol: this.possOmissible,
	accepted: [ 'my' ]
})