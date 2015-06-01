var g = require('../../grammar')
var Category = require('../Category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var count = require('../count')
var preps = require('../prepositions')
var date = require('../date')


var repository = new Category({ sg: 'repository', pl: 'repositories', entities: [ 'Node', 'D3', 'Linux' ] })

var repositoriesTerm = new g.Symbol(repository.namePl, 'term')
repositoriesTerm.addWord({
	insertionCost: 3.5,
	accepted: [ repository.namePl, 'repos' ]
})

// |GitHub repos (I starred)
repository.headMayPoss.addRule({ RHS: [ github.termOpt, repositoriesTerm ] })

// preventDups because repos only have one author, so an intersection of repos from different authors is empty
var repositoriesCreatedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'created'), cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
var repositoryCreatorsSemantic = g.newSemantic({ name: g.hyphenate(repository.nameSg, 'creators'), cost: 0.5, minParams: 1, maxParams: 1 })

// my repos; my {language} repos
var repositoryPossDeterminer = new g.Symbol(repository.nameSg, 'poss', 'determiner')
repositoryPossDeterminer.addRule({ RHS: [ poss.determiner ], semantic: repositoriesCreatedSemantic })
repository.noRelativePossessive.addRule({ RHS: [ repositoryPossDeterminer, repository.possessible ] })
// repos of mine
repository.head.addRule({ RHS: [ repository.headMayPoss, poss.ofPossUsers ], semantic: repositoriesCreatedSemantic })


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
var repositoriesLikedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'liked'), cost: 0.5, minParams: 1, maxParams: 1 })
var repositoryLikersSemantic = g.newSemantic({ name: g.hyphenate(repository.nameSg, 'likers'), cost: 0.5, minParams: 1, maxParams: 1 })

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

var repositoriesContributedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'contributed'), cost: 0.5, minParams: 1, maxParams: 1 })
var repositoryContributorsSemantic = g.newSemantic({ name: g.hyphenate(repository.nameSg, 'contributors'), cost: 0.5, minParams: 1, maxParams: 1 })

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
var languageEntity = g.newEntityCategory({
	name: 'language',
	entities: [ 'ActionScript', 'C', 'C#', 'C++', 'Clojure', 'CoffeeScript', 'CSS', 'Go', 'Haskell', 'HTML', 'Java', 'JavaScript', 'Lua', 'Matlab', 'Objective-C', 'Perl', 'PHP', 'Python', 'R', 'Ruby', 'Scala', 'Shell', 'Swift', 'TeX', 'VimL' ]
})

var language = new g.Symbol('language')
language.addRule({
	terminal: true,
	RHS: languageEntity,
	semantic: g.newSemantic({ name: g.hyphenate(repository.namePl, 'language'), cost: 0.5, minParams: 1, maxParams: 1 })
})
// (my) {language} (repos); (repos that are) {language} (repos)
repository.preModifier.addRule({ RHS: [ language ] })

var writtenIn = new g.Symbol('written', 'in')
writtenIn.addWord({
	insertionCost: 3,
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

// (repos) with <int> stars
repository.inner.addRule({ RHS: [ preps.possessed, count.createForItems(stars) ], semantic: repository.semantic })

// WITH N FORKS:
var forks = new g.Symbol('forks')
forks.addWord({
  insertionCost: 3.25,
  accepted: [ 'forks' ]
})

// (repos) with <int> forks
repository.inner.addRule({ RHS: [ preps.possessed, count.createForItems(forks) ], semantic: repository.semantic })

var size = new g.Symbol('size')
size.addWord({
	insertionCost: 3.5,
	accepted: [ 'KB' ]
})
// (repos that are) <int> KB
repository.postModifer.addRule({ RHS: [ count.createForItems(size) ], semantic: repository.semantic })


// DATE:
// (repos) created in [year]
repository.inner.addRule({ RHS: [ github.created, date.general ], semantic: repository.semantic })

// (repos) pushed in [year]
var pushed = new g.Symbol('pushed')
pushed.addWord({ accepted: [ 'pushed' ] })
var repositoriesPushedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'pushed'), cost: 0.5, minParams: 1, maxParams: 2 })
repository.inner.addRule({ RHS: [ pushed, date.general ], semantic: repositoriesPushedSemantic })


// PUBLIC/PRIVATE
var repositoriesVisibilitySemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'visibility'), cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
// (my) public (repos); (my repos that are) public
repository.adjective.addRule({
	terminal: true, RHS: 'public', text: 'public',
	semantic: g.insertSemantic(repositoriesVisibilitySemantic, g.newSemantic({ name: 'public', isArg: true, cost: 0 }))
})
// (my) private (repos); (my repos that are) private
repository.adjective.addRule({
	terminal: true, RHS: 'private', text: 'private',
	semantic: g.insertSemantic(repositoriesVisibilitySemantic, g.newSemantic({ name: 'private', isArg: true, cost: 0 }))
})