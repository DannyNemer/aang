var g = require('../../grammar')
var github = require('./github')
var poss = require('../user/poss')
var oneSg = require('../user/oneSg')
var user = require('../user/user')
var auxVerbs = require('../auxVerbs')
var preps = require('../prepositions')


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
// (people who) created `[repositories+]`, `repository-creators()`
// (people who) forked `[repositories+]`, `repository-creators(repository-forks())`
// creators of `[repositories+]`, `repository-creators()`
var repositoryCreatorsSemantic = g.newSemantic({
	name: g.hyphenate(repository.nameSg, 'creators'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	// (people who follow) people who created `[repositories+]` (and their followers)
	isPeople: true,
})

repository.addVerbRuleSet({
	verbTerm: github.create,
	// Prevent present tense descriptions of repository creation, an action-relationship only represented as a past event:
	//   Stop: (repos) `[nom-users+]` create(s)
	//   Stop: (repos) `[nom-users+]` do/does not create
	//   Stop: (people who) create `[repositories+]`
	//   Stop: (people who) do not create `[repositories+]`
	onlyPastTense: true,
	// Prevent present-perfect-negative rules, which otherwise incorrectly suggest different users can create existing repositories in the future:
	//   Stop: (repos) `[nom-users]` have/has not created
	//   Stop: (people who) have not created `[repositories+]`
	noPresentPerfectNegative: true,
	// Verb rules for `repositories-created()`:
	//   (repos) created by `[obj-users]`
	//   (repos) `[nom-users]` created
	//   (repos) `[nom-users]` have/has created
	//   (repos) `[nom-users]` did not open
	catVerbSemantic: repositoriesCreatedSemantic,
	// Verb rules for `repository-creators()`:
	//   (people who) created `[repositories+]`
	//   (people who) have created `[repositories+]`
	//   (people who) did not open `[repositories+]`
	userVerbSemantic: repositoryCreatorsSemantic,
	// Agent noun rules for `repository-creators()`:
	//   creators of `[repositories+]`
	//   `{repository}` creators
	agentNoun: {
		agentNounTerm: github.creators,
		prepTerm: preps.participant,
	},
	// Date rules for `repositories-created-date()`:
	//   (repos) created `[date]`
	//   (repos not) created `[date]`
	catDateSemantic: g.newSemantic({
		name: g.hyphenate(repository.namePl, 'created', 'date'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
})

// LIKE:
repository.addVerbRuleSet({
	verbTerm: g.newSymbol('like').addVerb({
		insertionCost: 0.8,
		oneSg: 'like',
		threeSg: 'likes',
		pl: 'like',
		past: 'liked',
		presentParticiple: 'liking',
		accepted: [ 'starred' ],
		substitutions: [ 'star' ],
	}),
	// Verb rules for `repositories-liked()`:
	//   (repos) liked by `[obj-users+]`
	//   (repos) `[nom-users+]` like(s)/liked
	//   (repos) `[nom-users+]` have/has liked
	//   (repos) `[nom-users+]` do/does not like
	//   (repos) `[nom-users+]` have/has not liked
	catVerbSemantic: g.newSemantic({
		name: g.hyphenate(repository.namePl, 'liked'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
	// Verb rules for `repository-likers()`:
	//   (people who) like(d) `[repositories+]`
	//   (people who) have liked `[repositories+]`
	//   (people who) do not like `[repositories+]`
	//   (people who) have not liked `[repositories+]`
	userVerbSemantic: g.newSemantic({
		name: g.hyphenate(repository.nameSg, 'likers'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		// (people who follow) people who like `[repositories+]` (and their followers)
		isPeople: true,
	}),
	// Agent noun rules for `repository-likers()`:
	//   likers of `[repositories+]`
	//   `{repository}` likers
	agentNoun: {
		agentNounTerm: g.newSymbol('likers').addWord({
			insertionCost: 2,
			accepted: [ 'likers' ],
		}),
		prepTerm: preps.participant,
	},
})

// CONTRIBUTE-TO:
repository.addVerbRuleSet({
	verbTerm: g.newVerbSet({
		symbolName: g.hyphenate('contribute', 'to'),
		insertionCost: 1.2,
		acceptedVerbTermSets: [ {
			oneSg: 'contribute to',
			threeSg: 'contributes to',
			pl: 'contribute to',
			past: 'contributed to',
			presentParticiple: 'contributing to',
		} ],
		substitutedVerbTermSets: [ {
			oneSg: 'work on',
			threeSg: 'works on',
			pl: 'work on',
			past: 'worked on',
			presentParticiple: 'working on',
		} ],
	}),
	// Verb rules for `repositories-contributed()`:
	//   (repos) contributed to by `[obj-users+]`
	//   (repos) `[nom-users+]` contribute(s)/contributed to
	//   (repos) `[nom-users+]` have/has contributed to
	//   (repos) `[nom-users+]` do/does not contribute to
	//   (repos) `[nom-users+]` have/has not contributed to
	catVerbSemantic: g.newSemantic({
		name: g.hyphenate(repository.namePl, 'contributed'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
	// Verb rules for `repository-contributors()`:
	//   (people who) contribute(d) to `[repositories+]`
	//   (people who) have contributed to `[repositories+]`
	//   (people who) do not contribute to `[repositories+]`
	//   (people who) have not contributed to `[repositories+]`
	userVerbSemantic: g.newSemantic({
		name: g.hyphenate(repository.nameSg, 'contributors'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		// (people who follow) people who contribute to `[repositories+]` (and their followers)
		isPeople: true,
	}),
	// Agent noun rules for `repository-contributors()`:
	//   contributors of `[repositories+]`
	//   `{repository}` contributors
	agentNoun: {
		agentNounTerm: g.newSymbol('contributors').addWord({
			insertionCost: 2.4,
			accepted: [ 'contributors' ],
		}),
		prepTerm: preps.receiver,
	},
})

// FORK:
// (people who) forked `[repositories+]`, `repository-creators(repository-forks())`
// forks of `[repositories]`, `repository-forks()`
var repositoryForksSemantic = g.newSemantic({
	name: g.hyphenate(repository.nameSg, 'forks'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})

repository.addVerbRuleSet({
	verbTerm: g.newVerbSet({
		symbolName: g.hyphenate('fork'),
		insertionCost: 2,
		acceptedVerbTermSets: [ {
			oneSg: 'fork',
			threeSg: 'forks',
			pl: 'fork',
			past: 'forked',
			presentParticiple: 'forking',
		} ],
	}),
	// Prevent present tense descriptions of repository forking, an action-relationship only represented as a past event:
	//   Stop: (repos) `[nom-users+]` fork(s)
	//   Stop: (repos) `[nom-users+]` do/does not fork
	//   Stop: (people who) fork `[repositories+]`
	//   Stop: (people who) do not fork `[repositories+]`
	onlyPastTense: true,
	// Verb rules for `repositories-forked()`:
	//   (repos) forked by `[obj-users+]`
	//   (repos) `[nom-users+]` forked
	//   (repos) `[nom-users+]` have/has forked
	//   (repos) `[nom-users+]` did not fork
	//   (repos) `[nom-users+]` have/has not forked
	catVerbSemantic: g.newSemantic({
		name: g.hyphenate(repository.namePl, 'forked'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
	// Verb rules for `repository-creators(repository-forks())`:
	//   (people who) forked `[repositories+]`
	//   (people who) have forked `[repositories+]`
	//   (people who) did not fork `[repositories+]`
	//   (people who) have not forked `[repositories+]`
	userVerbSemantic: g.reduceSemantic(repositoryCreatorsSemantic, repositoryForksSemantic),
})

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

// NUM FORKS:
repository.addCountRuleSet({
	itemTerm: forks,
	// Count rules for `repositories-fork-count()`:
	//   (repos) with `<int>` forks
	//   (repos that) have `<int>` forks
	//   (repos that) do not have `<int>` forks
	catCountSemantic: g.newSemantic({
		name: g.hyphenate(repository.namePl, 'fork', 'count'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
})

// Do not use `[repositories+]` because a repo can not be a fork of multiple other repos.
// forks of `[repositories]`
repository.head.addRule({
	rhs: [ forks, [ preps.possessor, repository.pl ] ],
	noInsertionIndexes: [ 0 ],
	transpositionCost: 1,
	semantic: repositoryForksSemantic,
})
// `{repository}` forks
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
	text: 'public',
	semantic: g.reduceSemantic(repositoriesVisibilitySemantic, publicSemanticArg),
})

// private (repos of mine); (my) private (repos); (repos that are) private (and I created)
var privateSemanticArg = g.newSemantic({ isArg: true, name: 'private', cost: 0 })
repository.adjective.addRule({
	isTerminal: true,
	rhs: 'private',
	text: 'private',
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
repository.addCountRuleSet({
	itemTerm: g.newNoun({
		symbolName: 'stars',
		insertionCost: 3.25,
		acceptedNounTermSets: [ {
			sg: 'star',
			pl: 'stars'
		} ],
		substitutedNounTermSets: [ {
			sg: 'like',
			pl: 'likes',
		} ],
	}),
	// Count rules for `companies-star-count()`:
	//   (repos) with `<int>` stars
	//   (repos that) have `<int>` stars
	//   (repos that) do not have `<int>` stars
	catCountSemantic: g.newSemantic({
		name: g.hyphenate(repository.namePl, 'star', 'count'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
})

// SIZE:
repository.addMeasurementRuleSet({
	unitTerm: g.newSymbol('size').addWord({
		insertionCost: 3.5,
		accepted: [ 'KB' ],
	}),
	// Measurement rules for `repositories-size()`:
	//   (repos that are) `<int>` KB
	//   (repos that are not) `<int>` KB
	catMeasurementSemantic: g.newSemantic({
		name: g.hyphenate(repository.namePl, 'size'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
})

// DATE PUSHED:
repository.addDateRuleSet({
	verbTerm: g.newVerbSet({
		symbolName: 'push',
		acceptedVerbTermSets: [ {
			oneSg: 'push',
			threeSg: 'pushes',
			pl: 'push',
			past: 'pushed',
			presentParticiple: 'pushing',
		} ],
	}),
	// Date rules for `repositories-pushed-date()`:
	//   (repos) pushed `[date]`
	//   (repos not) pushed `[date]`
	catDateSemantic: g.newSemantic({
		name: g.hyphenate(repository.namePl, 'pushed', 'date'),
		cost: 0.5,
		minParams: 1,
		maxParams: 2,
	}),
})