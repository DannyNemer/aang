var g = require('../../grammar')
var github = require('./github')
var poss = require('../user/poss')
var oneSg = require('../user/oneSg')
var user = require('../user/user')
var auxVerbs = require('../auxVerbs')
var count = require('../count')
var preps = require('../prepositions')
var date = require('../date')


var repository = g.newCategory({
	sg: 'repository',
	pl: 'repositories',
	entities: [
		{ display: 'Node.js', names: [ 'Node.js', 'Node' ] },
		'D3',
		'Linux',
		'lodash',
	],
})

repository.term.addWord({
	insertionCost: 3,
	accepted: [ repository.namePl, 'repos' ],
	substitutions: [
		{ symbol: 'sources|source', costPenalty: 2.5 },
		{ symbol: 'fork|forks|forked', costPenalty: 2.75 },
	],
})

// |GitHub repos (I/{user}/[nom-users] like); (my) |GitHub repos
repository.headMayPoss.addRule({ rhs: [ github.termOpt, repository.term ] })

// `forbidsMultiple` because repos only have one author, so an intersection of repos from different authors is empty.
var repositoriesCreatedSemantic = g.newSemantic({
	name: g.hyphenate(repository.namePl, 'created'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	forbidsMultiple: true,
})

// my/{user:'s}/my-followers' repos; ... {language} repos
var repositoryPossDeterminer = g.newSymbol(repository.nameSg, poss.determiner.name).addRule({
	rhs: [ poss.determiner ],
	semantic: repositoriesCreatedSemantic,
})
repository.noRelativePossessive.addRule({ rhs: [ repositoryPossDeterminer, repository.possessable ] })
// repos of {user:'s}/mine/[users]
// Use a separate rule to ensure only semantics `poss.ofPossUsers` produces are added to `repositories-created()`, and not those which `[repository-head-may-poss]` produces.
var repositoryOfPossUsers = g.newSymbol(repository.nameSg, poss.ofPossUsers.name).addRule({
	rhs: [ poss.ofPossUsers ],
	semantic: repositoriesCreatedSemantic,
})
repository.head.addRule({ rhs: [ repository.headMayPoss, repositoryOfPossUsers ] })

// CREATE:
// (repos) created by me
repository.passive.addRule({ rhs: [ github.create, user.byObjUsers ], semantic: repositoriesCreatedSemantic, grammaticalForm: 'past' })
// (repos) I <stop> [have-opt] created
repository.objFilter.addRule({ rhs: [ user.nomUsersPreVerbStopWordHaveOpt, github.create ], semantic: repositoriesCreatedSemantic, grammaticalForm: 'past' })
// Do not add rules for "repos I have not created" because it suggests those results can be created in the future.
// (repos) I did not create
repository.objFilter.addRule({ rhs: [ user.nomUsers, github.doPastNegationCreatePresent ], semantic: g.reduceSemantic(auxVerbs.notSemantic, repositoriesCreatedSemantic) })

var repositoryCreatorsSemantic = g.newSemantic({
	name: g.hyphenate(repository.nameSg, 'creators'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	// (people who follow) creators of Node and their followers
	isPeople: true,
})
// (people who) [have-opt] created [repositories+]
user.subjFilter.addRule({ rhs: [ github.haveOptCreatePast, repository.plPlus ], semantic: repositoryCreatorsSemantic })
// (people who) did not create [repositories+]
user.subjFilter.addRule({ rhs: [ github.doPastNegationCreatePresent, repository.plPlus ], semantic: g.reduceSemantic(auxVerbs.notSemantic, repositoryCreatorsSemantic) })

// creators of [repositories+]
var ofRepositoriesPlus = g.newBinaryRule({ rhs: [ preps.participant, repository.plPlus ] })
user.head.addRule({
	rhs: [ github.creators, ofRepositoriesPlus ],
	noInsertionIndexes: [ 0 ],
	transpositionCost: 1,
	semantic: repositoryCreatorsSemantic,
})
// {repository} creators
user.head.addRule({ rhs: [ repository.sg, github.creators ], semantic: repositoryCreatorsSemantic })


// LIKE:
var like = g.newSymbol('like').addVerb({
	insertionCost: 0.8,
	oneSg: 'like',
	threeSg: 'likes',
	pl: 'like',
	past: 'liked',
	presentParticiple: 'liking',
	accepted: [ 'starred' ],
	substitutions: [ 'star' ],
})

var repositoriesLikedSemantic = g.newSemantic({
	name: g.hyphenate(repository.namePl, 'liked'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})
// (repos) liked by me
repository.passive.addRule({ rhs: [ like, user.byObjUsersPlus ], semantic: repositoriesLikedSemantic, grammaticalForm: 'past' })
// (repos) I like/liked
repository.objFilter.addRule({ rhs: [ user.nomUsersPlus, like ], semantic: repositoriesLikedSemantic, acceptedTense: 'past' })
// (repos) I have liked
repository.objFilter.addRule({ rhs: [ user.nomUsersPlusHaveNoInsert, like ], semantic: repositoriesLikedSemantic, grammaticalForm: 'past' })

var notRepositoriesLikedSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoriesLikedSemantic)
// (repos) I do not like
repository.objFilter.addRule({ rhs: [ user.nomUsersPlusDoPresentNegation, like ], semantic: notRepositoriesLikedSemantic, personNumber: 'pl' })
// (repos) I have not liked
repository.objFilter.addRule({ rhs: [ user.nomUsersPlusHaveNoInsertNegation, like ], semantic: notRepositoriesLikedSemantic, grammaticalForm: 'past' })

var repositoryLikersSemantic = g.newSemantic({
	name: g.hyphenate(repository.nameSg, 'likers'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	// (people who follow) likers of Node and their followers
	isPeople: true,
})
// (people who) like [repositories+]
user.subjFilter.addRule({ rhs: [ like, repository.plPlus ], semantic: repositoryLikersSemantic, acceptedTense: 'past' })
// (people who) have liked [repositories+]
// No insertion for '[have]' to prevent "people who like" suggesting two semantically identical trees: "who like" and "who have liked".
var likedRepositoriesPlus = g.newBinaryRule({ rhs: [ like, repository.plPlus ], grammaticalForm: 'past' })
user.subjFilter.addRule({
	rhs: [ auxVerbs.have, likedRepositoriesPlus ],
	noInsertionIndexes: [ 0 ],
	semantic: repositoryLikersSemantic,
})

var notRepositoryLikersSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoryLikersSemantic)
// (people who) do not like [repositories+]
user.subjFilter.addRule({ rhs: [ [ auxVerbs.doPresentNegation, like ], repository.plPlus ], semantic: notRepositoryLikersSemantic })
// (people who) have not liked [repositories+]
// No insertion for '[have]' to prevent "people who not like" suggesting two semantically identical trees: "who do not like" and "who have not liked".
user.subjFilter.addRule({ rhs: [ auxVerbs.haveNoInsertNegation, likedRepositoriesPlus ], semantic: notRepositoryLikersSemantic })

// likers of `[repositories+]`
// `{repository}` likers
user.addAgentNoun({
	agentNounTerm: g.newSymbol('likers').addWord({
		insertionCost: 2,
		accepted: [ 'likers' ],
	}),
	prepTerm: preps.participant,
	category: repository,
	actionSemantic: repositoryLikersSemantic,
})


// CONTRIBUTE-TO:
var contributeTo = g.newSymbol('contribute', 'to').addVerb({
	insertionCost: 1.2,
	oneSg: 'contribute to',
	threeSg: 'contributes to',
	pl: 'contribute to',
	past: 'contributed to',
	presentParticiple: 'contributing to',
})

var repositoriesContributedSemantic = g.newSemantic({
	name: g.hyphenate(repository.namePl, 'contributed'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})
// (repos) contributed to by me
repository.passive.addRule({ rhs: [ contributeTo, user.byObjUsersPlus ], semantic: repositoriesContributedSemantic, grammaticalForm: 'past' })
// (repos) `[nom-users+]` contribute to
repository.objFilter.addRule({ rhs: [ user.nomUsersPlus, contributeTo ], semantic: repositoriesContributedSemantic, acceptedTense: 'past' })
// (repos) `[nom-users+]` have contributed to
repository.objFilter.addRule({ rhs: [ user.nomUsersPlusHaveNoInsert, contributeTo ], semantic: repositoriesContributedSemantic, grammaticalForm: 'past' })

var notRepositoriesContributedSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoriesContributedSemantic)
// (repos) `[nom-users+]` do not contribute to
repository.objFilter.addRule({ rhs: [ user.nomUsersPlusDoPresentNegation, contributeTo ], semantic: notRepositoriesContributedSemantic, personNumber: 'pl' })
// (repos) `[nom-users+]` have not contributed to
repository.objFilter.addRule({ rhs: [ user.nomUsersPlusHaveNoInsertNegation, contributeTo ], semantic: notRepositoriesContributedSemantic, grammaticalForm: 'past' })

var repositoryContributorsSemantic = g.newSemantic({
	name: g.hyphenate(repository.nameSg, 'contributors'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	// (people who follow) Node contributors and their followers
	isPeople: true,
})
// (people who) contribute to [repositories+]
user.subjFilter.addRule({ rhs: [ contributeTo, repository.plPlus ], semantic: repositoryContributorsSemantic, acceptedTense: 'past' })
// (people who) have contributed to [repositories+]
var contributeToPastRepositoriesPlus = g.newBinaryRule({ rhs: [ contributeTo, repository.plPlus ], grammaticalForm: 'past' })
user.subjFilter.addRule({
	rhs: [ auxVerbs.have, contributeToPastRepositoriesPlus ],
	noInsertionIndexes: [ 0 ],
	semantic: repositoryContributorsSemantic,
})

var notRepositoryContributorsSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoryContributorsSemantic)
// (people who) do not contribute to [repositories+]
user.subjFilter.addRule({ rhs: [ [ auxVerbs.doPresentNegation, contributeTo ], repository.plPlus ], semantic: notRepositoryContributorsSemantic })
// (people who) have not contributed to [repositories+]
user.subjFilter.addRule({ rhs: [ auxVerbs.haveNoInsertNegation, contributeToPastRepositoriesPlus ], semantic: notRepositoryContributorsSemantic })

// contributors to [repositories+]
// {repository} contributors
user.addAgentNoun({
	agentNounTerm: g.newSymbol('contributors').addWord({
		insertionCost: 2.4,
		accepted: [ 'contributors' ],
	}),
	prepTerm: preps.receiver,
	category: repository,
	actionSemantic: repositoryContributorsSemantic,
})


// FORK:
var fork = g.newSymbol('fork').addVerb({
	insertionCost: 2,
	oneSg: 'fork',
	threeSg: 'forks',
	pl: 'fork',
	past: 'forked',
	presentParticiple: 'forking',
})

var repositoriesForkedSemantic = g.newSemantic({
	name: g.hyphenate(repository.namePl, 'forked'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})
// (repos) forked by me
repository.passive.addRule({ rhs: [ fork, user.byObjUsersPlus ], semantic: repositoriesForkedSemantic, grammaticalForm: 'past' })
// (repos) `[nom-users+]` <stop> forked
repository.objFilter.addRule({ rhs: [ user.nomUsersPlusPreVerbStopWord, fork ], semantic: repositoriesForkedSemantic, grammaticalForm: 'past' })
// (repos) `[nom-users+]` have <stop> forked
repository.objFilter.addRule({ rhs: [ user.nomUsersPlusHaveNoInsertPreVerbStopWord, fork ], semantic: repositoriesForkedSemantic, grammaticalForm: 'past' })

var notRepositoriesForkedSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoriesForkedSemantic)
// (repos) `[nom-users+]` did not fork
repository.objFilter.addRule({ rhs: [ user.nomUsersPlusDoPastNegation, fork ], semantic: notRepositoriesForkedSemantic, personNumber: 'pl' })
// (repos) `[nom-users+]` have not forked
repository.objFilter.addRule({ rhs: [ user.nomUsersPlusHaveNoInsertNegation, fork ], semantic: notRepositoriesForkedSemantic, grammaticalForm: 'past' })

var repositoryForksSemantic = g.newSemantic({
	name: g.hyphenate(repository.nameSg, 'forks'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})
var repositoryCreatorsForksSemantic = g.reduceSemantic(repositoryCreatorsSemantic, repositoryForksSemantic)
// (people who) forked [repositories+]
user.subjFilter.addRule({ rhs: [ fork, repository.plPlus ], semantic: repositoryCreatorsForksSemantic, grammaticalForm: 'past' })
// (people who) have forked [repositories+]
var forkPastRepositoriesPlus = g.newBinaryRule({ rhs: [ fork, repository.plPlus ], grammaticalForm: 'past' })
user.subjFilter.addRule({
	rhs: [ auxVerbs.have, forkPastRepositoriesPlus ],
	noInsertionIndexes: [ 0 ],
	semantic: repositoryCreatorsForksSemantic,
})

var notRepositoryCreatorsForksSemantic = g.reduceSemantic(auxVerbs.notSemantic, repositoryCreatorsForksSemantic)
// (people who) did not fork [repositories+]
user.subjFilter.addRule({ rhs: [ [ auxVerbs.doPastNegation, fork ], repository.plPlus ], semantic: notRepositoryCreatorsForksSemantic })
// (people who) have not forked [repositories+]
user.subjFilter.addRule({ rhs: [ auxVerbs.haveNoInsertNegation, forkPastRepositoriesPlus ], semantic: notRepositoryCreatorsForksSemantic })


// FORKS/SOURCES:
var repositoriesTypeSemantic = g.newSemantic({
	name: g.hyphenate(repository.namePl, 'type'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	forbidsMultiple: true,
})

var sources = g.newSymbol('sources').addWord({
	insertionCost: 3.5,
	accepted: [ 'sources' ],
	substitutions: [ 'source' ],
})
// sources (of {user:'s}/mine/[users]); (my/{user:'s}/my-followers') sources; (repos that are) sources
var sourceSemanticArg = g.newSemantic({ isArg: true, name: 'source', cost: 0 })
repository.headMayPoss.addRule({
	rhs: [ github.termOpt, sources ],
	semantic: g.reduceSemantic(repositoriesTypeSemantic, sourceSemanticArg),
})

var forks = g.newSymbol('forks').addWord({
	insertionCost: 3.25,
	accepted: [ 'forks' ],
	substitutions: [ 'fork', 'forked' ],
})
// forks (of {user:'s}/mine/[users]); (my/{user:'s}/my-followers') forks; (repos that are) forks
var forkSemanticArg = g.newSemantic({ isArg: true, name: 'fork', cost: 0 })
repository.headMayPoss.addRule({
	rhs: [ github.termOpt, forks ],
	semantic: g.reduceSemantic(repositoriesTypeSemantic, forkSemanticArg)
})

// (repos) with <int> forks
repository.inner.addRule({
	rhs: [ preps.possessed, count.create(forks) ],
	semantic: repository.semantic,
})

// Do not use `[repositories+]` because a repo can not be a fork of multiple other repos.
// forks of [repositories]
repository.head.addRule({
	rhs: [ forks, [ preps.possessor, repository.pl ] ],
	noInsertionIndexes: [ 0 ],
	transpositionCost: 1,
	semantic: repositoryForksSemantic,
})
// {repository} forks
repository.head.addRule({
	rhs: [ repository.sg, forks ],
	semantic: repositoryForksSemantic,
})


// PUBLIC/PRIVATE:
var repositoriesVisibilitySemantic = g.newSemantic({
	name: g.hyphenate(repository.namePl, 'visibility'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	forbidsMultiple: true,
	// Restrict instances of this semantic to the user; i.e., the `me` semantic.
	requires: g.reduceSemantic(repositoriesCreatedSemantic, oneSg.semanticArg),
})

// public (repos of mine); (my) public (repos); (repos that are) public (and I created)
var publicSemanticArg = g.newSemantic({ isArg: true, name: 'public', cost: 0 })
repository.adjective.addRule({
	isTerminal: true,
	rhs: 'public',
	semantic: g.reduceSemantic(repositoriesVisibilitySemantic, publicSemanticArg),
})

// private (repos of mine); (my) private (repos); (repos that are) private (and I created)
var privateSemanticArg = g.newSemantic({ isArg: true, name: 'private', cost: 0 })
repository.adjective.addRule({
	isTerminal: true,
	rhs: 'private',
	semantic: g.reduceSemantic(repositoriesVisibilitySemantic, privateSemanticArg),
})

// Because the above terminal rules are restricted to first-person-singular (i.e., the user), these stop-words remove the words when input to allow edits when not used in first-person-singular (i.e., semantically illegal).
// 'private' precedes 'public' to give 'public' a higher deletion cost so that it is the first result when both terms are input.
repository.stopWord.addStopWords(
	{ symbol: 'private', costPenalty: 1 },
	{ symbol: 'public', costPenalty: 1 }
)


// LANGUAGE:
var languageEntity = g.newEntityCategory({
	name: 'language',
	entities: [
		'ActionScript',
		'C',
		'C#',
		'C++',
		'Clojure',
		{ display: 'CoffeeScript', names: [ 'CoffeeScript', 'coffee' ] },
		'CSS',
		'Go',
		{ display: 'Haskell', names: [ 'Haskell', 'hs' ] },
		'HTML',
		'Java',
		{ display: 'JavaScript', names: [ 'JavaScript', 'js' ] },
		'Lua',
		'Matlab',
		{ display: 'Objective-C', names: [ 'Objective-C', 'ObjC' ] },
		'Perl',
		'PHP',
		{ display: 'Python', names: [ 'Python', 'py' ] },
		'R',
		'Ruby',
		'Scala',
		'Shell',
		'Swift',
		'TeX',
		'VimL',
	],
})

var language = g.newSymbol('language').addRule({
	isTerminal: true,
	rhs: languageEntity,
	isPlaceholder: true,
	semantic: g.newSemantic({
		name: g.hyphenate(repository.namePl, 'language'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		forbidsMultiple: true,
	}),
})

// (my) {language} (repos); (repos that are) {language} (repos)
repository.preModifier.addRule({ rhs: [ language ] })

var written = g.newSymbol('written').addWord({
	insertionCost: 1.5,
	accepted: [ 'written' ],
})
// (repos) written in {language}
repository.inner.addRule({ rhs: [ [ written, preps.language ], language ] })


// NUM STARS:
var stars = g.newSymbol('stars').addWord({
	insertionCost: 3.25,
	accepted: [ 'stars' ],
	substitutions: [ 'star', 'likes' ],
})
// (repos) with <int> stars
repository.inner.addRule({ rhs: [ preps.possessed, count.create(stars) ], semantic: repository.semantic })


// SIZE:
var size = g.newSymbol('size').addWord({
	insertionCost: 3.5,
	accepted: [ 'KB' ],
})
// (repos that are) <int> KB
repository.postModifer.addRule({ rhs: [ count.create(size) ], semantic: repository.semantic })


// DATE:
// (repos) created in [year]
repository.inner.addRule({ rhs: [ github.create, date.general ], semantic: repository.semantic, grammaticalForm: 'past' })

var pushed = g.newSymbol('pushed').addWord({
	accepted: [ 'pushed' ],
})
var repositoriesPushedSemantic = g.newSemantic({
	name: g.hyphenate(repository.namePl, pushed.name),
	cost: 0.5,
	minParams: 1,
	maxParams: 2,
})
// (repos) pushed in [year]
repository.inner.addRule({ rhs: [ pushed, date.general ], semantic: repositoriesPushedSemantic })