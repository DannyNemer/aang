var g = require('../../grammar')
var user = require('./user')


/**
 * Adds the following nonterminal rules to the `user` category for the agent noun, `agentNounTerm`:
 * 1. `agentNounTerm` `prepTerm` `category.plPlus` -> "founders of `[companies+]`"
 * 2. `category.sg` `agentNounTerm` -> "`{company}` founders"
 *
 * An agent noun is a word derived from another word denoting an action, and that identifies an entity that does that action.
 *
 * @memberOf user
 * @param {NSymbol} agentNounTerm The symbol that produces the terminal rule set for the agent noun, likely created via `NSymbol.prototype.addWord()`.
 * @param {NSymbol} prepTerm The preposition symbol for rule #1 in the method description.
 * @param {Category} category The category that receives the action.
 * @param {Object[]} categoryActionSemantic The semantic that defines instances of `category` associated with the action.
 */
user.addAgentNoun = function (agentNounTerm, prepTerm, category, categoryActionSemantic) {
	// founders of `[companies+]`
	this.head.addRule({
		rhs: [ agentNounTerm, [ prepTerm, category.plPlus ] ],
		noInsertionIndexes: [ 0 ],
		transpositionCost: 1,
		semantic: categoryActionSemantic,
	})

	// `{company}` founders
	this.head.addRule({
		rhs: [ category.sg, agentNounTerm ],
		semantic: categoryActionSemantic,
	})
}