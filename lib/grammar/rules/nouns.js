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
var nounCreators = g.newCountNoun({
	insertionCost: 2.75,
	nounFormsSet: {
		sg: 'creator',
		pl: 'creators',
	},
})

// authors (of `[repositories]`/`[pull-requests]`) -> creators (...)
var nounAuthors = g.newCountNoun({
	nounFormsSet: {
		sg: 'author',
		pl: 'authors',
	},
})

// creators (of `[repositories]`/`[pull-requests]`)
exports.creators = g.newTermSequence({
	symbolName: g.hyphenate(nounCreators.name, 'set'),
	type: g.termTypes.NOUN,
	acceptedTerms: [ nounCreators ],
	substitutedTerms: [ nounAuthors ],
})

// openers (of `[issues+]`)
exports.openers = g.newTermSequence({
	symbolName: g.hyphenate('noun', 'openers', 'set'),
	type: g.termTypes.NOUN,
	acceptedTerms: [
		g.newCountNoun({
			insertionCost: 3,
			nounFormsSet: { sg: 'opener', pl: 'openers' },
		}),
		nounCreators,
	],
	substitutedTerms: [ nounAuthors ],
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

// founders (of `[companies+]`)
exports.founders = g.newTermSequence({
	symbolName: g.hyphenate('noun', 'founders', 'set'),
	type: g.termTypes.NOUN,
	acceptedTerms: [
		g.newCountNoun({
			insertionCost: 2.5,
			nounFormsSet: { sg: 'founder', pl: 'founders' },
		}),
	],
	substitutedTerms: [
		g.newCountNoun({ nounFormsSet: { sg: 'starter', pl: 'starters' } }),
		nounCreators,
	],
})

// investors (in `[companies+]`)
exports.investors = g.newTermSequence({
	symbolName: g.hyphenate('noun', 'investors', 'set'),
	type: g.termTypes.NOUN,
	acceptedTerms: [
		g.newCountNoun({
			insertionCost: 3,
			nounFormsSet: { sg: 'investor', pl: 'investors' },
		}),
	],
	substitutedTerms: [
		g.newCountNoun({ nounFormsSet: { sg: 'backer', pl: 'backers' } }),
		g.newCountNoun({ nounFormsSet: { sg: 'financier', pl: 'financiers' } }),
		g.newCountNoun({ nounFormsSet: { sg: 'shareholder', pl: 'shareholders' } })
	],
})

// board members (of `[companies+]`)
exports.boardMembers = g.newTermSequence({
	symbolName: g.hyphenate('noun', 'board', 'members', 'set'),
	type: g.termTypes.NOUN,
	acceptedTerms: [
		[
			// Note: This might need to be a mass noun, which requires amending `g.newTermSequence()` checks.
			g.newTermSequence({
				symbolName: g.hyphenate('term', 'board'),
				type: g.termTypes.INVARIABLE,
				insertionCost: 1.75,
				acceptedTerms: [ 'board' ],
			}),
			g.newCountNoun({
				insertionCost: 1.75,
				nounFormsSet: { sg: 'member', pl: 'members' },
			}),
		],
		g.newCountNoun({
			nounFormsSet: { sg: 'advisor', pl: 'advisors' },
		}),
	],
})