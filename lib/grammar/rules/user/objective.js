var g = require('../../grammar')
var user = require('./user')
var oneSg = require('./oneSg')
var anaphora = require('./anaphora')
var conjunction = require('../conjunction')
var preps = require('../prepositions')


exports.objUsers = g.newSymbol('obj', user.namePl)
// (people who follow) `{user}`
// (people followed by) `{user}`
exports.objUsers.addRule({
	rhs: [ user.sg ],
})
// (people who follow) me
// (people followed by) me
exports.objUsers.addRule({
	rhs: [ {
		symbol: oneSg.pronoun,
		grammaticalForm: 'obj',
	} ],
	semantic: oneSg.semanticArg,
})
// (`{user:'s}` followers followed by) him|her
exports.objUsers.addRule({
	rhs: [ {
		symbol: anaphora.threeSg,
		grammaticalForm: 'obj',
	} ],
	anaphoraPersonNumber: 'threeSg',
})
// (people who follow) people who...
// (people followed by) people who...
exports.objUsers.addRule({
	rhs: [ user.plural ],
})
// (my followers' followers who follow) them
// (my followers' repos liked by) them
exports.objUsers.addRule({
	rhs: [ {
		symbol: anaphora.threePl,
		grammaticalForm: 'obj',
	} ],
	anaphoraPersonNumber: 'threePl',
})

/**
 * Excludes the following user objective because they are nearly semantically useless:
 *   1. `[obj-users]` -> "anyone", `all(users)` => "(people who follow) anyone", "(people followed by) anyone"
 *   2. `[obj-users]` -> "people", `all(users)` => "(people who follow) people", "(people followed by) people"
 * For example, "repos like by people/anyone" returns the same (database) results as "(all) repos", though the grammar does not support the latter query.
 */


// (people who follow) me/`{user}`/people-who... [and/or `[obj-users+]`]
// (repos liked by) me/`{user}`/people-who... [and/or `[obj-users+]`]
exports.objUsersPlus = conjunction.create(exports.objUsers)

// (repos liked) by me/`{user}`/people-who... [and/or `[obj-users+]`]
exports.byObjUsersPlus = g.newBinaryRule({
	rhs: [ preps.agent, exports.objUsersPlus ],
})
// (repos created) by me/`{user}`/people-who... [or `[obj-users+-disjunction]`]
// For use with semantics with `forbidsMultipleIntersection`.
exports.objUsersPlusDisjunction = conjunction.createDisjunctionSet(exports.objUsers)
exports.byObjUsersPlusDisjunction = g.newBinaryRule({
	rhs: [ preps.agent, exports.objUsersPlusDisjunction ],
})