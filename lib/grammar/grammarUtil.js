var util = require('../../util/util')
var semantic = require('./semantic')


/**
 * Used to match characters the grammar reserves for special purpose.
 *
 * The following characters are reserved:
 *   '[', ']' - Bounds of nonterminal symbols
 *   '{', '}' - Bounds of terminal symbols for language model matches (e.g., entity categories).
 *   '<', '>' - Bounds of special terminal symbols (e.g., integers).
 *   '(', ')' - Used in the string representation of semantic trees.
 */
var reReservedCharacters = /[\[\]\(\){}<>]/g

/**
 * Iterates over rules in `ruleSets`, invoking `iteratee` for each rule.
 * Invokes `iteratee` with three arguments: (rule, nontermSym, rules).
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Function} iteratee The function invoked per rule.
 */
exports.forEachRule = function (ruleSets, iteratee) {
	exports.forEachRuleSet(ruleSets, function (rules, nontermSym) {
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			iteratee(rules[r], nontermSym, rules)
		}
	})
}

/**
 * Iterates over rule sets in `ruleSets`, invoking `iteratee` for each rule
 * set. Invokes `iteratee` with two arguments: (rules, nontermSym).
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Function} iteratee The function invoked per rule set.
 */
exports.forEachRuleSet = function (ruleSets, iteratee) {
	var nontermSyms = Object.keys(ruleSets)
	for (var s = 0, nontermSymsLen = nontermSyms.length; s < nontermSymsLen; ++s) {
		var nontermSym = nontermSyms[s]
		iteratee(ruleSets[nontermSym], nontermSym)
	}
}

/**
 * Iterates over rules `nontermSym` produces, invoking `iteratee` for each
 * rule. Invokes `iteratee` with one argument: (rule).
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol that produces the rule to
 * iterate over.
 * @param {Function} iteratee The function invoked per rule set.
 */
exports.forEachSymRule = function (ruleSets, nontermSym, iteratee) {
	var rules = ruleSets[nontermSym]
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		iteratee(rules[r])
	}
}

/**
 * Checks if `predicate` returns truthy for any rule in `ruleSets`. Stops
 * iteration once `predicate` returns truthy. Invokes `predicate` with one
 * argument: (rule).
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to
 * rules to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any rule passes the predicate check,
 * else `false`.
 */
exports.someRule = function (ruleSets, predicate) {
	var nontermSyms = Object.keys(ruleSets)

	for (var s = 0, nontermSymsLen = nontermSyms.length; s < nontermSymsLen; ++s) {
		var rules = ruleSets[nontermSyms[s]]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			if (predicate(rules[r])) {
				return true
			}
		}
	}

	return false
}

/**
 * Gets the number of rules in `ruleSets`.
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @returns {number} Returns the number of rules in `ruleSets`.
 */
exports.getRuleCount = function (ruleSets) {
	return Object.keys(ruleSets).reduce(function (ruleCount, nontermSym) {
		return ruleCount + ruleSets[nontermSym].length
	}, 0)
}

/**
 * Gets the number of entities in `entitySets`.
 *
 * Note: Counts by number of unique entity ids to avoid counting multiple names
 * for the same entity.
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} entitySets The map of the grammar's entity tokens to entities.
 * @returns {number} Returns the number of entities in `entitySets`.
 */
exports.getEntityCount = function (entitySets) {
	var entityIds = []

	for (var entityToken in entitySets) {
		var entities = entitySets[entityToken]

		for (var e = 0, entitiesLen = entities.length; e < entitiesLen; ++e) {
			var entityId = entities[e].id

			// Count by number of unique entity ids to avoid counting multiple
			// names for the same entity.
			if (entityIds.indexOf(entityId) === -1) {
				entityIds.push(entityId)
			}
		}
	}

	return entityIds.length
}

/**
 * Creates a string representation of `nontermSym` and `rule` for printing to
 * the console.
 *
 * Formats the rule as follows: `nontermSym` -> `rule.rhs` - `rule.semantic`
 *
 * @static
 * @memberOf grammarUtil
 * @param {string} nontermSym The LHS (nonterminal) symbol of the rule to stringify.
 * @param {Object} rule The rule to stringify.
 * @returns {string} Returns the stringified rule.
 */
exports.stringifyRule = function (nontermSym, rule) {
	return util.stylize(nontermSym) + ' -> ' + exports.stringifyRuleRHS(rule, true)
}

/**
 * Creates a string representation of `rule` for printing to the console.
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} rule The rule to stringify.
 * @param {boolean} stylizeNontermSyms Specify stylizing the nonterminal
 * symbols in `rule.rhs`
 * @returns {string} Returns the stringified rule.
 */
exports.stringifyRuleRHS = function (rule, stylizeNontermSyms) {
	// Stylize RHS symbols if terminal or `stylizeNontermSyms` is truthy.
	var rhs = rule.isTerminal || stylizeNontermSyms ? rule.rhs.map(util.unary(util.stylize)) : rule.rhs.slice()

	// Include insertion text, if any.
	if (rule.insertedSymIdx !== undefined) {
		rhs.splice(rule.insertedSymIdx, 0, util.stylize(rule.text))
	}

	// Include semantics, if any.
	if (rule.semantic) {
		rhs.push('-', semantic.toStylizedString(rule.semantic))

		if (rule.insertedSemantic) {
			rhs.push(semantic.toStylizedString(rule.insertedSemantic))
		}
	}

	return rhs.join(' ')
}

/**
 * Concatenates variadic string arguments with dashes, and replaces instances
 * of whitespace in the strings with dashes.
 *
 * @static
 * @memberOf grammarUtil
 * @param {...string} [strings] The strings to concatenate.
 * @returns {string} Returns the dash-separated string.
 * @example
 *
 * grammarUtil.hyphenate('category', 'lhs')
 * // => 'category-lhs'
 *
 * grammarUtil.hyphenate(category.nameSg, 'rhs')
 * // => 'category-rhs'
 *
 * grammarUtil.hyphenate(possSymbol.name, 'head')
 * // => 'poss-head'
 *
 * grammarUtil.hyphenate('verb', 'do not')
 * // => 'verb-do-not'
 */
exports.hyphenate = function () {
	var chunks = Array.prototype.slice.call(arguments)

	if (chunks.indexOf(undefined) !== -1) {
		util.logErrorAndPath('undefined string in name:', chunks)
		throw new Error('Ill-formed name')
	}

	// Concatenate string arguments with dashes.
	// Replace instances of whitespace with dashes.
	return chunks.join('-').replace(/\s/g, '-')
}

/**
 * Converts `string`, the name of a new grammar element, to lowercase, removes
 * any characters the grammar reserves for special purpose (e.g., brackets in
 * `NSymbol.prototype.name`), and checks for whitespace.
 *
 * @static
 * @memberOf grammarUtil
 * @param {string} string The string to format for use as the name of a new grammar element.
 * @returns {string} Returns the lowercase, stripped string.
 */
exports.formatStringForName = function (string) {
	if (/\s/.test(string)) {
		util.logError('String for name contains whitespace:', util.stylize(string))
		throw new Error('Grammar element name error')
	}

	return string.replace(reReservedCharacters, '').toLowerCase()
}

/**
 * Checks if `string`, a name of a grammar element, contains reserved
 * characters. If `true`, prints an error indicating the reserved character.
 *
 * @static
 * @memberOf grammarUtil
 * @param {string} string The name of the grammar element to inspect.
 * @returns {boolean} Returns `true` if `string` contains an reserved character, else `false`.
 */
exports.hasReservedCharacters = function (string) {
	var match = string.match(reReservedCharacters)

	if (match) {
		util.logError('The character', util.stylize(match[0]), 'is forbidden:', util.stylize(string))
		return true
	}

	return false
}

/**
 * Checks if `name`, the name of a new grammar component (e.g., symbol,
 * semantic), already exists in `defLines`. If so, prints an error with the
 * definition line (file-path + line-number) of the conflicting component.
 *
 * @static
 * @memberOf grammarUtil
 * @param {string} name The name of the new grammar component to check.
 * @param {Object.<string, string>} defLines The map of unique component names to definition lines (file-path + line-number).
 * @param {string} componentTypeName The grammatical component type of `name` and `defLines` (e.g., symbol, semantic).
 * @returns {boolean} Returns `true` if `name` exists in `defLines`, else `false`.
 */
exports.isDuplicateName = function (name, defLines, componentTypeName) {
	if (defLines.hasOwnProperty(name)) {
		var nameStylized = util.stylize(name)
		util.logErrorAndPath('Duplicate', componentTypeName, 'name:', nameStylized)
		util.log('Other', nameStylized, 'definition:')
		util.log('  ' + defLines[name])
		util.log()
		return true
	}

	return false
}

/**
 * Checks if `symA` and `symB` each produce a rule with identical `rhs` arrays.
 * If so, prints an error.
 *
 * @static
 * @memberOf grammarUtil
 * @param {NSymbol} symA The symbol whose rules to check.
 * @param {NSymbol} symB The other symbol whose rules to check.
 * @returns {boolean} Returns `true` if `symA` and `symB` each produce a rule
 * with identical `rhs`, else `false`.
 */
exports.haveIdenticalRules = function (symA, symB) {
	var symARules = symA.rules
	var symBRules = symB.rules
	var symARulesLen = symARules.length
	var symBRulesLen = symBRules.length

	for (var a = 0; a < symARulesLen; ++a) {
		var ruleA = symARules[a]
		var ruleARHS = ruleA.rhs

		for (var b = 0; b < symBRulesLen; ++b) {
			var ruleB = symBRules[b]

			if (util.arraysEqual(ruleARHS, ruleB.rhs)) {
				var symAName = util.stylize(symA.name)
				var symBName = util.stylize(symB.name)

				util.logError(symAName, 'and', symBName, 'produce rules with identical RHS:', ruleARHS)
				util.log('  ' + symAName, util.deleteUndefinedObjectProps(ruleA))
				util.log('  ' + symBName, util.deleteUndefinedObjectProps(ruleB))
				util.log()
				return true
			}
		}
	}

	return false
}

/**
 * Merges `leftText` and `rightText`, each of which is a rule `text` property,
 * in the order provided. For use as a rule's `text` value.
 *
 * If both `leftText` and `rightText` are strings, merges the two into a single
 * string separated by a space. Else, at least one is a conjugative object
 * (with different forms of a term) or an array with a conjugative object and
 * at least one string, and creates a new array containing `leftText` and
 * `rightText` (in that order).
 *
 * Have only ever seen text arrays during grammar generation when constructing
 * the `defaultText` values of long (i.e., deeply nested) term sequences
 * (though no such sequences are in use). Have never seen when parsing (via
 * `flattenTermSequence`).
 *
 * @private
 * @static
 * @param {Object|string|(Object|string)[]} leftText The text item to merge.
 * @param {Object|string|(Object|string)[]} rightText The other text item to merge.
 * @returns {string|(Object|string)[]} Returns the merged text.
 */
exports.mergeTextPair = function (leftText, rightText) {
	if (leftText.constructor === String && rightText.constructor === String) {
		return leftText + ' ' + rightText
	}

	if (leftText.constructor === Array) {
		// Creates a new array consisting of the elements of `leftText`
		// followed by the elements of `rightText` (if `rightText` is an array)
		// or `rightText` itself (if `rightText` is not an array).
		return leftText.concat(rightText)
	}

	if (rightText.constructor === Array) {
		return [ leftText ].concat(rightText)
	}

	return [ leftText, rightText ]
}