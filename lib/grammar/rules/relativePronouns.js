const g = require('../grammar')


// Temporarily use this alternate substitution, which lacks 'who', 'that', and 'which', until `createEditRules` is extended to prevent the ambiguity the other substitution creates. To prevent ambiguity, `createEditRules` must remove the individual terminal rules for those terms in the terminal rules sets for insertions created from the rule, but keeping them for the original (split) rule.
const substitution = 'at|about|by|for|from|in|of|on|to|with what|when|where|whom|whose|why'
// const substitution = 'at|about|by|for|from|in|of|on|to|with that|what|when|where|which|who|whom|whose|why'

// (people) who (follow me)
exports.who = g.newSymbol('who').addWord({
	insertionCost: 0.1,
	accepted: [ 'who', 'that' ],
	substitutions: [
		substitution,
	],
})

// (repos) that (are liked by me)
exports.that = g.newSymbol('that').addWord({
	insertionCost: 0.1,
	accepted: [ 'that', 'which' ],
	substitutions: [
		substitution,
	],
})