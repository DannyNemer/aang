var g = require('../grammar')


var nounSymNamePrefix = 'noun'

// creators (of `[repositories]`/`[pull-requests]`)
exports.creators = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'creators'),
	insertionCost: 2.75,
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'creators' ],
	substitutedTerms: [ 'authors' ],
})

// openers (of `[issues+]`)
exports.openers = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'openers'),
	insertionCost: 3,
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'openers', 'creators' ],
	substitutedTerms: [ 'authors' ],
})

// founders (of `[companies+]`)
exports.founders = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'founders'),
	insertionCost: 2.5,
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'founders' ],
	substitutedTerms: [ 'starters', 'creators' ],
})

// investors (in `[companies+]`)
exports.investors = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'investors'),
	insertionCost: 3,
	type: g.termTypes.INVARIABLE,
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
				insertionCost: 1.75,
				type: g.termTypes.INVARIABLE,
				acceptedTerms: [ 'board' ],
			}),
			g.newTermSequence({
				symbolName: g.hyphenate('term', 'members'),
				insertionCost: 1.75,
				type: g.termTypes.INVARIABLE,
				acceptedTerms: [ 'members' ],
			}),
		],
		'advisors',
	],
})