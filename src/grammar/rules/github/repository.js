var g = require('../../grammar')
var Category = require('../Category')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')
var github = require('./github')


var repository = new Category({ sg: 'repository', pl: 'repositories', entity: true })

var repositoriesTerm = g.addWord({
	name: repository.namePl + '-term',
	insertionCost: 3.5,
	accepted: [ repository.namePl, 'repos' ]
})

// |Github repos (I starred)
repository.headMayPoss.addRule({ RHS: [ github.termOpt, repositoriesTerm ] })


// my repos
repository.noRelativePossessive.addRule({ RHS: [ poss.determiner, repository.possessible ]})
// repos of mine
repository.head.addRule({ RHS: [ repository.headMayPoss, poss.ofPossUsers ] })


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
var likedRepos = new g.Symbol('liked', repository.namePl + '+')
likedRepos.addRule({ RHS: [ like, repository.catPlPlus ], verbForm: 'past' })
user.subjFilter.addRule({ RHS: [ auxVerbs.have, likedRepos ], personNumber: 'oneOrPl' })


// CREATED:
// (repos) created by me
repository.passive.addRule({ RHS: [ github.created, user.byObjUsers ] })
// (repos) I created
repository.objFilter.addRule({ RHS: [ user.nomUsers, github.created ] })
// (repos) I have created
repository.objFilter.addRule({ RHS: [ user.nomUsers, github.preVerbStopWordsHaveCreated ] })
// (people who) created repos ...
user.subjFilter.addRule({ RHS: [ github.created, repository.catPl ] })
// (people who) have created repos ...
var createdRepositories = new g.Symbol('created', repository.namePl)
createdRepositories.addRule({ RHS: [ github.created, repository.catPl ] }) // not [repositories+] because 'by'
user.subjFilter.addRule({ RHS: [ auxVerbs.have, createdRepositories ], personNumber: 'oneOrPl' })


// CONTRIBUTE-TO:
var contributeTo = g.addWord({
	name: 'contribute-to',
	insertionCost: 1.2,
	accepted: [ 'contributed to' ]
})

// (repos) contributed to by me
repository.passive.addRule({ RHS: [ contributeTo, user.byObjUsersPlus ] })
// (repos) I contributed to
var preVerbStopWordsContributeTo = new g.Symbol('pre', 'verb', 'stop', 'words', 'contribute', 'to')
preVerbStopWordsContributeTo.addRule({ RHS: [ stopWords.preVerbStopWords, contributeTo ] })
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, preVerbStopWordsContributeTo ] })
// (repos) I have contributed to
var havePreVerbStopWordsContributeTo = new g.Symbol('have', 'pre', 'verb', 'stop', 'words', 'contribute', 'to')
havePreVerbStopWordsContributeTo.addRule({ RHS: [ auxVerbs.have, preVerbStopWordsContributeTo ] })
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, havePreVerbStopWordsContributeTo ] })
// (people who) contributed to repos ...
user.subjFilter.addRule({ RHS: [ contributeTo, repository.catPlPlus ] })
// (people who) have contributed to repos ...
var contributeToRepos = new g.Symbol('contribute', 'to', repository.namePl + '+')
contributeToRepos.addRule({ RHS: [ contributeTo, repository.catPlPlus ] })
user.subjFilter.addRule({ RHS: [ auxVerbs.have, contributeToRepos ], personNumber: 'oneOrPl' })