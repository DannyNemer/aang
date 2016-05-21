var g = require('../grammar')


var nounSymNamePrefix = 'noun'

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