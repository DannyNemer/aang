var g = require('../grammar')
var category = require('./Category')
var oneSg = require('./oneSg')
var preps = require('./prepositions')
var conjunctions = require('./conjunctions')
var stopWords = require('./stopWords')


// Merges this module with 'user' category
var user = module.exports = category.new({ sg: 'user', pl: 'users', isPerson: true, entities: [ 'Danny', 'Aang' ] })

user.term.addWord({
	insertionCost: 2.5,
	accepted: [ 'people', 'users' ]
})

// |GitHub users (I follow)
user.company = g.newSymbol('company')
user.companyOpt = user.company.createNonterminalOpt()
user.head.addRule({ RHS: [ user.companyOpt, user.term ] })


// Person-number property only exists for nominative case
user.nomUsers = g.newSymbol('nom', user.namePl)
// (repos) people who follow me (like)
user.nomUsers.addRule({ RHS: [ user.plural ], personNumber: 'pl' })
// (people) {user} (follows)
user.nomUsers.addRule({ RHS: [ user.catSg ], personNumber: 'threeSg' })
// (people) I (follow)
user.nomUsers.addRule({ RHS: [ oneSg.plain ], semantic: oneSg.semantic, gramCase: 'nom', personNumber: 'one' })

// (people) I and/or {user} follow
user.nomUsersPlus = conjunctions.addForSymbol(user.nomUsers, { personNumber: 'pl' })


// (repos) I <stop> (created)
user.nomUsersPreVerbStopWords = g.newSymbol('nom', 'users', 'pre', 'verb', 'stop', 'words')
user.nomUsersPreVerbStopWords.addRule({ RHS: [ user.nomUsers, stopWords.preVerb ] })

// (repos) I <stop> (contributed to)
user.nomUsersPlusPreVerbStopWords = g.newSymbol('nom', 'users', 'plus', 'pre', 'verb', 'stop', 'words')
user.nomUsersPlusPreVerbStopWords.addRule({ RHS: [ user.nomUsersPlus, stopWords.preVerb ] })


var objUsers = g.newSymbol('obj', user.namePl)
// (people who follow) people who...; (people followed by) people who...
objUsers.addRule({ RHS: [ user.plural ] })
// (people who follow) {user}; (people followed by) {user}
objUsers.addRule({ RHS: [ user.catSg ] })
// (people who follow) me; (people followed by) me
objUsers.addRule({ RHS: [ oneSg.plain ], semantic: oneSg.semantic, gramCase: 'obj' })

// (people who follow) me and/or {user}; (people followed by) me and/or {user}
user.objUsersPlus = conjunctions.addForSymbol(objUsers)

// (people followed) by me; (repos liked) by me
user.byObjUsersPlus = g.newSymbol('by', 'obj', user.namePl + '+')
user.byObjUsersPlus.addRule({ RHS: [ preps.agent, user.objUsersPlus ] })

// (repos created) by me
user.byObjUsers = g.newSymbol('by', 'obj', user.namePl)
user.byObjUsers.addRule({ RHS: [ preps.agent, objUsers ] })


// {user:'s} (repositories); followers of {user:'s}
// Temporary solution
user.possessive = g.newSymbol(user.nameSg + ':\'s')
user.possessive.addRule({
	terminal: true,
	RHS: g.newEntityCategory({ name: user.nameSg + ':\'s', entities: [ 'Danny\'s' ] })
})


// GENDER:
var usersGenderSemantic = g.newSemantic({ name: g.hyphenate(user.namePl, 'gender'), cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
var usersGenderFemaleSemantic = g.insertSemantic(usersGenderSemantic, g.newSemantic({ name: 'female', isArg: true, cost: 0 }))
var usersGenderMaleSemantic = g.insertSemantic(usersGenderSemantic, g.newSemantic({ name: 'male', isArg: true, cost: 0 }))

// female (followers of mine); (people who are) female
user.adjective.addRule({ terminal: true, RHS: 'female', text: 'female', semantic: usersGenderFemaleSemantic })
// male (followers of mine); (people who are) male
user.adjective.addRule({ terminal: true, RHS: 'male', text: 'male', semantic: usersGenderMaleSemantic })

var womenTerm = g.newSymbol('women', 'term')
womenTerm.addWord({
	accepted: [ 'women', 'females' ]
})
// women (who follow me); (people who are) women; women
user.head.addRule({ RHS: [ womenTerm ], semantic: usersGenderFemaleSemantic })

var menTerm = g.newSymbol('men', 'term')
menTerm.addWord({
	accepted: [ 'men', 'males' ]
})
// men (who follow me); (people who are) men; men
user.head.addRule({ RHS: [ menTerm ], semantic: usersGenderMaleSemantic })