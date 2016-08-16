var g = require('../../grammar')
var github = require('./github')
var oneSg = require('../user/oneSg')
var verbs = require('../verbs')
var preps = require('../prepositions')
var nouns = require('../nouns')


var repositoriesCreatedSemantic = g.newSemantic({
	name: g.hyphenate('repositories', 'created'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	// Specify repos only have one author, so an intersection of repos from different authors returns an empty set.
	forbidsMultipleIntersection: true,
})

var repository = g.newCategory({
	nameSg: 'repository',
	namePl: 'repositories',
	headNoun: g.newTermSequence({
		symbolName: g.hyphenate('repository', 'head', 'noun'),
		type: g.termTypes.NOUN,
		acceptedTerms: [
			g.newCountNoun({
				insertionCost: 3,
				nounFormsSet: { sg: 'repository', pl: 'repositories' },
			}),
			g.newCountNoun({
				nounFormsSet: { sg: 'repo', pl: 'repos' },
			}),
		],
		substitutedTerms: [
			{ term: nouns.sources, costPenalty: 2.5 },
			{ term: nouns.forks, costPenalty: 2.75 },
		],
	}),
	// `[poss-determiner]` repos
	// repos of `[poss-users]` [or `[poss-users+-disjunction]`]
	possSemantic: repositoriesCreatedSemantic,
	entities: [
		{ display: 'Node.js', names: [ 'Nodejs', 'Node' ] },
		'D3',
		'Linux',
		'lodash',
	],
})

// |GitHub repos (`[nom-users+]` like); (my) |GitHub repos
repository.headPossessable.addRule({
	rhs: [
		{ symbol: github.term, isOptional: true },
		repository.headNoun,
	],
})


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
	verbTerm: verbs.createSet,
	// Prevent present tense descriptions of repository creation, an action-relationship only represented as a past event:
	//   Stop: (repos) `[nom-users+-disjunction]` create(s)
	//   Stop: (repos) `[nom-users+-disjunction]` do/does not create
	//   Stop: (people who) create `[repositories+]`
	//   Stop: (people who) do not create `[repositories+]`
	onlyPastTense: true,
	// Prevent present perfect negative rules, which otherwise incorrectly suggest different users can create existing repositories in the future:
	//   Stop: (repos) `[nom-users+-disjunction]` have/has not created
	//   Stop: (people who) have not created `[repositories+]`
	noPresentPerfectNegative: true,
	// Verb rules for `repositories-created()`:
	//   (repos) created by `[obj-users+-disjunction]`
	//   (repos) `[nom-users+-disjunction]` created
	//   (repos) `[nom-users+-disjunction]` have/has created
	//   (repos) `[nom-users+-disjunction]` did not open
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
		agentNounTerm: nouns.creators,
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
	/**
	 * FIXME: Implement `[verb-star]` and `[verb-bookmark]` as accepted synonyms. These verb sets require different conjugation than `[verb-like]`: "repos I star->starred".
	 *
	 * Can not currently implement as such because `[verb-like]` is intentionally misused as a present action, though in this context should be a past action. The verb remains as is, however, for its use in tests and documentation.
	 *
	 * Perhaps, verb conjugation will be extended to not rely on parent rule properties, rather properties in the term sequences.
	 */
	verbTerm: g.newTermSequence({
		symbolName: g.hyphenate(repository.nameSg, 'like'),
		type: g.termTypes.VERB,
		acceptedTerms: [ verbs.like ],
		substitutedTerms: [ verbs.star, verbs.bookmark ],
	}),
	// Accept past tense form of `[like]` if input is past tense, while still defaulting to present tense when input is not past tense and for insertions. Applicable to `[like]`, which can be expressed in present or past tense without semantic differences. Enables the following rules to be present or past tense:
	//   (repos) `[nom-users+]` like(s)/liked, `repositories-liked()`
	//   (people who) like/liked `[repositories+]`, `repository-likers()`
	acceptPastTenseIfInput: true,
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
	//   (people who) like/liked `[repositories+]`
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
		agentNounTerm: nouns.likers,
		prepTerm: preps.participant,
	},
})

// CONTRIBUTE-TO:
repository.addVerbRuleSet({
	verbTerm: g.newTermSequence({
		symbolName: g.hyphenate('contribute', 'to'),
		type: g.termTypes.VERB,
		acceptedTerms: [
			[ verbs.contribute, preps.to ],
		],
		substitutedTerms: [
			[ verbs.work.noTense, preps.surface ],
		],
	}),
	// Accept past tense form of `[contribute-to]` if input is past tense, while still defaulting to present tense when input is not past tense and for insertions. Applicable to `[contribute-to]`, which can be expressed in present or past tense without semantic differences. Enables the following rules to be present or past tense:
	//   (repos) `[nom-users+]` contribute(s)/contributed to
	//   (people who) contribute/contributed to `[repositories+]`
	acceptPastTenseIfInput: true,
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
	//   (people who) contribute/contributed to `[repositories+]`
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
		agentNounTerm: nouns.contributors,
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
	verbTerm: verbs.fork,
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
	forbidsMultipleIntersection: true,
})

// sources (of `[poss-users]`); (`[poss-determiner]`) sources; (repos that are) sources
var sourcesTerm = g.newTermSequence({
	// Note: Temporarily exclude "term" from `NSymbol` name because `count` uses this symbol's name in the names of the symbols it creates.
	symbolName: 'sources',
	type: g.termTypes.INVARIABLE,
	insertionCost: 3.5,
	acceptedTerms: [ 'sources' ],
	substitutedTerms: [ 'source' ],
})

// sources (of `[poss-users]`); (`[poss-determiner]`) sources; (repos that are) sources
var sourceSemanticArg = g.newSemantic({ isArg: true, name: 'source', cost: 0 })
repository.headPossessable.addRule({
	rhs: [ github.term, sourcesTerm ],
	semantic: g.reduceSemantic(repositoriesTypeSemantic, sourceSemanticArg),
}).addRule({
	rhs: [ sourcesTerm ],
	semantic: g.reduceSemantic(repositoriesTypeSemantic, sourceSemanticArg),
})

// forks (of `[poss-users]`); (`[poss-determiner]`) forks; (repos that are) forks
var forksTerm = g.newTermSequence({
	symbolName: 'forks',
	type: g.termTypes.INVARIABLE,
	insertionCost: 3.25,
	acceptedTerms: [ 'forks' ],
	substitutedTerms: [ 'fork', 'forked' ],
})

// forks (of `[poss-users]`); (`[poss-determiner]`) forks; (repos that are) forks
var forkSemanticArg = g.newSemantic({ isArg: true, name: 'fork', cost: 0 })
repository.headPossessable.addRule({
	rhs: [ github.term, forksTerm ],
	semantic: g.reduceSemantic(repositoriesTypeSemantic, forkSemanticArg)
}).addRule({
	rhs: [ forksTerm ],
	semantic: g.reduceSemantic(repositoriesTypeSemantic, forkSemanticArg)
})

// NUM FORKS:
repository.addCountRuleSet({
	itemNoun: nouns.forks,
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
	rhs: [
		{ symbol: forksTerm, noInsert: true },
		[ preps.possessor, repository.pl ],
	],
	transpositionCost: 1,
	semantic: repositoryForksSemantic,
})
// `{repository}` forks
repository.head.addRule({
	rhs: [ repository.sg, forksTerm ],
	semantic: repositoryForksSemantic,
})


// PUBLIC/PRIVATE:
var repositoriesVisibilitySemantic = g.newSemantic({
	name: g.hyphenate(repository.namePl, 'visibility'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	forbidsMultipleIntersection: true,
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
		{ display: 'Ruby', names: [ 'Ruby', 'rb' ] },
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
		forbidsMultipleIntersection: true,
	}),
})

// (my) {language} (repos); (repos that are) {language} (repos)
repository.preModifier.addRule({ rhs: [ language ] })

var written = g.newTermSequence({
	symbolName: 'written',
	type: g.termTypes.INVARIABLE,
	insertionCost: 1.5,
	acceptedTerms: [ 'written' ],
})
// (repos) written in {language}
repository.inner.addRule({ rhs: [ [ written, preps.language ], language ] })


// NUM STARS:
repository.addCountRuleSet({
	itemNoun: g.newTermSequence({
		symbolName: g.hyphenate(repository.nameSg, 'stars'),
		type: g.termTypes.NOUN,
		acceptedTerms: [ nouns.stars ],
		substitutedTerms: [ nouns.likes ],
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
	unitTerm: g.newTermSequence({
		symbolName: 'size',
		type: g.termTypes.INVARIABLE,
		insertionCost: 3.5,
		acceptedTerms: [ 'KB' ],
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
	verbTerm: verbs.push,
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