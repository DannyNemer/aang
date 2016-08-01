var g = require('../grammar')


var nounSymNamePrefix = 'noun'

// (my) followers
exports.followers = g.newNoun({
	insertionCost: 2.5,
	nounFormsSet: {
		sg: 'follower',
		pl: 'followers',
	},
})

// (my) subscribers
exports.subscribers = g.newNoun({
	nounFormsSet: {
		sg: 'subscriber',
		pl: 'subscribers',
	},
})

// forks (of `[poss-users]`); (`[poss-determiner]`) forks; (repos that are) forks
exports.forks = g.newNoun({
	insertionCost: 3.25,
	nounFormsSet: {
		sg: 'fork',
		pl: 'forks',
	},
})

// sources (of `[poss-users]`); (`[poss-determiner]`) sources; (repos that are) sources
exports.sources = g.newNoun({
	insertionCost: 3.5,
	nounFormsSet: {
		sg: 'source',
		pl: 'sources',
	},
})

// (repos with `<int>`) stars
exports.stars = g.newNoun({
	insertionCost: 3.25,
	nounFormsSet: {
		sg: 'star',
		pl: 'stars',
	},
})

// (repos with `<int>`) likes -> stars
exports.likes = g.newNoun({
	nounFormsSet: {
		sg: 'like',
		pl: 'likes',
	},
})

// (issues/pull-requests with `<int>`) comments
exports.comments = g.newNoun({
	insertionCost: 3,
	nounFormsSet: {
		sg: 'comment',
		pl: 'comments',
	},
})

// creators (of `[repositories]`/`[pull-requests]`)
exports.creators = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'creators'),
	type: g.termTypes.INVARIABLE,
	insertionCost: 2.75,
	acceptedTerms: [ 'creators' ],
	substitutedTerms: [ 'authors' ],
})

// openers (of `[issues+]`)
exports.openers = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'openers'),
	type: g.termTypes.INVARIABLE,
	insertionCost: 3,
	acceptedTerms: [ 'openers', 'creators' ],
	substitutedTerms: [ 'authors' ],
})

// (companies with `<int>`) employees
exports.employees = g.newNoun({
	insertionCost: 2.75,
	nounFormsSet: {
		sg: 'employee',
		pl: 'employees',
	},
})

// (companies with `<int>`) workers -> employees
exports.workers = g.newNoun({
	nounFormsSet: {
		sg: 'worker',
		pl: 'workers',
	},
})

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