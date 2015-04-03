var g = require('../grammar')

this.semantic = new g.Semantic({ name: 'me', cost: 0.2, arg: true })

// (people) I (follow); (people followed by) me; (people who follow) me
this.plain = g.addPronoun({
	symbol: new g.Symbol('1', 'sg'),
	insertionCost: 0,
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
this.possOmissible = g.addWord({
	symbol: new g.Symbol('1', 'sg', 'poss', 'omissible'),
	insertionCost: 0,
	accepted: [ 'my' ]
})