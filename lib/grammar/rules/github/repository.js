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

repository.term.addWord({
	insertionCost: 3.5,
	accepted: [ repository.namePl, 'repos' ],
})

// |GitHub repos (I/{user}/[nom-users]) liked)
// (my) |GitHub repos
repository.headMayPoss.addRule({ RHS: [ github.termOpt, repository.term ] })

// `forbidsMultiple` because repos only have one author, so an intersection of repos from different authors is empty.
var repositoriesCreatedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'created'), cost: 0.5, minParams: 1, maxParams: 1, forbidsMultiple: true })
// my repos; my {language} repos
// Danny's repos
var repositoryPossDeterminer = g.newSymbol(repository.nameSg, 'poss', 'determiner')
repositoryPossDeterminer.addRule({ RHS: [ poss.determiner ], semantic: repositoriesCreatedSemantic })
repository.noRelativePossessive.addRule({ RHS: [ repositoryPossDeterminer, repository.possessible ] })
// repos of mine
repository.head.addRule({ RHS: [ repository.headMayPoss, poss.ofPossUsers ], semantic: repositoriesCreatedSemantic })


// CREATE:
// (repos) created by me
repository.passive.addRule({ RHS: [ github.create, user.byObjUsers ], semantic: repositoriesCreatedSemantic, tense: 'past' })
// (repos) I <stop> created
repository.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWord, github.create ], semantic: repositoriesCreatedSemantic, tense: 'past' })
// (repos) I <stop> have created
repository.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWord, github.haveNoInsertCreatePast ], semantic: repositoriesCreatedSemantic })
// (repos) I did not create
// Do not add rules for "repos I have not created" because it suggests those results can be created in the future.
repository.objFilter.addRule({ RHS: [ user.nomUsers, github.doPastNegationCreatePresent ], semantic: g.reduceSemantic(auxVerbs.notSemantic, repositoriesCreatedSemantic) })

var repositoryCreatorsSemantic = g.newSemantic({ name: g.hyphenate(repository.nameSg, 'creators'), cost: 0.5, minParams: 1, maxParams: 1 })
// (people who) created [repositories]
user.subjFilter.addRule({ RHS: [ github.create, repository.catPlPlus ], semantic: repositoryCreatorsSemantic, tense: 'past' })
// (people who) have created [repositories]
user.subjFilter.addRule({ RHS: [ github.haveNoInsertCreatePast, repository.catPlPlus ], semantic: repositoryCreatorsSemantic })
// (people who) did not create [repositories]
user.subjFilter.addRule({ RHS: [ github.doPastNegationCreatePresent, repository.catPlPlus ], semantic: g.reduceSemantic(auxVerbs.notSemantic, repositoryCreatorsSemantic) })
// creators of [repositories]
user.head.addRule({ RHS: [ github.creatorsOf, repository.catPlPlus ], semantic: repositoryCreatorsSemantic })


// LIKE:
var like = g.newSymbol('like').addVerb({
	insertionCost: 0.8,
	oneOrPl: [ 'like' ],
	threeSg: [ 'likes' ],
	past: [ 'liked' ],
	accepted: [ 'starred' ],
	substitutions: [ 'star' ],
})

// (people who) have liked [repositories+]
// Hack: manually create symbol name to avoid '+' to allow insertions
var likePastRepositoriesPlus = g.newSymbol(like.name, repository.namePl)
likePastRepositoriesPlus.addRule({ RHS: [ like, repository.catPlPlus ], tense: 'past' })

var repositoriesLikedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'liked'), cost: 0.5, minParams: 1, maxParams: 1 })
// (repos) liked by me
repository.passive.addRule({ RHS: [ like, user.byObjUsersPlus ], semantic: repositoriesLikedSemantic, tense: 'past' })
// (repos) I like/liked
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, like ], semantic: repositoriesLikedSemantic, acceptedTense: 'past' })
// (repos) I have liked
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusHaveNoInsert, like ], semantic: repositoriesLikedSemantic, tense: 'past' })

var notRepositoriesLikedSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoriesLikedSemantic)
// (repos) I do not like
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusDoPresentNegation, like ], semantic: notRepositoriesLikedSemantic, personNumber: 'pl' })
// (repos) I have not liked
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusHaveNoInsertNegation, like ], semantic: notRepositoriesLikedSemantic, tense: 'past' })

var repositoryLikersSemantic = g.newSemantic({ name: g.hyphenate(repository.nameSg, 'likers'), cost: 0.5, minParams: 1, maxParams: 1 })
// (people who) like [repositories+]
user.subjFilter.addRule({ RHS: [ like, repository.catPlPlus ], semantic: repositoryLikersSemantic, acceptedTense: 'past' })
// (people who) have liked [repositories+]
// No insertion for '[have]' to prevent "people who like" suggesting two semantically identical trees: "who like" and "who have liked".
user.subjFilter.addRule({ RHS: [ auxVerbs.have, likePastRepositoriesPlus ], semantic: repositoryLikersSemantic, noInsertionIndexes: [ 0 ] })

var notRepositoryLikersSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoryLikersSemantic)
// (people who) do not like [repositories+]
user.subjFilter.addRule({ RHS: [ [ auxVerbs.doPresentNegation, like ], repository.catPlPlus ], semantic: notRepositoryLikersSemantic })
// (people who) have not liked [repositories+]
// No insertion for '[have]' to prevent "people who not like" suggesting two semantically identical trees: "who do not like" and "who have not liked".
user.subjFilter.addRule({ RHS: [ auxVerbs.haveNoInsertNegation, likePastRepositoriesPlus ], semantic: notRepositoryLikersSemantic })

var likersOf = g.newSymbol('likers', 'of').addWord({
	accepted: [ 'likers of' ],
})

// likers of [repositories+]
user.head.addRule({ RHS: [ likersOf, repository.catPlPlus ], semantic: repositoryLikersSemantic })


// CONTRIBUTE-TO:
var contributeTo = g.newSymbol('contribute', 'to').addVerb({
	insertionCost: 1.2,
	oneOrPl: [ 'contribute to' ],
	threeSg: [ 'contributes to' ],
	past: [ 'contributed to' ],
})

// (people who have) contributed to [repositories+]
// Hack: manually create symbol name to avoid '+' to allow insertions
var contributeToPastRepositoriesPlus = g.newSymbol(contributeTo.name, repository.namePl)
contributeToPastRepositoriesPlus.addRule({ RHS: [ contributeTo, repository.catPlPlus ], tense: 'past' })

var repositoriesContributedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'contributed'), cost: 0.5, minParams: 1, maxParams: 1 })
// (repos) contributed to by me
repository.passive.addRule({ RHS: [ contributeTo, user.byObjUsersPlus ], semantic: repositoriesContributedSemantic, tense: 'past' })
// (repos) I contribute to
repository.objFilter.addRule({ RHS: [ user.nomUsersPlus, contributeTo ], semantic: repositoriesContributedSemantic, acceptedTense: 'past' })
// (repos) I have contributed to
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusHaveNoInsert, contributeTo ], semantic: repositoriesContributedSemantic, tense: 'past' })

var notRepositoriesContributedSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoriesContributedSemantic)// (repos) I do not contribute to
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusDoPresentNegation, contributeTo ], semantic: notRepositoriesContributedSemantic, personNumber: 'pl' })
// (repos) I have not contributed to
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusHaveNoInsertNegation, contributeTo ], semantic: notRepositoriesContributedSemantic, tense: 'past' })

var repositoryContributorsSemantic = g.newSemantic({ name: g.hyphenate(repository.nameSg, 'contributors'), cost: 0.5, minParams: 1, maxParams: 1 })
// (people who) contribute to [repositories+]
user.subjFilter.addRule({ RHS: [ contributeTo, repository.catPlPlus ], semantic: repositoryContributorsSemantic, acceptedTense: 'past' })
// (people who) have contributed to [repositories+]
user.subjFilter.addRule({ RHS: [ auxVerbs.have, contributeToPastRepositoriesPlus ], semantic: repositoryContributorsSemantic, noInsertionIndexes: [ 0 ] })

var notRepositoryContributorsSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoryContributorsSemantic)
// (people who) do not contribute to [repositories+]
user.subjFilter.addRule({ RHS: [ [ auxVerbs.doPresentNegation, contributeTo ], repository.catPlPlus ], semantic: notRepositoryContributorsSemantic })
// (people who) have not contributed to [repositories+]
user.subjFilter.addRule({ RHS: [ auxVerbs.haveNoInsertNegation, contributeToPastRepositoriesPlus ], semantic: notRepositoryContributorsSemantic })

var contributorsTo = g.newSymbol('contributors', 'to')
contributorsTo.addWord({
	accepted: [ 'contributors to|of' ],
})

// contributors to [repositories+]
user.head.addRule({ RHS: [ contributorsTo, repository.catPlPlus ], semantic: repositoryContributorsSemantic })


// FORK:
var fork = g.newSymbol('fork').addVerb({
	insertionCost: 2,
	oneOrPl: [ 'fork' ],
	threeSg: [ 'forks' ],
	past: [ 'forked' ],
})

// (people who have) forked [repositories+]
// Hack: manually create symbol name to avoid '+' to allow insertions
var forkPastRepositoriesPlus = g.newSymbol(fork.name, repository.namePl)
forkPastRepositoriesPlus.addRule({ RHS: [ fork, repository.catPlPlus ], tense: 'past' })

var repositoriesForkedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'forked'), cost: 0.5, minParams: 1, maxParams: 1 })
// (repos) forked by me
repository.passive.addRule({ RHS: [ fork, user.byObjUsersPlus ], semantic: repositoriesForkedSemantic, tense: 'past' })
// (repos) I <stop> forked
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWord, fork ], semantic: repositoriesForkedSemantic, tense: 'past' })
// (repos) I have <stop> forked
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusHaveNoInsertPreVerbStopWord, fork ], semantic: repositoriesForkedSemantic, tense: 'past' })

var notRepositoriesForkedSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoriesForkedSemantic)
// (repos) I did not fork
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusDoPastNegation, fork ], semantic: notRepositoriesForkedSemantic, personNumber: 'pl' })
// (repos) I have not forked
repository.objFilter.addRule({ RHS: [ user.nomUsersPlusHaveNoInsertNegation, fork ], semantic: notRepositoriesForkedSemantic, tense: 'past' })

var repositoryForkersSemantic = g.newSemantic({ name: g.hyphenate(repository.nameSg, 'forkers'), cost: 0.5, minParams: 1, maxParams: 1 })
// (people who) forked [repositories+]
user.subjFilter.addRule({ RHS: [ fork, repository.catPlPlus ], semantic: repositoryForkersSemantic, tense: 'past' })
// (people who) have forked [repositories+]
user.subjFilter.addRule({ RHS: [ auxVerbs.have, forkPastRepositoriesPlus ], semantic: repositoryForkersSemantic, noInsertionIndexes: [ 0 ] })

var notRepositoryForkersSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoryForkersSemantic)
// (people who) did not fork [repositories+]
user.subjFilter.addRule({ RHS: [ [ auxVerbs.doPastNegation, fork ], repository.catPlPlus ], semantic: notRepositoryForkersSemantic })
// (people who) have not forked [repositories+]
user.subjFilter.addRule({ RHS: [ auxVerbs.haveNoInsertNegation, forkPastRepositoriesPlus ], semantic: notRepositoryForkersSemantic })

// LANGUAGE:
var languageEntity = g.newEntityCategory({
	name: 'language',
	entities: [ 'ActionScript', 'C', 'C#', 'C++', 'Clojure', 'CoffeeScript', 'CSS', 'Go', 'Haskell', 'HTML', 'Java', 'JavaScript', 'Lua', 'Matlab', 'Objective-C', 'Perl', 'PHP', 'Python', 'R', 'Ruby', 'Scala', 'Shell', 'Swift', 'TeX', 'VimL' ],
})

var language = g.newSymbol('language')
language.addRule({
	isTerminal: true,
	RHS: languageEntity,
	isPlaceholder: true,
	semantic: g.newSemantic({ name: g.hyphenate(repository.namePl, 'language'), cost: 0.5, minParams: 1, maxParams: 1, forbidsMultiple: true }),
})

// (my) {language} (repos); (repos that are) {language} (repos)
repository.preModifier.addRule({ RHS: [ language ] })

var written = g.newSymbol('written').addWord({
	insertionCost: 1.5,
	accepted: [ 'written' ],
})

// (repos) written in {language}
repository.inner.addRule({ RHS: [ [ written, preps.language ], language ] })


// WITH N STARS:
var stars = g.newSymbol('stars').addWord({
	insertionCost: 3,
	accepted: [ 'stars' ],
	substitutions: [ 'likes' ],
})

// (repos) with <int> stars
repository.inner.addRule({ RHS: [ preps.possessed, count.createForItems(stars) ], semantic: repository.semantic })

var forks = g.newSymbol('forks').addWord({
  insertionCost: 3.25,
  accepted: [ 'forks' ],
})

// (repos) with <int> forks
repository.inner.addRule({ RHS: [ preps.possessed, count.createForItems(forks) ], semantic: repository.semantic })

var size = g.newSymbol('size').addWord({
	insertionCost: 3.5,
	accepted: [ 'KB' ],
})

// (repos that are) <int> KB
repository.postModifer.addRule({ RHS: [ count.createForItems(size) ], semantic: repository.semantic })


// DATE:
// (repos) created in [year]
repository.inner.addRule({ RHS: [ github.create, date.general ], semantic: repository.semantic, tense: 'past' })

// (repos) pushed in [year]
var pushed = g.newSymbol('pushed').addWord({
	accepted: [ 'pushed' ],
})

var repositoriesPushedSemantic = g.newSemantic({ name: g.hyphenate(repository.namePl, 'pushed'), cost: 0.5, minParams: 1, maxParams: 2 })
repository.inner.addRule({ RHS: [ pushed, date.general ], semantic: repositoriesPushedSemantic })