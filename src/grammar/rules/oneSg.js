var g = require('../grammar')

this.semantic = new g.Semantic({ name: 'me', cost: 0.2, arg: true })

// (people) I (follow); (people followed by) me; (people who follow) me
this.plain = g.addPronoun({
	name: '1-sg',
	insertionCost: 0,
	nom: 'I',
	obj: 'me',
	substitutions: [ 'myself' ]
})

// my (repositories)
this.poss = g.addWord({
	name: '1-sg-poss',
	accepted: [ 'my' ]
})

// my (followers)
this.possOmissible = g.addWord({
	name: '1-sg-poss-omissible',
	accepted: [ 'my' ],
	substitutions: [ g.emptyTermSym ] // blank should be first rule (it is not currently)
})