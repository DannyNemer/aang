var g = require('../grammar')

var relPronounPrepBlank = g.newSymbol('relative', 'pronoun', 'preposition', 'blank').addBlankSet({
	terms: [ 'at', 'about', 'by', 'for', 'from', 'in', 'of', 'on', 'to', 'with' ],
})

var relPronounBlank = g.newSymbol('relative', 'pronoun', 'blank').addBlankSet({
	terms: [ 'that', 'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why' ],
})

// (people) who (follow me)
exports.who = g.newSymbol('who').addWord({
	insertionCost: 0.1,
	accepted: [ 'who', 'that' ],
	substitutions: [
		[ relPronounPrepBlank, relPronounBlank ],
	],
})

// (repos) that (are liked by me)
exports.that = g.newSymbol('that').addWord({
	insertionCost: 0.1,
	accepted: [ 'that', 'which' ],
	substitutions: [
		[ relPronounPrepBlank, relPronounBlank ],
	],
})