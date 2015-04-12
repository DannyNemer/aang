var g = require('../../grammar')
var Category = require('../Category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')


var repository = new Category({ sg: 'repository', pl: 'repositories', entity: true })

var repositoriesTerm = g.addWord({
	symbol: new g.Symbol(repository.namePl, 'term'),
	insertionCost: 3.5,
	accepted: [ repository.namePl, 'repos' ]
})

// |Github repos (I starred)
repository.headMayPoss.addRule({ RHS: [ github.termOpt, repositoriesTerm ] })


var repositoriesCreatedSemantic = new g.Semantic({ name: repository.namePl + '-created', cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
var repositoryCreatorsSemantic = new g.Semantic({ name: repository.nameSg + '-creators', cost: 0.5, minParams: 1, maxParams: 1 })

// my repos
repository.noRelativePossessive.addRule({ RHS: [ poss.determiner, repository.possessible ], semantic: repositoriesCreatedSemantic })
// repos of mine
repository.head.addRule({ RHS: [ repository.headMayPoss, poss.ofPossUsersPlus ], semantic: repositoriesCreatedSemantic })


// CREATED:
// (repos) created by me
repository.passive.addRule({ RHS: [ github.created, user.byObjUsers ], semantic: repositoriesCreatedSemantic })
// (repos) I created
repository.objFilter.addRule({ RHS: [ user.nomUsers, github.preVerbStopWordsCreated ], semantic: repositoriesCreatedSemantic })
// (repos) I have created
repository.objFilter.addRule({ RHS: [ user.nomUsers, github.preVerbStopWordsHaveCreated ], semantic: repositoriesCreatedSemantic })
// (people who) created repos ...
user.subjFilter.addRule({ RHS: [ github.created, repository.catPl ], semantic: repositoryCreatorsSemantic })
// (people who) have created repos ...
var createdRepositories = new g.Symbol('created', repository.namePl)
createdRepositories.addRule({ RHS: [ github.created, repository.catPl ] }) // not [repositories+] because 'by'
user.subjFilter.addRule({ RHS: [ auxVerbs.have, createdRepositories ], semantic: repositoryCreatorsSemantic, personNumber: 'pl' })
// creators of [repositories]
user.head.addRule({ RHS: [ github.creatorsOf, repository.catPl ], semantic: repositoryCreatorsSemantic })


// LIKE:
var like = g.addVerb({
	symbol: new g.Symbol('like'),
	insertionCost: 0.8,
	oneOrPl: [ 'like' ],
	threeSg: [ 'likes' ],
	past: [ 'liked' ]
})

var repositoriesLikedSemantic = new g.Semantic({ name: repository.namePl + '-liked', cost: 0.5, minParams: 1, maxParams: 1 })
var repositoryLikersSemantic = new g.Semantic({ name: repository.nameSg + '-likers', cost: 0.5, minParams: 1, maxParams: 1 })

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

var likersOf = g.addWord({
	symbol: new g.Symbol('likers', 'of'),
	accepted: [ 'likers-of' ] // should I use regexp? be seperate syms
})
// likers of [repositories+]
user.head.addRule({ RHS: [ likersOf, repository.catPlPlus ], semantic: repositoryLikersSemantic })


// CONTRIBUTE-TO:
var contributeTo = g.addWord({
	symbol: new g.Symbol('contribute', 'to'),
	insertionCost: 1.2,
	accepted: [ 'contributed-to' ]
})

var repositoriesContributedSemantic = new g.Semantic({ name: repository.namePl + '-contributed', cost: 0.5, minParams: 1, maxParams: 1 })
var repositoryContributorsSemantic = new g.Semantic({ name: repository.nameSg + '-contributors', cost: 0.5, minParams: 1, maxParams: 1 })

// (repos) contributed to by me
repository.passive.addRule({ RHS: [ contributeTo, user.byObjUsersPlus ], semantic: repositoriesContributedSemantic })
// (repos) I contributed to
var preVerbStopWordsContributeTo = new g.Symbol('pre', 'verb', 'stop', 'words', 'contribute', 'to')
preVerbStopWordsContributeTo.addRule({ RHS: [ stopWords.preVerbStopWords, contributeTo ] })
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, preVerbStopWordsContributeTo ], semantic: repositoriesContributedSemantic })
// (repos) I have contributed to
var havePreVerbStopWordsContributeTo = new g.Symbol('have', 'pre', 'verb', 'stop', 'words', 'contribute', 'to')
havePreVerbStopWordsContributeTo.addRule({ RHS: [ auxVerbs.have, preVerbStopWordsContributeTo ] })
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, havePreVerbStopWordsContributeTo ], semantic: repositoriesContributedSemantic })
// (people who) contributed to repos ...
user.subjFilter.addRule({ RHS: [ contributeTo, repository.catPlPlus ], semantic: repositoryContributorsSemantic })
// (people who) have contributed to repos ...
var contributeToRepos = new g.Symbol('contribute', 'to', repository.namePl + '+')
contributeToRepos.addRule({ RHS: [ contributeTo, repository.catPlPlus ] })
user.subjFilter.addRule({ RHS: [ auxVerbs.have, contributeToRepos ], semantic: repositoryContributorsSemantic, personNumber: 'pl' })

var contributorsTo = g.addWord({
	symbol: new g.Symbol('contributors', 'to'),
	accepted: [ 'contributors-to', 'contributors-of' ] // should I use regexp? be seperate syms
})
// contributors to [repositories+]
user.head.addRule({ RHS: [ contributorsTo, repository.catPlPlus ], semantic: repositoryContributorsSemantic })

// LANGUAGE:
var languageEntityStr = '{language}'
var languageSemanticArg = new g.Semantic({ name: languageEntityStr, isArg: true, cost: 0 })
var repositoriesLanguageSemantic = new g.Semantic({ name: repository.namePl + '-language', cost: 0.5, minParams: 1, maxParams: 1 })
var language = new g.Symbol('language')
language.addRule({
	terminal: true,
	RHS: languageEntityStr,
	text: languageEntityStr,
	semantic: g.insertSemantic(repositoriesLanguageSemantic, languageSemanticArg)
})
// (my) {language} (repos); (repos that are) {language} (repos)
repository.nounModifier.addRule({ RHS: [ language ] })

var writtenIn = g.addWord({
	symbol: new g.Symbol('written', 'in'),
	accepted: [ 'written-in' ]
})
// (repos) written in {language}
repository.passive.addRule({ RHS: [ writtenIn, language ] })