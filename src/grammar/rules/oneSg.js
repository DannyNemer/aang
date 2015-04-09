var g = require('../grammar')

this.semantic = new g.Semantic({ name: 'me', cost: 0.2, arg: true })

// (people) I (follow); (people followed by) me; (people who follow) me
this.plain = g.addPronoun({
	symbol: new g.Symbol('1', 'sg'),
	insertionCost: 0.5,
	nom: 'I',
	obj: 'me',
	substitutions: [ 'myself' ]
})

// my (repositories)
this.poss = g.addWord({
	symbol: new g.Symbol('1', 'sg', 'poss'),
	accepted: [ 'my' ]
})

// my (followers)
// Use <empty> to simulate an insertion cost of 0 with a base cost of 1e-6
// Otherwise, trees with and without the insertion would have the same cost
this.possOmissible = new g.Symbol('1', 'sg', 'poss', 'omissible'),
this.possOmissible.addRule({ terminal: true, RHS: g.emptyTermSym, text: 'my' })
g.addWord({
	symbol: this.possOmissible,
	accepted: [ 'my' ]
})