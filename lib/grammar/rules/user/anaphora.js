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


// (repos my followers like that) they (contributed to)
// (my followers' followers who follow) them; (my followers' repos liked by) them
exports.threePl = g.newSymbol('3', 'pl').addPronoun({
	nom: 'they',
	obj: 'them'
})

// (people who follow my followers and like) their (repos)
exports.threePlPossDet = g.newSymbol(exports.threePl.name, 'poss', 'det').addWord({
	accepted: [ 'their' ],
})

// (people who follow my followers and followers of) theirs
exports.threePlPossPronoun = g.newSymbol(exports.threePl.name, 'poss', 'pronoun').addWord({
	accepted: [ 'theirs' ]
})