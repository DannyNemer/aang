var g = require('../../grammar')

// (repos {user} likes that) he/she (contributed to)
// ({user:'s} followers who follow) him/her; ({user:'s} followers followed by) him/her
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