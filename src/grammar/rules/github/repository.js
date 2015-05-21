var g = require('../../grammar')
var Category = require('../Category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var count = require('../count')


var repository = new Category({ sg: 'repository', pl: 'repositories', entity: true })

var repositoriesTerm = new g.Symbol(repository.namePl, 'term')
repositoriesTerm.addWord({
	insertionCost: 3.5,
	accepted: [ repository.namePl, 'repos' ]
})

// |Github repos (I starred)
repository.headMayPoss.addRule({ RHS: [ github.termOpt, repositoriesTerm ] })


var repositoriesCreatedSemantic = g.newSemantic({ name: repository.namePl + '-created', cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
var repositoryCreatorsSemantic = g.newSemantic({ name: repository.nameSg + '-creators', cost: 0.5, minParams: 1, maxParams: 1 })

// my repos
repository.noRelativePossessive.addRule({ RHS: [ poss.determiner, repository.possessible ], semantic: repositoriesCreatedSemantic })
// repos of mine
repository.head.addRule({ RHS: [ repository.headMayPoss, poss.ofPossUsersPlus ], semantic: repositoriesCreatedSemantic })


// CREATED:
// (repos) created by me
repository.passive.addRule({ RHS: [ github.created, user.byObjUsers ], semantic: repositoriesCreatedSemantic })
// (repos) I <stop> created
repository.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, github.created ], semantic: repositoriesCreatedSemantic })
// (repos) I <stop> have created
repository.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, github.haveCreated ], semantic: repositoriesCreatedSemantic })
// (people who) created repos ...
user.subjFilter.addRule({ RHS: [ github.created, repository.catPl ], semantic: repositoryCreatorsSemantic })
// (people who) have created repos ... - not [repositories+] because 'by'
user.subjFilter.addRule({ RHS: [ github.haveCreated, repository.catPl ], semantic: repositoryCreatorsSemantic, personNumber: 'pl' })
// creators of [repositories]
user.head.addRule({ RHS: [ github.creatorsOf, repository.catPl ], semantic: repositoryCreatorsSemantic })


// LIKE:
var repositoriesLikedSemantic = g.newSemantic({ name: repository.namePl + '-liked', cost: 0.5, minParams: 1, maxParams: 1 })
var repositoryLikersSemantic = g.newSemantic({ name: repository.nameSg + '-likers', cost: 0.5, minParams: 1, maxParams: 1 })

var like = new g.Symbol('like')
like.addVerb({
	insertionCost: 0.8,
	oneOrPl: [ 'like' ],
	threeSg: [ 'likes' ],
	past: [ 'liked' ]
})

// (repos) liked by me
repository.passive.addRule({ RHS: [ like, user.byObjUsersPlus ], semantic: repositoriesLikedSemantic, verbForm: 'past' })
// (repos) I like
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, like ], semantic: repositoriesLikedSemantic })
// (repos) I have liked
var haveLiked = new g.Symbol('have', 'liked')
haveLiked.addRule({ RHS: [ auxVerbs.have, like ], verbForm: 'past' })
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, haveLiked ], semantic: repositoriesLikedSemantic })
// (people who) like repos ...
user.subjFilter.addRule({ RHS: [ like, repository.catPlPlus ], semantic: repositoryLikersSemantic, personNumber: 'pl' })
// (people who) have liked repos ...
var likedRepos = new g.Symbol('liked', repository.namePl + '+')
likedRepos.addRule({ RHS: [ like, repository.catPlPlus ], verbForm: 'past' })
user.subjFilter.addRule({ RHS: [ auxVerbs.have, likedRepos ], semantic: repositoryLikersSemantic, personNumber: 'pl' })

var likersOf = new g.Symbol('likers', 'of')
likersOf.addWord({
	accepted: [ 'likers of' ] // should I use regexp? be seperate syms
})
// likers of [repositories+]
user.head.addRule({ RHS: [ likersOf, repository.catPlPlus ], semantic: repositoryLikersSemantic })


// CONTRIBUTED-TO:
var contributedTo = new g.Symbol('contributed', 'to')
contributedTo.addWord({
	insertionCost: 1.2,
	accepted: [ 'contributed to' ]
})

var repositoriesContributedSemantic = g.newSemantic({ name: repository.namePl + '-contributed', cost: 0.5, minParams: 1, maxParams: 1 })
var repositoryContributorsSemantic = g.newSemantic({ name: repository.nameSg + '-contributors', cost: 0.5, minParams: 1, maxParams: 1 })

// (repos) contributed to by me
repository.passive.addRule({ RHS: [ contributedTo, user.byObjUsersPlus ], semantic: repositoriesContributedSemantic })
// (repos) I <stop> contributed to
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWords, contributedTo ], semantic: repositoriesContributedSemantic })
// (repos) I have contributed to
var havePreVerbStopWordsContributedTo = new g.Symbol('have', 'pre', 'verb', 'stop', 'words', 'contributed', 'to')
havePreVerbStopWordsContributedTo.addRule({ RHS: [ auxVerbs.havePreVerbStopWords, contributedTo ] })
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, havePreVerbStopWordsContributedTo ], semantic: repositoriesContributedSemantic })
// (people who) contributed to repos ...
user.subjFilter.addRule({ RHS: [ contributedTo, repository.catPlPlus ], semantic: repositoryContributorsSemantic })
// (people who) have contributed to repos ...
var haveContributedTo = new g.Symbol('have', 'contributed', 'to')
haveContributedTo.addRule({ RHS: [ auxVerbs.have, contributedTo ], personNumber: 'pl' })
user.subjFilter.addRule({ RHS: [ haveContributedTo, repository.catPlPlus ], semantic: repositoryContributorsSemantic })

var contributorsTo = new g.Symbol('contributors', 'to')
contributorsTo.addWord({
	accepted: [ 'contributors to', 'contributors of' ] // should I use regexp? be seperate syms
})
// contributors to [repositories+]
user.head.addRule({ RHS: [ contributorsTo, repository.catPlPlus ], semantic: repositoryContributorsSemantic })

// LANGUAGE:
var languageEntityStr = '{language}'
var languageSemanticArg = g.newSemantic({ name: languageEntityStr, isArg: true, cost: 0 })
var repositoriesLanguageSemantic = g.newSemantic({ name: repository.namePl + '-language', cost: 0.5, minParams: 1, maxParams: 1 })
var language = new g.Symbol('language')
language.addRule({
	terminal: true,
	RHS: languageEntityStr,
	text: languageEntityStr,
	semantic: g.insertSemantic(repositoriesLanguageSemantic, languageSemanticArg)
})
// (my) {language} (repos); (repos that are) {language} (repos)
repository.nounModifier.addRule({ RHS: [ language ] })

var writtenIn = new g.Symbol('written', 'in')
writtenIn.addWord({
	accepted: [ 'written in' ],
	// substitutions: [ 'in' ]
})
// (repos) written in {language}
repository.passive.addRule({ RHS: [ writtenIn, language ] })
// WITH N STARS:
var stars = new g.Symbol('stars')
stars.addWord({
  insertionCost: 3,
  accepted: [ 'stars' ],
  substitutions: [ 'likes' ]
})

// repos with <int> stars
count.addForCategoryItems(repository, stars)

// WITH N FORKS:
var forks = new g.Symbol('forks')
forks.addWord({
  insertionCost: 3.25,
  accepted: [ 'forks' ]
})

// repos with <int> forks
count.addForCategoryItems(repository, forks)