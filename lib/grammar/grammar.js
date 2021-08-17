var util = require('../../util/util')
var grammarUtil = require('./grammarUtil')


var NSymbol = require('./NSymbol')
// Instantiates a new `NSymbol`, which adds a new nonterminal symbol to the
// grammar.
exports.newSymbol = NSymbol
// Instantiates a new `NSymbol` with a single binary nonterminal rule for the
// provided options object.
exports.newBinaryRule = NSymbol.newBinaryRule

/**
 * Extend `grammar` with the following methods: `grammar.newVerbSet()` - Creates
 * an `NSymbol` that produces terminal rule sets for a verb with the necessary
 * text forms for conjugation.
 *
 * `grammar.isVerb()` - Check if an `NSymbol` is a verb created by
 * `grammar.newVerbSet()` that has inflected text for past tense.
 *
 * `grammar.isPresentVerb()` - Check if an `NSymbol` is a verb created by
 * `grammar.newVerbSet()` that lacks inflected text for past tense.
 *
 * `grammar.isInvariableTerm()` - Check if an `NSymbol` is a terminal rule set
 * that does not support conjugation (i.e., is invariable).
 */
Object.assign(exports, require('./terminalRuleSetMethods'))

/**
 * Extend `grammar` with the following methods: `grammar.termTypes` - The
 * enumerated type of term sequence types.
 *
 * `grammar.newTermSequence(options)` - Creates an `NSymbol` that produces a
 * terminal rule sequence forming a term or phrase, comprised of terminal rules,
 * terminal rule sets, and nested term sequences.
 *
 * `grammar.newTermSequenceBinarySymbol(options)` - Creates an `NSymbol` with a
 * single binary rule with `options.termPair` as its `rhs`, which produces a
 * terminal sequence forming a phrase comprised of terminal rule sets and nested
 * term sequences.
 *
 * `grammar.newCountNoun(options)` - Creates an `NSymbol` that produces a
 * terminal rule set for a count noun.
 *
 * `grammar.newMassNoun(options)` - Creates an `NSymbol` that produces a
 * terminal rule set for a mass (uncountable) noun.
 *
 * `grammar.newPronoun(options)` - Creates an `NSymbol` that produces a terminal
 * rule set for a pronoun with the necessary text forms for conjugation.
 *
 * `grammar.newVerb(options)` - Creates an `NSymbol` that produces a terminal
 * rule set for a verb with the necessary text forms for conjugation.
 *
 * `grammar.newTenseVerb(options)` - Creates two terminal rule sets from the
 * verb forms in `options.verbFormsTermSet`, split by present and past
 * grammatical tense, and a third nonterminal substitution term sequence that
 * produces both without tense restrictions.
 *
 * `grammar.isTermSequenceType(term, type)` - Checks if `term` is a term
 * sequence or terminal rule set with term sequence type, `type`.
 *
 * `grammar.isIllFormedTerminalSymbol(terminalSymbol)` - Checks if
 * `terminalSymbol` is ill-formed. If so, prints an error message.
 */
Object.assign(exports, require('./termSequence/termSequence'))

var semantic = require('./semantic')
// Creates a new semantic function or argument.
exports.newSemantic = semantic.new
// Applies a completed semantic rule to a more recent semantic tree, joining
// them together as one semantic tree with a new root function.
exports.reduceSemantic = semantic.reduce
// Merges two reduced (reduced) semantic arrays into a single array, if the
// merge is semantically legal. Else, returns `-1`.
exports.mergeRHSSemantics = semantic.mergeRHS
// Gets the name of the provided semantic array.
exports.getSemanticName = semantic.getName

var entityCategory = require('./entityCategory')
// Creates a new entity category containing the passed entities.
exports.newEntityCategory = entityCategory.new

var intSymbol = require('./intSymbol')
// Creates a unique terminal symbol that recognizes integers in input within the
// specified range.
exports.newIntSymbol = intSymbol.new

// Terms that can be deleted when found in input.
exports.deletables = []

// The start symbol of the grammar.
exports.startSymbol = exports.newSymbol('start')

// The terminal symbol for empty strings. Rules with `<empty>` optionalize their
// LHS symbols and subsequent unary reductions. Original unary rules with
// `<empty>` are omitted from `NSymbol._ruleSets` when output.
exports.emptySymbol = '<empty>'

// The symbol used in the second branch of insertion rules that are only
// recognized at the end of an input query. To match these rules in input,
// `Parser` appends a node for `[blank-inserted]` to the end of the array of
// nodes for the input query's matched terminal rules.
var blankSymbol = '<blank>'
exports.blankInsertedSymbol = exports.newSymbol(blankSymbol, 'inserted').addRule({
	isTerminal: true,
	rhs: blankSymbol,
	isPlaceholder: true,
})

// Concatenates variadic string arguments with dashes. This is useful for
// hyphenating strings for options objects.
exports.hyphenate = grammarUtil.hyphenate

// Instantiates a new `Category`, which adds several base symbols and rules for
// a new database object category to the grammar.
exports.newCategory = require('./rules/Category')

/**
 * Compiles and checks the grammar after adding all non-edit rules.
 *
 * Invokes the following operations in the specified order:
 * 1. Converts the grammar's regex-style terminal symbols into rules that yield
 *    only single-token terminal symbols.
 * 2. Removes ill-formed and unused instances of nonterminal symbols,
 *    nonterminal rules, entity categories, integer symbols, and semantics from
 *    the grammar.
 * 3. Diversifies the costs of the grammar's non-edit rules.
 * 4. Creates grammar edit-rules derived from insertion and transposition costs,
 *    and empty strings in existing rules.
 * 5. Checks the grammar's rules for errors after constructing all non-edit and
 *    edit rules.
 * 6. Removes the temporary rules and rule properties used internally for
 *    grammar generation.
 * 7. Sorts the grammar's components.
 *
 * @memberOf grammar
 */
exports.compileGrammar = function () {
	/**
	 * Convert the grammar's regex-style terminal symbols into rules that yield
	 * only single-token terminal symbols. This is necessary to enable partial
	 * matches and deletions within what would otherwise be regex-style terminal
	 * symbols.
	 *
	 * Invoke this module before `createEditRules` because it adds `<empty>` rules to the grammar.
	 */
	require('./splitRegexTerminalSymbols')(NSymbol._ruleSets)

	/**
	 * Remove ill-formed and unused instances of nonterminal symbols,
	 * nonterminal rules, entity categories, integer symbols, and semantics from
	 * the grammar.
	 *
	 * Invoke this module before `createEditRules` to avoid creating edit-rules
	 * from these components.
	 */
	require('./removeUnusedComponents')(NSymbol._ruleSets)

	/**
	 * Diversify the costs of the grammar's non-edit rules by incrementing the
	 * cost of each nonterminal symbol's rules by an increasing epsilon value.
	 *
	 * Invoke this method after invoking `removeUnusedComponents` to evenly
	 * distribute the increasing epsilon value, and before adding edit-rules in
	 * `createEditRules`.
	 */
	NSymbol.diversifyRuleCosts()

	/**
	 * Create grammar edit-rules derived from insertion and transposition costs,
	 * and empty strings in existing rules.
	 *
	 * Invoke this module and after invoking `removeIllFormedRulesAndSyms()` to
	 * remove ill-formed nonterminal rules and symbols.
	 */
	require('./createEditRules')(NSymbol._ruleSets)

	/**
	 * Check `ruleSets` for errors after constructing all non-edit and edit
	 * rules.
	 *
	 * Invoke this module at the conclusion of grammar generation because the
	 * errors occur across multiple rules and therefore are only evident after
	 * rule construction completes.
	 */
	require('./checkGrammar')(NSymbol._ruleSets)

	/**
	 * Remove the temporary rules and rule properties used internally for
	 * grammar generation from `ruleSets` to exclude them from the output
	 * grammar.
	 *
	 * Invoke this module after `checkGrammar` to include line definitions,
	 * which `removeTempRulesAndProps` removes, in its error messages.
	 */
	require('./removeTempRulesAndProps')(NSymbol._ruleSets)

	/**
	 * Sort the grammar's components.
	 *
	 * Invoke this function at the conclusion of grammar generation.
	 */
	sortGrammar()
}

/**
 * Sorts nonterminal symbols alphabetically and the symbols' rules by increasing
 * cost.
 *
 * Sorts integer symbols by increasing minimum value and then by increasing
 * maximum value.
 *
 * Sorts entity tokens alphabetically and the entities for each token
 * alphabetically.
 *
 * Sorts deletables alphabetically.
 *
 * Invoke this function at the conclusion of grammar generation.
 *
 * @private
 */
function sortGrammar() {
	// Sort nonterminal symbols alphabetically and each symbols' rules by
	// increasing cost.
	NSymbol.sortRules()

	// Sort integer symbols by increasing minimum value and then by increasing
	// maximum value.
	intSymbol.sortIntSymbols()

	// Sorts entity tokens (the keys in the map `entityCategory._entitySets`)
	// alphabetically and the entities for each token alphabetically.
	entityCategory.sortEntities()

	// Sort deletables alphabetically.
	exports.deletables.sort()
}

/**
 * Prints the number of rules and entities in the grammar. If
 * `prevOutputFilePath` is provided, prints the differences, if any, since the
 * last grammar generation.
 *
 * @memberOf grammar
 * @param {string} [prevOutputFilePath] The path of the previously generated
 * grammar to compare.
 */
exports.printStats = function (prevOutputFilePath) {
	var oldRuleCount = 0
	var oldEntityCount = 0

	// Get stats from previous output grammar if file exists.
	if (util.pathExistsSync(prevOutputFilePath)) {
		var oldGrammar = require(util.realpathSync(prevOutputFilePath))
		oldRuleCount = grammarUtil.getRuleCount(oldGrammar.ruleSets)
		oldEntityCount = grammarUtil.getEntityCount(oldGrammar.entitySets)
	}

	var newRuleCount = grammarUtil.getRuleCount(NSymbol._ruleSets)
	if (oldRuleCount !== newRuleCount) {
		util.log('Rules:', oldRuleCount, '->', newRuleCount)
	} else {
		util.log('Rules:', oldRuleCount)
	}

	var newEntityCount = grammarUtil.getEntityCount(entityCategory._entitySets)
	if (oldEntityCount !== newEntityCount) {
		util.log('Entities:', oldEntityCount, '->', newEntityCount)
	} else {
		util.log('Entities:', oldEntityCount)
	}
}

/**
 * Gets the grammar's rules, semantics, entities, and deletables, returned as a
 * single `Object`.
 *
 * @memberOf grammar
 * @returns {Object} Returns the grammar.
 */
exports.getGrammar = function () {
	return {
		ruleSets: NSymbol._ruleSets,
		semantics: semantic._semantics,
		entitySets: entityCategory._entitySets,
		intSymbols: intSymbol._intSymbols,
		deletables: exports.deletables,
		startSymbol: exports.startSymbol.name,
		// Export `<blank>` instead of `[blank-inserted]` because nonterminal
		// symbols in `StateTable` do not have access to the terminal rules they
		// produce. Ergo, `<blank>` would be inaccessible to create its terminal
		// node.
		blankSymbol: blankSymbol,
	}
}

/**
 * Writes the grammar's rules, semantics, entities, and deletables to a JSON
 * file. This file is used in the instantiation of a `StateTable` (rules,
 * semantics) and a `Parser` (entities, deletables).
 *
 * @memberOf grammar
 * @param {string} outputFilePath The path to write the file.
 */
exports.writeGrammarToFile = function (outputFilePath) {
	util.writeJSONFile(outputFilePath, exports.getGrammar())
}