var g = require('../grammar')


var nounSymNamePrefix = 'noun'

// creators (of `[repositories]`/`[pull-requests]`)
exports.creators = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'creators'),
	insertionCost: 2.75,
	acceptedTerms: [ 'creators' ],
	substitutedTerms: [ 'authors' ],
})

// founders (of `[companies+]`)
exports.founders = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'founders'),
	insertionCost: 2.5,
	acceptedTerms: [ 'founders' ],
	substitutedTerms: [ 'starters', 'creators' ],
})

// investors (in `[companies+]`)
exports.investors = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'investors'),
	insertionCost: 3,
	acceptedTerms: [ 'investors' ],
	substitutedTerms: [ 'backers', 'financiers', 'shareholders' ],
})

// board members (of `[companies+]`)
exports.boardMembers = g.newTermSequence({
	symbolName: g.hyphenate(nounSymNamePrefix, 'board', 'members'),
	acceptedTerms: [
		[
			g.newTermSequence({
				symbolName: g.hyphenate('term', 'board'),
				insertionCost: 1.75,
				acceptedTerms: [ 'board' ],
			}),
			g.newTermSequence({
				symbolName: g.hyphenate('term', 'members'),
				insertionCost: 1.75,
				acceptedTerms: [ 'members' ],
			}),
		],
		'advisors'
	],
})