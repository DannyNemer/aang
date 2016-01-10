var g = require('../../grammar')
var user = require('./user')


var usersGenderSemantic = g.newSemantic({
	name: g.hyphenate(user.namePl, 'gender'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	forbidsMultiple: true,
})
var usersGenderFemaleSemantic = g.reduceSemantic(usersGenderSemantic, g.newSemantic({
	isArg: true,
	name: 'female',
	cost: 0,
}))
var usersGenderMaleSemantic = g.reduceSemantic(usersGenderSemantic, g.newSemantic({
	isArg: true,
	name: 'male',
	cost: 0,
}))

// female (followers of mine); (people who are) female; (my) female (followers)
user.adjective.addRule({ isTerminal: true, rhs: 'female', semantic: usersGenderFemaleSemantic })
// male (followers of mine); (people who are) male; (my) male (followers)
user.adjective.addRule({ isTerminal: true, rhs: 'male', semantic: usersGenderMaleSemantic })

var womenTerm = g.newSymbol('women', 'term').addWord({
	accepted: [ 'women', 'females' ],
})
// women (who follow me); (people who are) women; women
user.head.addRule({ rhs: [ womenTerm ], semantic: usersGenderFemaleSemantic })

var menTerm = g.newSymbol('men', 'term').addWord({
	accepted: [ 'men', 'males' ],
})
// men (who follow me); (people who are) men; men
user.head.addRule({ rhs: [ menTerm ], semantic: usersGenderMaleSemantic })