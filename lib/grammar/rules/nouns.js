var g = require('../grammar')


var nounSymNamePrefix = 'noun'

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