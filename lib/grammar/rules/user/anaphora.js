var g = require('../../grammar')

// The semantic argument to be replaced by its third-person-singular antecedent (e.g., '{user}') in anaphora.
exports.threeSgSemanticArg = g.newSemantic({
	isArg: true,
	name: g.hyphenate('anaphor', '3', 'sg'),
	cost: 0.5,
	anaphoric: true,
})

// (repos {user} likes that) he/she (contributed to)
exports.threeSg = g.newSymbol('3', 'sg').addPronoun({
	nom: 'he',
	obj: 'him',
}).addPronoun({
	nom: 'she',
	obj: 'her',
})

// (people who follow {user} and like) his/her (repos)
exports.threeSgPossDet = g.newSymbol(exports.threeSg.name, 'poss', 'det').addWord({
	accepted: [ 'his', 'her' ],
})

// (people who follow {user} and followers of) his/hers
exports.threeSgPossPronoun = g.newSymbol(exports.threeSg.name, 'poss', 'pronoun').addWord({
	accepted: [ 'his', 'hers' ],
})