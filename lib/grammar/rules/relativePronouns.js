var g = require('../grammar')


// Temporarily use this alternate substitution, which lacks 'who', 'that', and 'which', until `createEditRules` is extended to prevent the ambiguity the other substitution creates. To prevent ambiguity, `createEditRules` must remove the individual terminal rules for those terms in the terminal rules sets for insertions created from the rule, but keeping them for the original (split) rule.
var substitution = 'at|about|by|for|from|in|of|on|to|with what|when|where|whom|whose|why'
// var substitution = 'at|about|by|for|from|in|of|on|to|with that|what|when|where|which|who|whom|whose|why'

// (people) who (follow me)
exports.who = g.newTerm({
	symbolName: 'who',
	insertionCost: 0.1,
	acceptedTerms: [ 'who', 'that' ],
	substitutedTerms: [ substitution ],
})

// (repos) that (are liked by me)
exports.that = g.newTerm({
	symbolName: 'that',
	insertionCost: 0.1,
	acceptedTerms: [ 'that', 'which' ],
	substitutedTerms: [ substitution ],
})