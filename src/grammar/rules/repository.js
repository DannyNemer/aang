var g = require('../grammar')
var Category = require('./Category')
var poss = require('./poss')
var user = require('./user')
var auxVerbs = require('./auxVerbs')


var repository = new Category({ sg: 'repository', pl: 'repositories' })

var repositoriesTerm = g.addWord({
	name: repository.namePl + '-term',
	insertionCost: 3.9,
	accepted: [ repository.namePl, 'repos' ]
})

var repositoryHeadMayPoss = new g.Symbol(repository.nameSg, 'head', 'may', 'poss')
repositoryHeadMayPoss.addRule({ RHS: [ user.github, repositoriesTerm ] })

// |Github repositories (I starred)
repository.head.addRule({ RHS: [ repositoryHeadMayPoss ] })


var repositoryPossessible = new g.Symbol(repository.nameSg, 'possessible')
// (my) repositories
repositoryPossessible.addRule({ RHS: [ repository.lhs, repositoryHeadMayPoss ] })

// my repositories
repository.noRelativePossessive.addRule({ RHS: [ poss.determiner, repositoryPossessible ]})


// LIKE:
var like = g.addVerb({
	name: 'like',
	insertionCost: 0.8,
	oneOrPl: [ 'like' ],
	threeSg: [ 'likes' ],
	past: [ 'liked' ]
})

// (repositories) liked by me
repository.passive.addRule({ RHS: [ like, user.byObjUsers ], verbForm: 'past' })
// (repositories) I like
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, like ] })
// (repositories) I have liked
var haveLiked = new g.Symbol('have', 'liked')
haveLiked.addRule({ RHS: [ auxVerbs.have, like ], verbForm: 'past' })
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, haveLiked ] })