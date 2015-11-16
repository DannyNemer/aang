var g = require('../grammar')


exports.semantic = g.newSemantic({ isArg: true, name: 'me', cost: 0.2 })

// (people) I (follow); (people followed by) me; (people who follow) me
exports.plain = g.newSymbol('1', 'sg').addPronoun({
	insertionCost: 0.5,
	nom: 'I',
	obj: 'me',
	substitutions: [
		'myself',
		g.newBlankSet('you', 'he', 'she', 'him', 'her', 'they', 'them', 'it'),
		g.newBlankSet('i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'id', 'ill', 'im', 'ive'),
	],
})

// my (repositories)
exports.possDet = g.newSymbol(exports.plain.name, 'poss', 'det').addWord({
	insertionCost: 0,
	accepted: [ 'my' ],
	substitutions: [ 'mine' ]
})

// (repos of) mine
exports.possPronoun = g.newSymbol(exports.plain.name, 'poss', 'pronoun').addWord({
	accepted: [ 'mine' ],
	substitutions: [ 'my', 'I', 'me' ],
})