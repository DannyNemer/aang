var g = require('../grammar')


// (my) followers
exports.followers = g.newCountNoun({
	insertionCost: 2.5,
	nounFormsSet: {
		sg: 'follower',
		pl: 'followers',
	},
})

// (my) subscribers
exports.subscribers = g.newCountNoun({
	nounFormsSet: {
		sg: 'subscriber',
		pl: 'subscribers',
	},
})

// creators (of `[repositories]`/`[pull-requests]`)
exports.creators = g.newCountNoun({
	insertionCost: 2.75,
	nounFormsSet: {
		sg: 'creator',
		pl: 'creators',
	},
})

// authors (of `[repositories]`/`[pull-requests]`) -> creators (...)
exports.authors = g.newCountNoun({
	nounFormsSet: {
		sg: 'author',
		pl: 'authors',
	},
})

// creators (of `[repositories]`/`[pull-requests]`)
exports.creatorsSet = g.newTermSequence({
	symbolName: g.hyphenate(exports.creators.name, 'set'),
	type: g.termTypes.NOUN,
	acceptedTerms: [ exports.creators ],
	substitutedTerms: [ exports.authors ],
})

// openers (of `[issues+]`)
exports.openers = g.newCountNoun({
	insertionCost: 3,
	nounFormsSet: {
		sg: 'opener',
		pl: 'openers',
	},
})

// openers (of `[issues+]`)
exports.openersSet = g.newTermSequence({
	symbolName: g.hyphenate(exports.openers.name, 'set'),
	type: g.termTypes.NOUN,
	acceptedTerms: [ exports.openers, exports.creators ],
	substitutedTerms: [ exports.authors ],
})

// forks (of `[poss-users]`); (`[poss-determiner]`) forks; (repos that are) forks
exports.forks = g.newCountNoun({
	insertionCost: 3.25,
	nounFormsSet: {
		sg: 'fork',
		pl: 'forks',
	},
})

// sources (of `[poss-users]`); (`[poss-determiner]`) sources; (repos that are) sources
exports.sources = g.newCountNoun({
	insertionCost: 3.5,
	nounFormsSet: {
		sg: 'source',
		pl: 'sources',
	},
})

// contributors of `[repositories+]`
exports.contributors = g.newCountNoun({
	insertionCost: 2.4,
	nounFormsSet: {
		sg: 'contributor',
		pl: 'contributors',
	},
})

// (repos with `<int>`) stars
exports.stars = g.newCountNoun({
	insertionCost: 3.25,
	nounFormsSet: {
		sg: 'star',
		pl: 'stars',
	},
})

// (repos with `<int>`) likes -> stars
exports.likes = g.newCountNoun({
	nounFormsSet: {
		sg: 'like',
		pl: 'likes',
	},
})

// likers of `[repositories+]`
exports.likers = g.newCountNoun({
	insertionCost: 2,
	nounFormsSet: {
		sg: 'liker',
		pl: 'likers',
	},
})

// (issues/pull-requests with `<int>`) comments
exports.comments = g.newCountNoun({
	insertionCost: 3,
	nounFormsSet: {
		sg: 'comment',
		pl: 'comments',
	},
})

// (companies with `<int>` in) funding
exports.funding = g.newMassNoun({
	insertionCost: 1.5,
	nounTerm: 'funding',
})

// (companies with `<int>`) employees
exports.employees = g.newCountNoun({
	insertionCost: 2.75,
	nounFormsSet: {
		sg: 'employee',
		pl: 'employees',
	},
})

// (companies with `<int>`) workers -> employees
exports.workers = g.newCountNoun({
	nounFormsSet: {
		sg: 'worker',
		pl: 'workers',
	},
})

var nounSymNamePrefix = 'noun'

// founders (of `[companies+]`)
exports.founders = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'founders'),
	type: g.termTypes.INVARIABLE,
	insertionCost: 2.5,
	acceptedTerms: [ 'founders' ],
	substitutedTerms: [ 'starters', 'creators' ],
})

// investors (in `[companies+]`)
exports.investors = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'investors'),
	type: g.termTypes.INVARIABLE,
	insertionCost: 3,
	acceptedTerms: [ 'investors' ],
	substitutedTerms: [ 'backers', 'financiers', 'shareholders' ],
})

// board members (of `[companies+]`)
exports.boardMembers = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'board', 'members'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [
		[
			g.newTermSequence({
				symbolName: g.hyphenate('term', 'board'),
				type: g.termTypes.INVARIABLE,
				insertionCost: 1.75,
				acceptedTerms: [ 'board' ],
			}),
			g.newTermSequence({
				symbolName: g.hyphenate('term', 'members'),
				type: g.termTypes.INVARIABLE,
				insertionCost: 1.75,
				acceptedTerms: [ 'members' ],
			}),
		],
		'advisors',
	],
})