var util = require('../../../util/util')
var g = require('../../grammar')
var Category = require('../Category')
var NSymbol = require('../../NSymbol')
var user = require('./user')


/**
 * Adds the following nonterminal rules to the `user` category for the agent noun, `agentNounTerm`:
 * 1. `agentNounTerm` `prepTerm` `category.plPlus` -> "founders of `[companies+]`"
 * 2. `category.sg` `agentNounTerm` -> "`{company}` founders"
 *    - Only creates this rule if the category has an associated entity category.
 *
 * An agent noun is a word derived from another word denoting an action, and that identifies an entity that does that action.
 *
 * @memberOf user
 * @param {options} options The options object.
 * @param {NSymbol} options.agentNounTerm The symbol that produces the terminal rule set for the agent noun, likely created via `NSymbol.prototype.addWord()`.
 * @param {NSymbol} options.prepTerm The preposition symbol for rule #1 in the method description.
 * @param {Category} options.category The category that receives the action.
 * @param {Object[]} options.actionSemantic The semantic that defines instances of `category` associated with the action.
 */
var agentNounSchema = {
	agentNounTerm: { type: NSymbol, required: true },
	prepTerm: { type: NSymbol, required: true },
	category: { type: Category, required: true },
	actionSemantic: { type: Array, arrayType: Object, required: true },
}

user.addAgentNoun = function (options) {
	if (util.illFormedOpts(agentNounSchema, options)) {
		throw new Error('Ill-formed agent noun')
	}

	// Check associated semantic for the agent noun was defined with `isPeople` to enable the noun's use as an antecedent in anaphora.
	var actionSemantic = options.actionSemantic
	if (!actionSemantic[0].semantic.anaphoraPersonNumber) {
		util.logError('The semantic associated with the agent noun', util.stylize(options.agentNounTerm.name), 'was defined without `isPeople`:', actionSemantic)
		util.logPathAndObject(options)
		throw new Error('Ill-formed agent noun')
	}

	// founders of `[companies+]`
	this.head.addRule({
		rhs: [ options.agentNounTerm, [ options.prepTerm, options.category.plPlus ] ],
		noInsertionIndexes: [ 0 ],
		transpositionCost: 1,
		semantic: actionSemantic,
	})

	// Check if the category an associated entity category.
	if (options.category.sg) {
		// `{company}` founders
		this.head.addRule({
			rhs: [ options.category.sg, options.agentNounTerm ],
			semantic: actionSemantic,
		})
	}
}