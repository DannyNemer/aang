var g = require('../../grammar')
var category = require('../category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var count = require('../count')
var preps = require('../prepositions')
var date = require('../date')


var repository = category.new({ sg: 'repository', pl: 'repositories', entities: [ 'Node', 'D3', 'Linux' ] })

repository.term.addWord({
	insertionCost: 3.5,
	accepted: [ repository.namePl, 'repos' ],
})

// |GitHub repos (I starred)
repository.headMayPoss.addRule({ RHS: [ github.termOpt, repository.term ] })

// `forbidMultiple` because repos only have one author, so an intersection of repos from different authors is empty
var repositoriesCreatedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'created'), cost: 0.5, minParams: 1, maxParams: 1, forbidMultiple: true })
var repositoryCreatorsSemantic = g.newSemantic({ name: g.hyphenate(repository.nameSg, 'creators'), cost: 0.5, minParams: 1, maxParams: 1 })

// my repos; my {language} repos
var repositoryPossDeterminer = g.newSymbol(repository.nameSg, 'poss', 'determiner')
repositoryPossDeterminer.addRule({ RHS: [ poss.determiner ], semantic: repositoriesCreatedSemantic })
repository.noRelativePossessive.addRule({ RHS: [ repositoryPossDeterminer, repository.possessible ] })
// repos of mine
repository.head.addRule({ RHS: [ repository.headMayPoss, poss.ofPossUsers ], semantic: repositoriesCreatedSemantic })


// CREATED:
// (repos) created by me
repository.passive.addRule({ RHS: [ github.createPast, user.byObjUsers ], semantic: repositoriesCreatedSemantic })
// (repos) I <stop> created
repository.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, github.createPast ], semantic: repositoriesCreatedSemantic })
// (repos) I <stop> have created
repository.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, github.haveNoInsertCreatePast ], semantic: repositoriesCreatedSemantic })
// (people who) created [repositories]
user.subjFilter.addRule({ RHS: [ github.createPast, repository.catPl ], semantic: repositoryCreatorsSemantic })
// (people who) have created [repositories] - not [repositories+] because 'by'
user.subjFilter.addRule({ RHS: [ github.haveNoInsertCreatePast, repository.catPl ], semantic: repositoryCreatorsSemantic, personNumber: 'pl' })
// creators of [repositories]
user.head.addRule({ RHS: [ github.creatorsOf, repository.catPl ], semantic: repositoryCreatorsSemantic })


// LIKE:
var like = g.newSymbol('like')
like.addVerb({
	insertionCost: 0.8,
	oneOrPl: [ 'like' ],
	threeSg: [ 'likes' ],
	past: [ 'liked' ],
})

var repositoriesLikedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'liked'), cost: 0.5, minParams: 1, maxParams: 1 })
// (repos) liked by me
repository.passive.addRule({ RHS: [ like, user.byObjUsersPlus ], semantic: repositoriesLikedSemantic, verbForm: 'past' })
// (repos) I like
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, like ], semantic: repositoriesLikedSemantic })
// (repos) I have liked
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusHaveNoInsert, like ], semantic: repositoriesLikedSemantic, verbForm: 'past' })

var notRepositoriesLikedSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoriesLikedSemantic)
// (repos) I do not like
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusDoNegation, like ], semantic: notRepositoriesLikedSemantic, personNumber: 'pl' })
// (repos) I have not liked
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusHaveNoInsertNegation, like ], semantic: notRepositoriesLikedSemantic, verbForm: 'past' })

var repositoryLikersSemantic = g.newSemantic({ name: g.hyphenate(repository.nameSg, 'likers'), cost: 0.5, minParams: 1, maxParams: 1 })
// (people who) like [repositories+]
user.subjFilter.addRule({ RHS: [ like, repository.catPlPlus ], semantic: repositoryLikersSemantic, personNumber: 'pl' })

// Hack: manually create symbol name to avoid '+' to allow insertions
var likeRepositoriesPlus = g.newSymbol(like.name, repository.namePl)
likeRepositoriesPlus.addRule({ RHS: [ like, repository.catPlPlus ], verbForm: 'past' })
// (people who) have liked [repositories+]
// No insertion for '[have]' to prevent "people who like" suggesting two semantically identical trees: "who like" and "who have liked".
user.subjFilter.addRule({ RHS: [ auxVerbs.have, likeRepositoriesPlus ], semantic: repositoryLikersSemantic, noInsertionIndexes: [ 0 ], personNumber: 'pl' })
// (people who) have not liked [repositories+]
// No insertion for '[have]' to prevent "people who not like" suggesting two semantically identical trees: "who do not like" and "who have not liked".
user.subjFilter.addRule({ RHS: [ auxVerbs.haveNoInsertNegation, likeRepositoriesPlus ], semantic: g.reduceSemantic(auxVerbs.notSemantic, repositoryLikersSemantic), personNumber: 'pl' })

var likersOf = g.newSymbol('likers', 'of')
likersOf.addWord({
	accepted: [ 'likers of' ], // should I use regexp? be seperate syms
})
// likers of [repositories+]
user.head.addRule({ RHS: [ likersOf, repository.catPlPlus ], semantic: repositoryLikersSemantic })


// CONTRIBUTED-TO:
var contributedTo = g.newSymbol('contributed', 'to')
contributedTo.addWord({
	insertionCost: 1.2,
	accepted: [ 'contributed to' ],
})

var repositoriesContributedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'contributed'), cost: 0.5, minParams: 1, maxParams: 1 })
// (repos) contributed to by me
repository.passive.addRule({ RHS: [ contributedTo, user.byObjUsersPlus ], semantic: repositoriesContributedSemantic })
// (repos) I <stop> contributed to
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWords, contributedTo ], semantic: repositoriesContributedSemantic })
// (repos) I have <stop> contributed to
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusHaveNoInsertPreVerbStopWords, contributedTo ], semantic: repositoriesContributedSemantic })

var notRepositoriesContributedSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoriesContributedSemantic)
// (repos) I have not contributed to
// FIXME: might need to allow insertion of '[have]', because no 'do not contribute to'
// No stop word after '[have]' to match:
// [cat-filter] -> [ [have], [sentence-adverbial] ], [be-past]
// [cat-filter] -> [ [have], [negation] ], [be-past]
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusHaveNoInsertNegation, contributedTo ], semantic: notRepositoriesContributedSemantic })

var repositoryContributorsSemantic = g.newSemantic({ name: g.hyphenate(repository.nameSg, 'contributors'), cost: 0.5, minParams: 1, maxParams: 1 })
// (people who) contributed to [repositories+]
user.subjFilter.addRule({ RHS: [ contributedTo, repository.catPlPlus ], semantic: repositoryContributorsSemantic })

// Hack: manually create symbol name to avoid '+' to allow insertions
var contributedToRepositoriesPlus = g.newSymbol(contributedTo.name, repository.namePl)
contributedToRepositoriesPlus.addRule({ RHS: [ contributedTo, repository.catPlPlus ] })
// (people who) have contributed to [repositories+]
user.subjFilter.addRule({ RHS: [ auxVerbs.have, contributedToRepositoriesPlus ], semantic: repositoryContributorsSemantic, noInsertionIndexes: [ 0 ], personNumber: 'pl' })
// (people who) have not contributed to [repositories+]
user.subjFilter.addRule({ RHS: [ auxVerbs.haveNoInsertNegation, contributedToRepositoriesPlus ], semantic: repositoryContributorsSemantic, personNumber: 'pl' })

var contributorsTo = g.newSymbol('contributors', 'to')
contributorsTo.addWord({
	accepted: [ 'contributors to', 'contributors of' ], // should I use regexp? be seperate syms
})
// contributors to [repositories+]
user.head.addRule({ RHS: [ contributorsTo, repository.catPlPlus ], semantic: repositoryContributorsSemantic })


// LANGUAGE:
var languageEntity = g.newEntityCategory({
	name: 'language',
	entities: [ 'ActionScript', 'C', 'C#', 'C++', 'Clojure', 'CoffeeScript', 'CSS', 'Go', 'Haskell', 'HTML', 'Java', 'JavaScript', 'Lua', 'Matlab', 'Objective-C', 'Perl', 'PHP', 'Python', 'R', 'Ruby', 'Scala', 'Shell', 'Swift', 'TeX', 'VimL' ],
})

var language = g.newSymbol('language')
language.addRule({
	terminal: true,
	RHS: languageEntity,
	semantic: g.newSemantic({ name: g.hyphenate(repository.namePl, 'language'), cost: 0.5, minParams: 1, maxParams: 1, forbidMultiple: true }),
})
// (my) {language} (repos); (repos that are) {language} (repos)
repository.preModifier.addRule({ RHS: [ language ] })

var writtenIn = g.newSymbol('written', 'in')
writtenIn.addWord({
	insertionCost: 2,
	accepted: [ 'written in' ],
	// substitutions: [ 'in' ],
})
// (repos) written in {language}
repository.passive.addRule({ RHS: [ writtenIn, language ] })


// WITH N STARS:
var stars = g.newSymbol('stars')
stars.addWord({
  insertionCost: 3,
  accepted: [ 'stars' ],
  substitutions: [ 'likes' ],
})

// (repos) with <int> stars
repository.inner.addRule({ RHS: [ preps.possessed, count.createForItems(stars) ], semantic: repository.semantic })

// WITH N FORKS:
var forks = g.newSymbol('forks')
forks.addWord({
  insertionCost: 3.25,
  accepted: [ 'forks' ],
})

// (repos) with <int> forks
repository.inner.addRule({ RHS: [ preps.possessed, count.createForItems(forks) ], semantic: repository.semantic })

var size = g.newSymbol('size')
size.addWord({
	insertionCost: 3.5,
	accepted: [ 'KB' ],
})
// (repos that are) <int> KB
repository.postModifer.addRule({ RHS: [ count.createForItems(size) ], semantic: repository.semantic })


// DATE:
// (repos) created in [year]
repository.inner.addRule({ RHS: [ github.createPast, date.general ], semantic: repository.semantic })

// (repos) pushed in [year]
var pushed = g.newSymbol('pushed')
pushed.addWord({
	accepted: [ 'pushed' ],
})

var repositoriesPushedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'pushed'), cost: 0.5, minParams: 1, maxParams: 2 })
repository.inner.addRule({ RHS: [ pushed, date.general ], semantic: repositoriesPushedSemantic })