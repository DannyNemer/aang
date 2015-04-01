var g = require('../../grammar')
var Category = require('../Category')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')
var github = require('./github')


var repository = new Category({ sg: 'repository', pl: 'repositories' })

var repositoriesTerm = g.addWord({
	name: repository.namePl + '-term',
	insertionCost: 3.9,
	accepted: [ repository.namePl, 'repos' ]
})

var repositoryHeadMayPoss = new g.Symbol(repository.nameSg, 'head', 'may', 'poss')
repositoryHeadMayPoss.addRule({ RHS: [ github.termOpt, repositoriesTerm ] })

// |Github repos (I starred)
repository.head.addRule({ RHS: [ repositoryHeadMayPoss ] })


var repositoryPossessible = new g.Symbol(repository.nameSg, 'possessible')
// (my) repos
repositoryPossessible.addRule({ RHS: [ repository.lhs, repositoryHeadMayPoss ] })
// my repos
repository.noRelativePossessive.addRule({ RHS: [ poss.determiner, repositoryPossessible ]})

// repos of mine
repository.head.addRule({ RHS: [ repositoryHeadMayPoss, poss.ofPossUsers ] })


// LIKE:
var like = g.addVerb({
	name: 'like',
	insertionCost: 0.8,
	oneOrPl: [ 'like' ],
	threeSg: [ 'likes' ],
	past: [ 'liked' ]
})

// (repos) liked by me
repository.passive.addRule({ RHS: [ like, user.byObjUsersPlus ], verbForm: 'past' })
// (repos) I like
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, like ] })
// (repos) I have liked
var haveLiked = new g.Symbol('have', 'liked')
haveLiked.addRule({ RHS: [ auxVerbs.have, like ], verbForm: 'past' })
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, haveLiked ] })
// (people who) like repos ...
user.subjFilter.addRule({ RHS: [ like, repository.catPlPlus ], personNumber: 'oneOrPl' })
// (people who) have liked repos ...
var likedRepos = new g.Symbol('liked', 'repos+')
likedRepos.addRule({ RHS: [ like, repository.catPlPlus ], verbForm: 'past' })
user.subjFilter.addRule({ RHS: [ auxVerbs.have, likedRepos ], personNumber: 'oneOrPl' })


// CREATED:
var created = g.addWord({
	name: 'created',
	accepted: [ 'created' ]
})

// (repos) created by me
repository.passive.addRule({ RHS: [ created, user.byObjUsers ] })
// (repos) I created
repository.objFilter.addRule({ RHS: [ user.nomUsers, created ] })
// (repos) I have created
var haveCreated = new g.Symbol('have', 'created')
haveCreated.addRule({ RHS: [ auxVerbs.have, created ] })
var preVerbStopWordsHaveCreated = new g.Symbol('pre', 'verb', 'stop', 'words', 'have', 'created')
preVerbStopWordsHaveCreated.addRule({ RHS: [ stopWords.preVerbStopWords, haveCreated ] })
repository.objFilter.addRule({ RHS: [ user.nomUsers, preVerbStopWordsHaveCreated ] })
// (people who) created repos ...
user.subjFilter.addRule({ RHS: [ created, repository.catPl ] })
// (people who) have created repos ...
var createdRepos = new g.Symbol('created', 'repos')
createdRepos.addRule({ RHS: [ created, repository.catPl ] })
user.subjFilter.addRule({ RHS: [ auxVerbs.have, createdRepos ], personNumber: 'oneOrPl' })