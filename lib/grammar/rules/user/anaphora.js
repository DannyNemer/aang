var g = require('../../grammar')

// The semantic argument to be replaced by its third-person-singular antecedent (e.g., '{user}') in anaphora.
exports.threeSgSemanticArg = g.newSemantic({
	isArg: true,
	name: g.hyphenate('anaphor', '3', 'sg'),
	cost: 0.5,
	anaphoric: true,
})

// (people who follow {user} and like) his/her (repos)
exports.threeSgPossDet = g.newSymbol('3', 'sg', 'poss', 'det').addWord({
	accepted: [ 'his', 'her' ],
})