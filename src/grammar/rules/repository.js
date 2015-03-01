var g = require('../grammar')
var Category = require('./Category')
var poss = require('./poss')
var user = require('./user') // for "github" <- change this


var repository = new Category({ sg: 'repository', pl: 'repositories' })

var repositoriesTerm = new g.Symbol(repository.plName, 'term')
repositoriesTerm.addRule({ terminal: true, RHS: 'repositories' })
repositoriesTerm.addRule({ terminal: true, RHS: 'repos' })

// why diff from users?
var repositoryHeadMayPoss = new g.Symbol(repository.sgName, 'head', 'may', 'poss')
repositoryHeadMayPoss.addRule({ RHS: [ user.github, repositoriesTerm ] })

// |Github repositories (I starred)
repository.head.addRule({ RHS: [ repositoryHeadMayPoss ] })


// why diff from users?
var repositoryPossessible = new g.Symbol(repository.name, 'possessible')
// (my) repositories
repositoryPossessible.addRule({ RHS: [ repository.lhs, repositoryHeadMayPoss ] })

// my repositories
repository.noRelativePossessive.addRule({ RHS: [ poss.determiner, repositoryPossessible ]})

// TODO:
// respoitoreis I starred (accept "like") - based on photos I like (have liked, liked by, my liked photos)