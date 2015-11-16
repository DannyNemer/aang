var g = require('../grammar')

var relPronounPrepSub = g.newSymbol('relative', 'pronoun', 'preposition', 'substitution').addBlankSet({
	terms: [ 'at', 'about', 'by', 'for', 'from', 'in', 'of', 'on', 'to', 'with' ],
})

var relPronounSub = g.newSymbol('relative', 'pronoun', 'substitution').addBlankSet({
	terms: [ 'that', 'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why' ],
})

// (people) who (follow me)
exports.who = g.newSymbol('who').addWord({
	insertionCost: 0.1,
	accepted: [ 'who', 'that' ],
	substitutions: [
		[ relPronounPrepSub, relPronounSub ],
	],
})

// (repos) that (are liked by me)
exports.that = g.newSymbol('that').addWord({
	insertionCost: 0.1,
	accepted: [ 'that', 'which' ],
	substitutions: [
		[ relPronounPrepSub, relPronounSub ],
	],
})