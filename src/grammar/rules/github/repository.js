var g = require('../../grammar')
var Category = require('../Category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')


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
// (repos) I <stop> created
repository.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, github.created ], semantic: repositoriesCreatedSemantic })
// (repos) I <stop> have created
repository.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, github.haveObjCreated ], semantic: repositoriesCreatedSemantic })
// (people who) created repos ...
user.subjFilter.addRule({ RHS: [ github.created, repository.catPl ], semantic: repositoryCreatorsSemantic })
// (people who) have created repos ... - not [repositories+] because 'by'
user.subjFilter.addRule({ RHS: [ github.havePlSubjCreated, repository.catPl ], semantic: repositoryCreatorsSemantic })
// creators of [repositories]
user.head.addRule({ RHS: [ github.creatorsOf, repository.catPl ], semantic: repositoryCreatorsSemantic })


// LIKE:
var repositoriesLikedSemantic = new g.Semantic({ name: repository.namePl + '-liked', cost: 0.5, minParams: 1, maxParams: 1 })
var repositoryLikersSemantic = new g.Semantic({ name: repository.nameSg + '-likers', cost: 0.5, minParams: 1, maxParams: 1 })

var like = g.addVerb({
	name: 'like',
	insertionCost: 0.8,
	oneOrPl: [ 'like' ],
	threeSg: [ 'likes' ],
	past: [ 'liked' ]
})

// (repos) liked by me
repository.passive.addRule({ RHS: [ like.past, user.byObjUsersPlus ], semantic: repositoriesLikedSemantic })
// (repos) I like
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, like.obj ], semantic: repositoriesLikedSemantic })
// (repos) I have liked
var haveObjLikePast = new g.Symbol('have', 'obj', 'like', 'past')
haveObjLikePast.addRule({ RHS: [ auxVerbs.haveObj, like.past ] })
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, haveObjLikePast ], semantic: repositoriesLikedSemantic })
// (people who) like repos ...
user.subjFilter.addRule({ RHS: [ like.plSubj, repository.catPlPlus ], semantic: repositoryLikersSemantic })
// (people who) have liked repos ...
var havePlSubjLikePast = new g.Symbol('have', 'pl', 'subj', 'like', 'past')
havePlSubjLikePast.addRule({ RHS: [ auxVerbs.havePlSubj, like.past ] })
user.subjFilter.addRule({ RHS: [ havePlSubjLikePast, repository.catPlPlus ], semantic: repositoryLikersSemantic })

var likersOf = g.addWord({
	symbol: new g.Symbol('likers', 'of'),
	accepted: [ 'likers-of' ] // should I use regexp? be seperate syms
})
// likers of [repositories+]
user.head.addRule({ RHS: [ likersOf, repository.catPlPlus ], semantic: repositoryLikersSemantic })


// CONTRIBUTED-TO:
var contributedTo = g.addWord({
	symbol: new g.Symbol('contributed', 'to'),
	insertionCost: 1.2,
	accepted: [ 'contributed-to' ]
})

var repositoriesContributedSemantic = new g.Semantic({ name: repository.namePl + '-contributed', cost: 0.5, minParams: 1, maxParams: 1 })
var repositoryContributorsSemantic = new g.Semantic({ name: repository.nameSg + '-contributors', cost: 0.5, minParams: 1, maxParams: 1 })

// (repos) contributed to by me
repository.passive.addRule({ RHS: [ contributedTo, user.byObjUsersPlus ], semantic: repositoriesContributedSemantic })
// (repos) I <stop> contributed to
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWords, contributedTo ], semantic: repositoriesContributedSemantic })
// (repos) I have <stop> contributed to
var haveObjPreVerbStopWordsContributedTo = new g.Symbol('have', 'obj', 'pre', 'verb', 'stop', 'words', 'contributed', 'to')
haveObjPreVerbStopWordsContributedTo.addRule({ RHS: [ auxVerbs.haveObjPreVerbStopWords, contributedTo ] })
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, haveObjPreVerbStopWordsContributedTo ], semantic: repositoriesContributedSemantic })
// (people who) contributed to repos ...
user.subjFilter.addRule({ RHS: [ contributedTo, repository.catPlPlus ], semantic: repositoryContributorsSemantic })
// (people who) have contributed to repos ...
var havePlSubjContributedTo = new g.Symbol('have', 'pl', 'subj', 'contributed', 'to')
havePlSubjContributedTo.addRule({ RHS: [ auxVerbs.havePlSubj, contributedTo ] })
user.subjFilter.addRule({ RHS: [ havePlSubjContributedTo, repository.catPlPlus ], semantic: repositoryContributorsSemantic })

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