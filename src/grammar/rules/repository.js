var g = require('../grammar')
var Category = require('./Category')
var poss = require('./poss')
var user = require('./user') // "github"


var repository = new Category({ sg: 'repository', pl: 'repositories' })

var repositoriesTerm = new g.Symbol(repository.namePl, 'term')
repositoriesTerm.addRule({ terminal: true, RHS: 'repositories', insertionCost: 3.9 })
repositoriesTerm.addRule({ terminal: true, RHS: 'repos' })


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
var like = new g.Symbol('like')
like.addRule({ terminal: true, RHS: 'liked', insertionCost: 0.8 })

// (repositories) liked by me
repository.passive.addRule({ RHS: [ like, user.byObjUsers ] })