var util = require('../util/util')
var grammarUtil = require('./grammarUtil')


/**
 * The map of the grammar's semantic names to the semantics.
 *
 * @type {Object.<string, Object[]>}
 */
exports._semantics = {}

/**
 * The map of semantic names to definition lines (file-path + line-number). For use in error messages.
 *
 * @type {Object.<string, string>}
 */
exports._defLines = {}

// The operator semantics used throughout this module, including in `semantic.reduce()`, `reduceUnion()`, `semantic.isIllegalRHS()`, and `hasSemantic()`.
var intersectSemantic
var unionSemantic
var notSemantic
// If not currently building the grammar via `buildGrammar`, then load the `intersect()`, `union()`, and `not()` semantics from the grammar file, which works for equality comparisons because of `initSemantics`.
if (require.main.filename !== require.resolve('./buildGrammar')) {
	// Map to `exports._semantics` to enable `semantic.stringToObject()`.
	exports._semantics = require('../grammar.json').semantics

	intersectSemantic = exports._semantics.intersect
	unionSemantic = exports._semantics.union
	notSemantic = exports._semantics.not
}

/**
 * Creates and adds a new semantic function or semantic argument to the grammar.
 *
 * `pfsearch` uses semantics, which are associated with grammar rules, to construct a semantic tree for each parse tree. Each semantic tree is a lambda calculus representation of the meaning of its associated parse tree's display text. With lambda calculus's discrete representation, however, there is no notion of similarity or the fuzziness of language, unlike vector spaces (i.e., long lists of numbers).
 *
 * @static
 * @memberOf semantic
 * @param {Object} options The options object.
 * @returns {Object[]} Returns the new semantic.
 */
exports.new = function (options) {
	var semanticArray = options.isArg ? newSemanticArgument(options) : newSemanticFunction(options)
	var semanticDef = semanticArray[0].semantic
	var semanticName = semanticDef.name

	// Check for duplicity after invoking `util.illFormedOpts()` on `options` in the appropriate instantiation function above.
	if (grammarUtil.isDuplicateName(semanticName, exports._defLines, 'semantic')) {
		throw new Error('Duplicate semantic name')
	}

	// Save instantiation file path and line number for error reporting.
	exports._defLines[semanticName] = util.getModuleCallerLocation()

	// Save semantics for use elsewhere in this module.
	if (semanticName === 'intersect') {
		intersectSemantic = semanticDef
	} else if (semanticName === 'union') {
		unionSemantic = semanticDef
	} else if (semanticName === 'not') {
		notSemantic = semanticDef
	}

	return semanticArray
}

/**
 * Creates a new semantic function to add to the grammar.
 *
 * `options.forbidsMultiple` is for use when a database object can only have one value for a specific property (e.g., "repos only created by 1 person"), and must forbid multiple instances of the corresponding semantic function within another semantic's arguments (irrespective of child semantics). Otherwise, an intersection of objects with different values for this property will return an empty set.
 *
 * @private
 * @static
 * @param {Object} options The options object.
 * @param {string} options.name The unique semantic name.
 * @param {number} options.cost The cost penalty added to rules that use this semantic.
 * @param {number} options.minParams The minimum number of arguments this semantic function can accept.
 * @param {number} options.maxPamrams The maximum number of arguments this semantic function can accept.
 * @param {boolean} [options.forbidsMultiple] Specify permitting only one instance of this semantic function in the arguments of an `intersect()`.
 * @param {Object[]} [options.requires] A separate semantic that `pfsearch` requires is within the same instance of `intersect()` as this semantic, else rejects the semantic tree.
 * @param {boolean} [options.isPeople] Specify this semantic represents a set of people and can serve as the antecedent for an anaphoric, plural (grammatical number) expression.
 * @returns {Object[]} Returns the new semantic function.
 */
var semanticFunctionSchema = {
	name: { type: String, required: true },
	cost: { type: Number, required: true },
	minParams: { type: Number, required: true },
	maxParams: { type: Number, required: true },
	forbidsMultiple: Boolean,
	requires: Array,
	isPeople: Boolean,
}

function newSemanticFunction(options) {
	if (util.illFormedOpts(semanticFunctionSchema, options)) {
		throw new Error('Ill-formed semantic function')
	}

	if (options.minParams > options.maxParams) {
		util.logErrorAndPath('Semantic minParams > maxParams:', options)
		throw new Error('Ill-formed semantic function')
	}

	var requiredSemantic = options.requires
	if (requiredSemantic) {
		if (!exports.isReduced(requiredSemantic)) {
			util.logError('Required semantic is not reduced:', requiredSemantic)
			util.logPathAndObject(options)
			throw new Error('Ill-formed semantic function')
		}

		if (requiredSemantic.length > 1) {
			util.logError('Required semantic contains multiple semantic trees:', requiredSemantic)
			util.logPathAndObject(options)
			throw new Error('Ill-formed semantic function')
		}

		requiredSemantic = requiredSemantic[0]
	}

	var semanticName = grammarUtil.formatStringForName(options.name)

	var semanticDef = exports._semantics[semanticName] = {
		name: semanticName,
		cost: options.cost,
		minParams: options.minParams,
		maxParams: options.maxParams,
		forbidsMultiple: options.forbidsMultiple,
		requires: requiredSemantic,
	}

	if (options.isPeople) {
		/**
		 * The person-number with which to resolve plural, anaphoric expressions (in `pfsearch`), where this semantic is the antecedent.
		 *
		 * Individual entities have a `anaphoraPersonNumber` property of 'threeSg', which `Parser.prototype.getSemanticArg()` assigns to new semantic arguments it created for entities matched in input.
		 */
		semanticDef.anaphoraPersonNumber = 'threePl'
	}

	// An `Array` is necessary for `semantic.arraysEqual()`, generating a non-reduced semantic tree for a rule (i.e., behaving as a non-reduced RHS semantic), and general consistency.
	return [ {
		semantic: semanticDef,
		children: [],
	} ]
}

/**
 * Creates a semantic argument to add to the grammar.
 *
 * @private
 * @static
 * @param {Object} options The options object.
 * @param {boolean} options.isArg Specify this is a semantic argument.
 * @param {string} options.name The unique semantic name.
 * @param {number} options.cost The cost penalty added to rules that use this semantic.
 * @returns {Object[]} Returns the new semantic argument.
 */
var semanticArgumentSchema = {
	isArg: { type: Boolean, required: true },
	name: { type: String, required: true },
	cost: { type: Number, required: true },
}

function newSemanticArgument(options) {
	if (util.illFormedOpts(semanticArgumentSchema, options)) {
		throw new Error('Ill-formed semantic argument')
	}

	var semanticName = grammarUtil.formatStringForName(options.name)

	var semanticDef = exports._semantics[semanticName] = {
		isArg: true,
		name: semanticName,
		cost: options.cost,
	}

	return [ {
		semantic: semanticDef,
	} ]
}

/**
 * Recursively sums the costs of all semantics in `semanticNodeArray`.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} semanticNodeArray The semantic array to sum.
 * @returns {number} Returns the sum of the semantic costs in `semanticNodeArray`.
 */
exports.sumCosts = function (semanticNodeArray) {
	return semanticNodeArray.reduce(function (accum, node) {
		return accum + node.semantic.cost + (node.children ? exports.sumCosts(node.children) : 0)
	}, 0)
}

/**
 * Merges two reduced (RHS) semantic arrays, `a` and `b`, into a new array, if the merge is semantically legal. Else, returns `-1`.
 *
 * Note: It is faster to return `-1` and check the return value up the stack than to throw an exception to catch up the stack.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} a The semantic array to merge.
 * @param {Object[]} b The other semantic array to merge.
 * @returns {Object[]|number} Returns the new, merged semantic if semantically legal, else `-1`.
 */
exports.mergeRHS = function (a, b) {
	// Check if semantic merge is legal.
	if (exports.isIllegalRHS(a, b)) {
		return -1
	}

	// Do sort because will be sorted when added to a LHS.
	// `Array.prototype.concat()` is faster than `Array.prototype.slice()` + `Array.prototype.push.apply()`.
	return a.concat(b)
}

/**
 * Checks if reduced (RHS) semantic node arrays `a` and `b` are forbidden to merge as a single set of RHS semantic arguments.
 *
 * The following invalidates semantic arrays:
 * • Duplicate semantics.
 * • Contradictory negations.
 *
 * It is necessary to prevent contradictory and duplicate semantics, even when explicitly input by the user, to prevent undesirable semantics as suggestions. In addition, algebraically simplifying the semantics's logic enables `pfsearch` to correctly identify semantically identical parse trees (whose logical equivalence would be undetectable in their unsimplified forms).
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} a The semantic node array to inspect.
 * @param {Object[]} b The other semantic node array to inspect.
 * @returns {boolean} Returns `true` if the semantics are forbidden to merge, else `false`.
 */
exports.isIllegalRHS = function (a, b) {
	var bLen = b.length

	for (var i = 0, aLen = a.length; i < aLen; ++i) {
		var semanticNodeA = a[i]
		var semanticA = semanticNodeA.semantic
		var semanticAIsNegation = semanticA === notSemantic

		for (var j = 0; j < bLen; ++j) {
			var semanticNodeB = b[j]
			var semanticB = semanticNodeB.semantic

			// Prevent contradiction with `not()` semantic.
			if (semanticAIsNegation && exports.nodesEqual(semanticNodeA.children[0], semanticNodeB)) {
				return true
			}

			// Prevent contradiction with `not()` semantic.
			if (semanticB === notSemantic && exports.nodesEqual(semanticNodeA, semanticNodeB.children[0])) {
				return true
			}

			// Prevent duplicate semantic nodes using a deep comparison.
			if (exports.nodesEqual(semanticNodeA, semanticNodeB)) {
				return true
			}
		}
	}

	return false
}

/**
 * Checks if `semanticList.prev.semantic` is `intersect()` and `semanticList.semantic` contains a semantic identical to `newLHSSemanticNodeArray` for which multiple instances of that semantic function (irrespective of children) are forbidden within the same set of `intersect()` arguments.
 *
 * This check behaves as a semantic lookahead that enables its parse tree's rejection without having to complete `newLHSSemanticNodeArray` and wait for its reduction with `prevLHSSemanticNodeArray` in `semantic.reduce()` to reject the tree for this reason.
 *
 * @static
 * @memberOf semantic
 * @param {Object} semanticList The semantic linked list to inspect.
 * @param {Object[]} newLHSSemanticNodeArray The new semantic, yet to be reduced, which will eventually be concatenated with `semanticList.semantic` as semantic arguments and reduced with `semanticList.prev.semantic`.
 * @returns {boolean} Returns `true` if `semanticList.prev.semantic` is `intersect()` and `semanticList.semantic` contains a semantic identical to `newLHSSemanticNodeArray` for which multiple instances are forbidden within `intersect()`, else `false`.
 */
exports.isForbiddenMultiple = function (semanticList, newLHSSemanticNodeArray) {
	// The outer LHS semantic must be `intersect()` for its arguments (which will be a merge of `rhsSemanticNodeArray` and `newLHSSemanticNodeArray`) to be in logical violation.
	if (semanticList.prev.semantic[0].semantic === intersectSemantic) {
		var rhsSemanticNodeArray = semanticList.semantic
		// `newLHSSemanticNodeArray` will only ever have one semantic (which has yet to be reduced).
		var lhsSemantic = newLHSSemanticNodeArray[0].semantic

		// Check if multiple instances of `lhsSemantic` are forbidden within the same set of `intersect()` arguments; e.g., `users-gender()` has only one mode of being.
		if (lhsSemantic.forbidsMultiple) {
			for (var s = 0, rhsLen = rhsSemanticNodeArray.length; s < rhsLen; ++s) {
				if (rhsSemanticNodeArray[s].semantic === lhsSemantic) {
					return true
				}
			}
		}
	}

	return false
}

/**
 * Checks for multiple instances of the same semantic function marked `forbidsMultiple` in `rhsSemanticNodeArray`.
 *
 * For use by `semantic.reduce()` when the LHS semantic is `intersect()` and `rhsSemanticNodeArray` is to become its semantic arguments when reduced.
 *
 * @private
 * @static
 * @param {Object[]} rhsSemanticNodeArray The semantic node array to check.
 * @returns {boolean} Returns `true` if `rhsSemanticNodeArray` contains multiple instances of the same semantic function marked `forbidsMultiple`, else `false`.
 */
function hasForbiddenMultiple(rhsSemanticNodeArray) {
	for (var s = 0, rhsLen = rhsSemanticNodeArray.length; s < rhsLen; ++s) {
		var semanticNode = rhsSemanticNodeArray[s]
		var semanticDef = semanticNode.semantic
		if (semanticDef.forbidsMultiple) {
			for (var j = s + 1; j < rhsLen; ++j) {
				if (semanticDef === rhsSemanticNodeArray[j].semantic) {
					return true
				}
			}
		}
	}

	return false
}

/**
 * Performs a deep comparison between two semantic nodes, `a` and `b`, to determine if they are equivalent.
 *
 * Requires invoking `initSemantics` on the semantics beforehand, which enables comparing semantics by reference instead of their `name` properties. In addition, `initSemantics` accelerates semantic comparisons by replacing identical semantic trees in the grammar with references to a single object.
 *
 * @static
 * @memberOf semantic
 * @param {Object} a The semantic node to compare.
 * @param {Object} b The other semantic node to compare.
 * @returns {boolean} Returns `true` if the semantics are equivalent, else `false`.
 */
 exports.nodesEqual = function (a, b) {
	// Identical semantics or both `undefined`.
	if (a === b) return true

	// One of two is `undefined`.
	if (!a || !b) return false

	if (a.semantic !== b.semantic) return false

	if (a.children && b.children) {
		// Both are semantic functions.
		return exports.arraysEqual(a.children, b.children)
	} else if (a.children || b.children) {
		// One is a semantic function and other is a semantic argument.
		return false
	}

	// This is never reached.
	return true
}

/**
 * Performs a deep comparison between two semantic node arrays, `a` and `b`, to determine if they are equivalent. Each semantic in the arrays is a reduced (i.e., RHS) semantic.
 *
 * Requires invoking `initSemantics` on the semantics beforehand, which enables comparing semantics by reference instead of their `name` properties. In addition, `initSemantics` accelerates semantic comparisons by replacing identical semantic trees in the grammar with references to a single object.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} a The semantic node array to compare.
 * @param {Object[]} b The other semantic node array to compare.
 * @returns {boolean} Returns `true` if the semantic arrays are equivalent, else `false`.
 */
exports.arraysEqual = function (a, b) {
	// Identical semantic arrays or both `undefined`.
	if (a === b) return true

	// One of two is `undefined`.
	if (!a || !b) return false

	var aLen = a.length
	if (aLen !== b.length) return false

	for (var i = 0; i < aLen; ++i) {
		if (!exports.nodesEqual(a[i], b[i])) return false
	}

	// Semantic arrays are identical.
	return true
}

/**
 * Applies a completed semantic rule (`lhsSemanticNodeArray` -> `rhsSemanticNodeArray`) to a more recent semantic tree (`rhsSemanticNodeArray`), joining them together as one semantic tree with `lhsSemanticNodeArray` as the new root semantic function.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} lhsSemanticNodeArray The LHS non-reduced semantic node array.
 * @param {Object[]} rhsSemanticNodeArray The RHS reduced semantic semantic node array, to be semantic arguments for `lhsSemanticNodeArray`.
 * @returns {Object[]|number} Returns the new, reduced semantic if semantically legal, else `-1`.
 */
exports.reduce = function (lhsSemanticNodeArray, rhsSemanticNodeArray) {
	if (lhsSemanticNodeArray.length !== 1) {
		util.logError('Semantic reduction: lhsSemanticNodeArray.length !== 1')
		util.dir(lhsSemanticNodeArray, rhsSemanticNodeArray)
		throw new Error('Semantic reduction error')
	}

	var lhsSemanticNode = lhsSemanticNodeArray[0]
	var lhsSemantic = lhsSemanticNode.semantic
	var rhsLen = rhsSemanticNodeArray.length

	if (lhsSemantic === intersectSemantic) {
		// Check LHS `intersect()` semantics lack semantic arguments.
		if (lhsSemanticNode.children.length > 0) {
			util.logError('Semantic reduction: LHS `intersect()` has children')
			util.dir(lhsSemanticNodeArray, rhsSemanticNodeArray)
			throw new Error('Semantic reduction error')
		}

		/**
		 * Reject if `rhsSemanticNodeArray` contains a semantic that `requires` another semantic not within this semantic tree.
		 *
		 * This check must occur at `intersect()`, else would incorrectly reject semantics such as the following (because the required semantic is not within `not()`):
		 *   `not(repositories-visibility(public)),repositories-created(me)`
		 *
		 * This check must occur before the `rhsLen === 1` check below, which would require waiting for the next `intersect()` to perform this check, because a semantic tree can lack instances of `intersect()` altogether.
		 */
		if (isMissingRequiredSemantic(rhsSemanticNodeArray)) {
			return -1
		}

		/**
		 * Discard LHS `intersect()` if `rhsSemanticNodeArray` contains only one semantic node.
		 *
		 * If `rhsSemanticNodeArray` is a `union()` semantic node, having reached its parent `intersect()` semantic, assign `isComplete` to the semantic node to prevent `reduceUnion()` from moving the `union()` semantic node too far up its semantic tree.
		 *
		 * Else if `rhsSemanticNodeArray` is an `intersect()` semantic node, having reached its parent `intersect()` semantic, assign `isComplete` to the semantic node to prevent `reduceUnion()` from incorrectly distributing the LHS semantic that follows a `union()` semantic too deep among the arguments of instances of `intersect()` within the `union()` semantic.
		 *
		 * Else, return `rhsSemanticNodeArray` as is.
		 */
		if (rhsLen === 1) {
			return markRHSConjunctionComplete(rhsSemanticNodeArray)
		}

		/**
		 * When LHS is `intersect()`, prevent multiple instances of the same semantic function marked `forbidsMultiple` (e.g., `users-gender()`) within its arguments, `rhsSemanticNodeArray`.
		 *
		 * Only perform `forbidsMultiple` check when LHS is `intersect()`, instead of for any semantic array (via `semantic.mergeRHS()`) to allow for when LHS is `union()`, which is logically valid.
		 */
		else if (hasForbiddenMultiple(rhsSemanticNodeArray)) {
			return -1
		}

		/**
		 * Mark instances of `intersect()` and `union()` in `rhsSemanticNodeArray` as complete having reached their parent `intersect()` semantic.
		 *
		 * For example, the following marks `union()` complete within the RHS array::
		 *   "people who follow me and are followed by Danny or followed by me"
		 *   LHS: `intersect()`
		 *   RHS: `followers(me),union(users-followed(0),users-followed(me))`
		 *
		 * For example, the following marks `intersect()` complete within the RHS array:
		 *   "people who follow Danny or Aang and my followers I follow"
		 *   LHS: `intersect()`
		 *   RHS: `1,intersect(followers(me),users-followed(me))`
		 *
		 *   Following this closure, and in the next `semantic.reduce()` invocation:
		 *   -> `intersect(1,intersect(followers(me),users-followed(me)))`
		 *   -> `union(0,intersect(1,intersect(followers(me),users-followed(me))))`
		 *
		 *   In the final `semantic.reduce()` invocation, `reduceUnion()` distributes the LHS `followers()` semantic among the `union()` and `intersect()` arguments in the RHS:
		 *   LHS: `followers()`
		 *   RHS: union(0,intersect(1,intersect(followers(me),users-followed(me))))
		 *   -> `union(followers(0),intersect(followers(1),followers(intersect(followers(me),users-followed(me)))))`
		 */
		else {
			var rhsSemanticNodeArrayCopy
			for (var s = 0, rhsLen = rhsSemanticNodeArray.length; s < rhsLen; ++s) {
				var rhsSemanticNode = rhsSemanticNodeArray[s]
				if (rhsSemanticNode.semantic === unionSemantic && !rhsSemanticNode.isComplete) {
					if (!rhsSemanticNodeArrayCopy) {
						rhsSemanticNodeArrayCopy = rhsSemanticNodeArray.slice(0, s)
					}

					rhsSemanticNodeArrayCopy.push({
						semantic: rhsSemanticNode.semantic,
						children: rhsSemanticNode.children,
						isComplete: true,
					})
				} else if (rhsSemanticNode.semantic === intersectSemantic) {
					if (rhsSemanticNode.isComplete) {
						util.logError('`rhsSemanticNode` already has `isComplete`', rhsSemanticNode)
						throw new Error('Semantic reduction error')
					}

					if (!rhsSemanticNodeArrayCopy) {
						rhsSemanticNodeArrayCopy = rhsSemanticNodeArray.slice(0, s)
					}

					rhsSemanticNodeArrayCopy.push({
						semantic: rhsSemanticNode.semantic,
						children: rhsSemanticNode.children,
						isComplete: true,
					})
				} else if (rhsSemanticNodeArrayCopy) {
					rhsSemanticNodeArrayCopy.push(rhsSemanticNode)
				}
			}

			if (rhsSemanticNodeArrayCopy) {
				// Reassign after to not affect copying of original
				rhsSemanticNodeArray = rhsSemanticNodeArrayCopy
			}
		}
	}

	/**
	 * Reduce `lhsSemanticNodeArray` with the `rhsSemanticNodeArray` `union()` semantic node by distributing the LHS semantic, `lhsSemanticNodeArray`, among the `union()` semantic arguments, `rhsSemanticNode.children`, creating a new semantic tree with `union()` as the root.
	 *
	 * Invoke `reduceUnion()` after the `intersect()` check, which invokes `markRHSConjunctionComplete()` to assign properties indicating reaching a conjunction's root. Invoke before traversing `lhsSemanticNodeArray` children, if any, to properly distribute all of `lhsSemanticNodeArray` among the `union()` arguments.
	 */
	if (rhsLen === 1) {
		var rhsSemanticNode = rhsSemanticNodeArray[0]
		if (rhsSemanticNode.semantic === unionSemantic && !rhsSemanticNode.isComplete) {
			return reduceUnion(lhsSemanticNodeArray, rhsSemanticNode)
		}
	}

	/**
	 * When `lhsSemanticNode` has semantic arguments, insert `rhsSemanticNodeArray` at innermost semantic function by recursively reducing `lhsSemanticNode.children` with `rhsSemanticNodeArray`, and replacing `rhsSemanticNodeArray` with the resulting semantic tree.
	 *
	 * This operation rebuilds the `lhsSemanticNodeArray` semantic tree while unwrapping, duplicating LHS semantic functions if necessary. For example:
	 *   LHS: `not(repos-liked())`  ->  LHS: `not()`
	 *   RHS: `[ 1, 2 ]`            ->  RHS: `repos-liked(1),repos-liked(2)`
	 *   -> `not(repos-liked(1)),not(repos-liked(2))`
	 *
	 * After replacing `rhsSemanticNodeArray` with `lhsSemanticNode.children`, reduced with the original `rhsSemanticNodeArray`, this function caries on reducing the LHS semantic node with the new `rhsSemanticNodeArray`, ignoring the original children on `lhsSemanticNode`.
	 *
	 * Invoke after invoking `reduceUnion()`, which properly moves a `union()` semantic up a semantic tree and distributes the entire `lhsSemanticNodeArray`, including its semantic children, among the `union()` arguments. For example:
	 *   "repos Danny or Aang do not like"
	 *   LHS: `not(repos-liked())`
	 *   RHS: `union(0,1)`
	 *   -> union(not(repos-liked(0)),not(repos-liked(1)))`
	 */
	if (lhsSemanticNode.children.length > 0) {
		// Replace `rhsSemanticNodeArray` with result of reduction of `lhsSemanticNode.children` with `rhsSemanticNodeArray`. Going forward, ignore `lhsSemanticNode.children` by only referencing `lhsSemanticNode.semantic`.
		rhsSemanticNodeArray = exports.reduce(lhsSemanticNode.children, rhsSemanticNodeArray)

		// Reject for semantic violations found with `lhsSemanticNode.children` and `rhsSemanticNodeArray`.
		if (rhsSemanticNodeArray === -1) {
			return -1
		}

		// Update `rhsLen`, which might have increased by duplicating semantic children for multiple nodes in `rhsSemanticNodeArray`.
		rhsLen = rhsSemanticNodeArray.length
	}

	// Check RHS semantic array satisfies the LHS semantic's minimum argument requirement.
	if (rhsLen < lhsSemantic.minParams) {
		util.logError('Semantic reduction: rhsSemanticNodeArray.length < lhsSemantic.minParams')
		util.dir(lhsSemanticNodeArray, rhsSemanticNodeArray)
		throw new Error('Semantic reduction error')
	}

	if (rhsLen > lhsSemantic.maxParams) {
		/**
		 * When `lhsSemanticNodeArray` has `maxParams` of 1 and `rhsSemanticNodeArray` contains > 1 semantic nodes, reduce a duplicate of the LHS semantic node with each RHS semantic node, and create a merged semantic node array.
		 *
		 * Ignore any children `lhsSemanticNodeArray` might have, because if any they were reduced with `rhsSemanticNodeArray` above.
		 */
		return copyLHSAndReduce(lhsSemanticNodeArray, rhsSemanticNodeArray)
	}

	/**
	 * Reduce `lhsSemanticNodeArray` with `rhsSemanticNodeArray`, whose number of semantic nodes is within the LHS semantic node's `maxParams` bound.
	 *
	 * Ignore any children `lhsSemanticNodeArray` may have, using only the LHS semantic node's function.
	 *
	 * If `lhsSemanticNodeArray` is a `union()` semantic node, first invokes `flattenUnion(rhsSemanticNodeArray)` to remove redundant instances of nested `union()` semantics to enable proper semantic duplicity detection.
	 */
	return baseReduce(lhsSemanticNodeArray, rhsSemanticNodeArray)
}

/**
 * Reduces `lhsSemanticNodeArray`, which has `maxParams` of 1, with `rhsSemanticNodeArray`, which contains > 1 semantic nodes by reducing a duplicate of the LHS semantic node with each RHS semantic node, and creating a merged semantic node array.
 *
 * For example:
 *   "repos liked by Danny and Aang"
 *   LHS: `repos-liked()`
 *   RHS: `[ 0, 1 ]`
 *   -> `repos-liked(0),repos-liked(1)`
 *
 * Ignores any children `lhsSemanticNodeArray` may have, using only the LHS semantic node's function.
 *
 * @private
 * @static
 * @param {Object[]} lhsSemanticNodeArray The LHS semantic node array with `maxParams` 1.
 * @param {Object[]} rhsSemanticNodeArray The RHS semantic node array with > 1 semantic nodes.
 * @returns {Object[]} Returns the new semantic array from reducing `lhsSemanticNodeArray` with `rhsSemanticNodeArray`.
 */
function copyLHSAndReduce(lhsSemanticNodeArray, rhsSemanticNodeArray) {
	if (lhsSemanticNodeArray.length !== 1) {
		util.logError('Semantic reduction: lhsSemanticNodeArray.length !== 1')
		util.dir(lhsSemanticNodeArray, rhsSemanticNodeArray)
		throw new Error('Semantic reduction error')
	}

	var lhsSemantic = lhsSemanticNodeArray[0].semantic
	var rhsLen = rhsSemanticNodeArray.length

	// Check `rhsSemanticNodeArray` has more semantic nodes than the `lhsSemanticNodeArray` `maxParams` bound, requiring `lhsSemanticNodeArray` be copied for each `rhsSemanticNodeArray` semantic node. Else, `baseReduce()` should have been used.
	if (rhsLen <= lhsSemantic.maxParams) {
		util.logError('`copyLHSAndReduce()` invoked with RHS semantic within LHS `maxParams` bound. Use `baseReduce()` instead.')
		util.dir(lhsSemanticNodeArray, rhsSemanticNodeArray)
		throw new Error('Semantic reduction error')
	}
	/**
	 * Check `lhsSemantic.maxParams` is 1.
	 *
	 * If allowing `lhsSemantic.maxParams` > 1, would require dividing RHS semantic nodes into groups among multiple LHS semantic nodes; e.g., 4 RHS semantic nodes halved for 2 LHS semantic nodes.
	 *
	 * This is not supported because it enables a grammar designed to expect a specific positioning of RHS semantic nodes within an array before the array's reduction (and sorting). Though possible, such a design is too complex and should be discouraged because an alternative, straightforward semantic rule structure is always possible.
	 */
	if (lhsSemantic.maxParams !== 1) {
		util.logError('Semantic reduction: rhsSemanticNodeArray.length > lhsSemanticNodeArray.maxParams && lhsSemanticNodeArray.maxParams !== 1')
		util.dir(lhsSemanticNodeArray, rhsSemanticNodeArray)
		throw new Error('Semantic reduction error')
	}

	/**
	 * Copy the LHS semantic for each RHS semantic node. For example:
	 *   "repos liked by Danny and Aang"
	 *   LHS: `repos-liked()`
	 *   RHS: `[ 0, 1 ]`
	 *   -> `repos-liked(0),repos-liked(1)`
	 */
	var newLHSSemanticNodeArray = []
	for (var s = 0; s < rhsLen; ++s) {
		var rhsSemanticNode = rhsSemanticNodeArray[s]

		// Check for `union()` without `isComplete` in the RHS, as opposed to being passed to `reduceUnion()` when RHS has length of 1.
		if (rhsSemanticNode.semantic === unionSemantic && !rhsSemanticNode.isComplete) {
			util.logError('Semantic reduction: incomplete `union()` in semantic RHS with length > 1')
			util.dir(lhsSemanticNodeArray, rhsSemanticNodeArray)
			throw new Error('Semantic reduction error')
		}

		newLHSSemanticNodeArray[s] = {
			semantic: lhsSemantic,
			children: [ rhsSemanticNode ],
		}
	}

	// Need not sort `newLHSSemanticNodeArray`, which will be sorted when reduced as a RHS semantic array.
	return newLHSSemanticNodeArray
}

/**
 * Reduces `lhsSemanticNodeArray` with `rhsSemanticNodeArray`, whose number of semantic nodes is within the `lhsSemanticNodeArray` `maxParams` bound.
 *
 * For example:
 *   LHS: `intersect()`
 *   RHS: `repos-liked(1),repos-liked(2)`
 *   -> `intersect(repos-liked(1),repos-liked(2))`
 *
 * If `lhsSemanticNodeArray` is a `union()` semantic node, first invokes `flattenUnion(rhsSemanticNodeArray)` to remove redundant instances of nested `union()` semantics to enable proper semantic duplicity detection.
 *
 * Ignores any children `lhsSemanticNodeArray` may have, using only the LHS semantic node's function.
 *
 * @private
 * @static
 * @param {Object[]} lhsSemanticNodeArray The LHS semantic node array.
 * @param {Object[]} rhsSemanticNodeArray The RHS semantic node array to reduce with `lhsSemanticNodeArray`.
 * @returns {Object[]|number} Returns the new semantic array from reducing `lhsSemanticNodeArray` with `rhsSemanticNodeArray`, if legal, else -1.
 */
function baseReduce(lhsSemanticNodeArray, rhsSemanticNodeArray) {
	if (lhsSemanticNodeArray.length !== 1) {
		util.logError('Semantic reduction: lhsSemanticNodeArray.length !== 1')
		util.dir(lhsSemanticNodeArray, rhsSemanticNodeArray)
		throw new Error('Semantic reduction error')
	}

	var lhsSemantic = lhsSemanticNodeArray[0].semantic

	// Check `rhsSemanticNodeArray` has fewer semantic nodes than the `lhsSemanticNodeArray` `maxParams` bound. Else, `copyLHSAndReduce()` should have been used.
	if (rhsSemanticNodeArray.length > lhsSemantic.maxParams) {
		util.logError('`baseReduce()` invoked with RHS semantic that exceeds LHS `maxParams` bound. Use `copyLHSAndReduce()` instead.')
		util.dir(lhsSemanticNodeArray, rhsSemanticNodeArray)
		throw new Error('Semantic reduction error')
	}

	if (lhsSemantic === unionSemantic) {
		// If `lhsSemantic` is a `union()` semantic node, replace instances of `union()` semantic nodes within the first (most shallow) level of `rhsSemanticNodeArray` with their child semantic nodes, if any. This removes logically redundant instances of nested `union()` semantics, which enables detecting duplicate semantics within `rhsSemanticNodeArray`.
		rhsSemanticNodeArray = flattenUnion(rhsSemanticNodeArray)

		// Return `-1` if the flattened semantic array is semantically illegal.
		if (rhsSemanticNodeArray === -1) {
			return -1
		}
	}

	// Return an array because it becomes another semantic node's `children`.
	return [ {
		semantic: lhsSemantic,
		// Mutating the shared `rhsSemanticNodeArray` array is inconsequential because all instances must be sorted identically eventually.
		children: rhsSemanticNodeArray.sort(exports.compare),
	} ]
}

/**
 * Checks if `semanticArray` contains a semantic that `requires` another semantic not found elsewhere within `semanticArray`, stopping before instances of the `intersect()` semantic.
 *
 * This check must occur at `intersect()`, else would incorrectly reject semantics such as the following (because the required semantic is not within `not()`):
 *   `not(repositories-visibility(public)),repositories-created(me)`
 *
 * @private
 * @static
 * @param {Object[]} semanticArray The LHS semantic to check for required semantics.
 * @returns {Boolean} Returns `true` if `semanticArray` is missing a required semantic, else `false`.
 */
function isMissingRequiredSemantic(semanticArray, _baseSemanticArray) {
	var baseSemanticArray = _baseSemanticArray || semanticArray

	for (var s = 0, semanticArrayLen = semanticArray.length; s < semanticArrayLen; ++s) {
		var semanticNode = semanticArray[s]
		var semantic = semanticNode.semantic

		// Bind check at `intersect()` semantic.
		if (semantic !== intersectSemantic) {
			if (semantic.requires && !hasSemantic(baseSemanticArray, semantic.requires)) {
				return true
			}

			// Check for child semantics that require semantics within the initial semantic array (i.e., as opposed to checking the same semantic children array for required semantics).
			if (semanticNode.children && isMissingRequiredSemantic(semanticNode.children, baseSemanticArray)) {
				return true
			}
		}
	}

	return false
}

/**
 * Checks if `semanticNodeArray` contains `semanticNode`, stopping before instances of the `intersect()` and `not()` semantics.
 *
 * @private
 * @static
 * @param {Object[]} semanticNodeArray The LHS semantic to check for `semanticNode`.
 * @param {Object} semanticNode The semantic node (from a semantic tree) to find.
 * @returns {Boolean} Returns `true` if semanticNodeArray` contains `semanticNode`, else `false`.
 */
function hasSemantic(semanticNodeArray, semanticNode) {
	for (var s = 0, semanticArrayLen = semanticNodeArray.length; s < semanticArrayLen; ++s) {
		var otherSemanticNode = semanticNodeArray[s]

		// Bind check at `intersect()` and `not()` semantics. The `not()` semantic before the required semantics violates the logic by inversion; e.g., "public repos that are not mine".
		if (otherSemanticNode.semantic !== intersectSemantic && otherSemanticNode.semantic !== notSemantic) {
			if (exports.nodesEqual(otherSemanticNode, semanticNode)) {
				return true
			}

			// Check child semantics for `semanticNode`.
			if (otherSemanticNode.children && hasSemantic(otherSemanticNode.children, semanticNode)) {
				return true
			}
		}
	}

	return false
}

/**
 * Upon reducing `intersect()` with a RHS semantic array of length 1, `rhsSemanticNodeArray`, copies and extends the RHS semantic node with an applicable property, if any, to indicate to `reduceUnion()` having reached the parent `intersect()`. Otherwise, returns `rhsSemanticNodeArray` as is.
 *
 * If `rhsSemanticNodeArray` is a `union()` semantic node, having reached its parent `intersect()` semantic, assign `isComplete` to the semantic node to prevent `reduceUnion()` from moving the `union()` semantic node too far up its semantic tree.
 *
 * Else if `rhsSemanticNodeArray` is an `intersect()` semantic node, having reached its parent `intersect()` semantic, assign `isComplete` to the semantic node to prevent `reduceUnion()` from incorrectly distributing the LHS semantic that follows a `union()` semantic too deep among the arguments of instances of `intersect()` within the `union()` semantic.
 *
 * Else, return `rhsSemanticNodeArray` as is.
 *
 * This function does not mutate `rhsSemanticNodeArray`; rather, it copies the array if changes are needed, else returns the original array.
 *
 * @private
 * @static
 * @param {Object[]} rhsSemanticNodeArray The RHS semantic node array to assign conjunction properties, if applicable.
 * @returns {Object[]} Returns an extended copy of `rhsSemanticNodeArray` with the appropriate conjunction property, if any, else `rhsSemanticNodeArray` unchanged.
 */
function markRHSConjunctionComplete(rhsSemanticNodeArray) {
	// Check `rhsSemanticNodeArray` is of length 1.
	if (rhsSemanticNodeArray.length !== 1) {
		util.logError('markRHSConjunctionComplete: `rhsSemanticNodeArray` is not of length 1:', rhsSemanticNodeArray)
		throw new Error('Semantic reduction error')
	}

	var rhsSemanticNode = rhsSemanticNodeArray[0]

	/**
	 * If `rhsSemanticNodeArray` is a `union()` semantic node, assign `isComplete` to the semantic node to prevent `reduceUnion()` from moving the `union()` semantic node too far up its semantic tree.
	 *
	 * Check `rhsSemanticNode` lacks `isComplete` to avoid unnecessarily recreating the semantic node when it already has the property.
	 */
	if (rhsSemanticNode.semantic === unionSemantic && !rhsSemanticNode.isComplete) {
		return markUnionComplete(rhsSemanticNode)
	}

	// If `rhsSemanticNodeArray` is an `intersect()` semantic node, assign `isComplete` to the semantic node to prevent `reduceUnion()` from incorrectly distributing the LHS semantic that follows a `union()` semantic too deep among the arguments of instances of `intersect()` within the `union()` semantic.
	if (rhsSemanticNode.semantic === intersectSemantic) {
		// Throw an exception if `rhsSemanticNode already has `isComplete`, which could only occur if there are three consecutive `intersect()` semantics.
		if (rhsSemanticNode.isComplete) {
			util.logError('`rhsSemanticNode` already has `isComplete`', rhsSemanticNode)
			throw new Error('Semantic reduction error')
		}

		return markIntersectComplete(rhsSemanticNode)
	}

	// Return `rhsSemanticNodeArray` as is.
	return rhsSemanticNodeArray
}

/**
 * Creates a semantic node array with a copy of `unionSemanticNode` extended with the boolean property `isComplete` defined as `true`.
 *
 * The `isComplete` property prevents reduceUnion()` from moving the `union()` semantic node too far up its semantic tree. Invoke this function when reducing the LHS semantic `intersect()` with a RHS semantic array containing a single `union()` semantic node, `unionSemanticNode`.
 *
 * In the grammar, rules with the `union()` semantic follow the LHS semantic function to which they apply. `reduceUnion()` moves instances of `union()` up a semantic tree and distributes the outer LHS semantic function(s) among the `union()` semantic arguments. For example:
 *   LHS: `lhsFunc()`
 *   RHS: `union(0,intersect(1,followers(me)))`
 *   -> `union(lhsFunc(0),intersect(lhsFunc(1),lhsFunc(followers(me))))`
 *
 * To determine having completed the semantic reduction for a `union()` conjunction, and when to stop moving `union()` up the semantic tree as described, `semantic.reduce()` invokes this function upon reaching the parent `intersect()` semantic (at `[cat-plural]`) to mark `union()` semantic nodes, if any, with the property `isComplete`. `reduceUnion()` checks for this `isComplete` property.
 *
 * This function does not mutate `unionSemanticNode`; rather, it returns an extended copy.
 *
 * @private
 * @static
 * @param {Object} unionSemanticNode The RHS `union()` semantic node being reduced with `intersect()`, for which to extend with `isComplete`.
 * @returns {Object[]} Returns a semantic array with a copy of `unionSemanticNode` extended with the boolean property `isComplete` defined as `true`.
 */
function markUnionComplete(unionSemanticNode) {
	// Check `unionSemanticNode` is a `union()` semantic node.
	if (unionSemanticNode.semantic !== unionSemantic) {
		util.logError('markUnionComplete: `unionSemanticNode` is not a `union()` semantic node:', unionSemanticNode)
		throw new Error('Semantic reduction error')
	}

	// Recreate RHS `union()` semantic node with `isComplete` as `true`. Copy to not mutate the shared resource.
	return [ {
		semantic: unionSemanticNode.semantic,
		children: unionSemanticNode.children,
		isComplete: true,
	} ]
}

/**
 * Creates a semantic node array with a copy of `intersectSemanticNode` extended with the boolean property `isComplete` defined as `true`.
 *
 * The `isComplete` property prevents `reduceUnion()` from incorrectly distributing the LHS semantic that follows a `union()` semantic too deep among the arguments of instances of `intersect()` within the `union()` semantic. Invoke this function when reducing the LHS semantic `intersect()` with a RHS semantic array containing a single `intersect()` semantic node, `intersectSemanticNode`.
 *
 * When an `intersect()` follows another `intersect()` (as is when this function is invoked), then there were no intermediate semantics, which only occurs for `union()` rules in a conjunction rule set.
 * • This LHS `intersect()` is used to separate the two RHS branches on either side of "or", to group the `union()` semantic arguments.
 * • This RHS `intersect()` is the top of a subtree, beginning at `[cat-plural]`.
 *
 * In this case, the LHS semantic that precedes the `union()` semantic in the tree, which precedes this LHS `intersect()` semantic, should not be distributed among this RHS `intersect()` semantic arguments. Hence, recreates `rhsSemanticNode` to define `isComplete` as `true` to prevent `reduceUnion()` from distributing the LHS semantic that follows `union()` among the `rhsSemanticNode` (`intersect()`) semantic arguments.
 *
 * For example, `isComplete` prevents the following incorrect distribution of a LHS semantic function among `union(intersect())` semantic arguments:
 *   "people who like my repos I like or Node.js"
 *   LHS: `likers()`
 *   RHS: `[ 20, intersect(repos-created(me),repos-liked(me)) ]`
 *   With `isComplete` check:    Without check (incorrect):
 *   union(                                union(
 *     likers(                               intersect(
 *       intersect(                            likers(repos-created(me)),
 *         repos-created(me),                  likers(repos-liked(me)) ),
 *         repos-liked(me) ) ),              likers(20) )
 *     likers(20) )
 *
 * This function does not mutate `rhsUnionSemanticNode`; rather, it returns an extended copy.
 *
 * @private
 * @static
 * @param {Object} intersectSemanticNode The RHS `intersect()` semantic node being reduced with `intersect()`, for which to extend with `isComplete`.
 * @returns {Object[]} Returns a semantic array with a copy of `intersectSemanticNode` extended with the boolean property `isComplete` defined as `true`.
 */
function markIntersectComplete(intersectSemanticNode) {
	// Check `intersectSemanticNode` is an `intersect()` semantic node.
	if (intersectSemanticNode.semantic !== intersectSemantic) {
		util.logError('markIntersectComplete: `intersectSemanticNode` is not an `intersect()` semantic node:', intersectSemanticNode)
		throw new Error('Semantic reduction error')
	}

	// Recreate RHS `intersect()` semantic node with `isComplete` as `true`. Copy to not mutate the shared resource.
	return [ {
		semantic: intersectSemanticNode.semantic,
		children: intersectSemanticNode.children,
		isComplete: true,
	} ]
}

/**
 * Reduces `lhsSemanticNodeArray` with `unionSemanticNode` by distributing the LHS semantic, `lhsSemanticNodeArray`, among the `union()` semantic arguments, `unionSemanticNode.children`, and creating a new semantic tree with `union()` as the root.
 *
 * For example:
 *   "repos I or Danny and my followers like"
 *   LHS: `repos-liked()`
 *   RHS: `union(me,intersect(0,followers(me)))`
 *   -> `union(repos-liked(me),intersect(repos-liked(0),repos-liked(followers(me))))`
 *
 * `lhsSemanticNodeArray` can have semantic children. For example:
 *   "repos Danny or Aang do not like"
 *   LHS: `not(repos-liked())`
 *   RHS: `union(0,1)`
 *   -> union(not(repos-liked(0)),not(repos-liked(1)))`
 *
 * This implementation prevents duplicate semantic arguments within `union()`. For example:
 *   "people who follow me or me" -> `union(followers(me),followers(me))` -> -1
 * Though, this semantic is not illogical. It merely can be simplified. Nevertheless, reject this semantic even if input explicitly as such by the user to prevent such unsimplified semantics as suggestions. In addition, it is necessary to fully simplify semantic trees for `pfsearch` to correctly identify semantically identical parse trees (whose logical equivalence would be undetectable in their unsimplified forms).
 *
 * For use by `semantic.reduce(lhsSemanticNodeArray, rhsSemanticNodeArray)`, when `lhsSemanticNodeArray` is an unreduced semantic array and `rhsSemanticNodeArray` contains a single semantic node for `union()` and the property `unionSemanticNode.isComplete` is falsey. Invoke this function after the `intersect()` check in `semantic.reduce()`.
 *
 * @private
 * @static
 * @param {Object[]} lhsSemanticNodeArray The LHS semantic to reduce with `unionSemanticNode.children`.
 * @param {Object} unionSemanticNode The `union()` semantic node.
 * @returns {Object[]|number} Returns the reduced semantic tree with `union()` as the root node if semantically legal, else -1.
 */
function reduceUnion(lhsSemanticNodeArray, unionSemanticNode) {
	// Check `unionSemanticNode` is a `union()` semantic node.
	if (unionSemanticNode.semantic !== unionSemantic) {
		util.logError('reduceUnion: `unionSemanticNode` is not a `union()` semantic node:', unionSemanticNode)
		throw new Error('Semantic reduction error')
	}

	// Check `unionSemanticNode` is the root semantic of a conjunction set.
	if (unionSemanticNode.isComplete) {
		util.logError('reduceUnion: `unionSemanticNode.isComplete` is `true`:', unionSemanticNode)
		throw new Error('Semantic reduction error')
	}

	var newLHSNode = {
		semantic: unionSemantic,
		children: [],
		// Define `isComplete` as `true` to mark the conjunction as complete to prevent `reduceUnion()` from moving this `union()` node any further up the tree.
		isComplete: true,
	}

	/**
	 * Distribute the LHS semantic, `lhsSemanticNodeArray`, among the semantic arguments of `union()`. For example:
	 *   `func(union(0,intersect(1,followers(me))))`
	 *   -> `union(func(0),intersect(func(1),func(followers(me))))`
	 */
	var unionChildren = unionSemanticNode.children
	for (var u = 0, unionChildrenLen = unionChildren.length; u < unionChildrenLen; ++u) {
		var unionChildNode = unionChildren[u]
		if (unionChildNode.semantic === intersectSemantic && !unionChildNode.isComplete) {
			/**
			 * Distribute the LHS semantic among children of `intersect()` within `union()`, created from an "and" pair adjacent to an "or", and put `intersect()` at the root of the resulting semantic tree. For example:
			 *   "(people who follow) `[obj-users]` and `[obj-users]` or (`[obj-users+]`)"
			 *   -> `lhsFunc(intersect(1,followers(me)))`
			 *   -> `intersect(lhsFunc(1),lhsFunc(followers(me)))`
			 *
			 * Check `isComplete` on the `intersect()` semantic node to ensure `lhsSemanticNodeArray` distribution only occurs for `intersect()` instances for the same conjunction rule set as `unionSemanticNode`, and not a subtree. `isComplete` identifies the latter, which occurs when one `intersect()` follows another `intersect()`, where the `union()` conjunction set produced the former and a `[cat-plural]` produced the latter.
			 *
			 * For example, given the following query, the resulting `intersect()` that captures "Danny and my followers" is part of the same rule set as "I or ... like":
			 *   "repos I or Danny and my followers like"
			 *   -> `repos-liked(union(me,intersect(0,followers(me))))`
			 *
			 * In contrast, the following queries contain an `intersect()` semantic within a conjunction that is not part of the `union()` set. For these, `lhsSemanticNodeArray` should not be distributed among the `intersect()` semantic arguments.
			 *   "people who like my repos I like or Node.js"
			 *   With `isComplete` check:    Without check (incorrect):
			 *   union(                                union(
			 *     likers(                               intersect(
			 *       intersect(                            likers(repos-created(me)),
			 *         repos-created(me),                  likers(repos-liked(me)) ),
			 *         repos-liked(me) ) ),              likers(20) )
			 *     likers(20) )
			 *
			 *   "people who follow Danny or my followers who are Danny's followers"
			 *   With `isComplete` check:    Without check (incorrect):
			 *   union(                                union(
			 *     followers(0),                         followers(0),
			 *     followers(                            intersect(
			 *       intersect(                            followers(followers(16)),
			 *         followers(16),                      followers(followers(me)) ) )
			 *         followers(me) ) ) )
			 *
			 * This enforcement of correct intersection logic, in accordance with set theory, enforces correct classification of identical semantic trees (otherwise, some semantically identical trees are uncaught, and vice versa).
			 *
			 * This semantic distribution does not catch all logically duplicate semantics, due to boolean simplification limitations. For example, the third `union()` semantic argument below is logically identical to the union (set) of the first two:
			 *   "people who like my repos I like or my repos Danny likes or my repos I or Danny like"
			 *   -> union(
			 *      repo-likers(
			 *        intersect(repos-created(me),repos-liked(0)) ),
			 *      repo-likers(
			 *        intersect(repos-created(me),repos-liked(me)) ),
			 *      repo-likers(
			 *        intersect(
			 *          repos-created(me),
			 *          union(repos-liked(0),repos-liked(me)) ) ) )
			 * Ideally, this semantic's logic would be completely simplified to catch duplicates, however, it is too rare and complex to justify the algorithmic overhead.
			 */
			var intersectChildNodes = exports.reduce(lhsSemanticNodeArray, unionChildNode.children)

			// Check if reducing `lhsSemanticNodeArray` with the `intersect()` semantic arguments is semantically illegal. Throws an exception because not yet seen, though could be amended to return -1 without issue.
			if (intersectChildNodes === -1) {
				util.logError('reduceUnion: Reducing LHS semantic with `union(intersect())` semantic arguments is illegal')
				util.dir(lhsSemanticNodeArray, unionChildNode)
				throw new Error('`union()` semantic reduction error')
			}

			newLHSNode.children.push({
				semantic: intersectSemantic,
				// Need not sort `intersect()` children because they were sorted before distributing the LHS semantic function, and the order will not change after this reduction because all are prefixed with the same function.
				children: intersectChildNodes,
			})
		} else {
			/**
			 * Reduce with `semantic.reduce()` to handle when `lhsSemanticNodeArray` has semantic children. For example:
			 *   "repos Danny or Aang do not like"
			 *   LHS: `not(repos-liked())`
			 *   RHS: `union(0,1)`
			 *   -> union(not(repos-liked(0)),not(repos-liked(1)))`
			 */
			var semanticChildNodes = exports.reduce(lhsSemanticNodeArray, [ unionChildNode ])

			// Check if reducing `lhsSemanticNodeArray` with the `union()` semantic argument is semantically illegal. Throws an exception because not yet seen, though could be amended to return -1 without issue.
			if (semanticChildNodes === -1) {
				util.logError('reduceUnion: Reducing LHS semantic with `union()` semantic argument is illegal:')
				util.dir(lhsSemanticNodeArray, unionChildNode)
				throw new Error('`union()` semantic reduction error')
			}

			Array.prototype.push.apply(newLHSNode.children, semanticChildNodes)
		}
	}

	// Sort `union()` semantic children.
	newLHSNode.children.sort(exports.compare)

	return [ newLHSNode ]
}

/**
 * Replaces instances of `union()` semantic nodes within the first (most shallow) level of `rhsSemanticNodeArray`, if any, with their child semantic nodes. This removes logically redundant instances of nested `union()` semantics, which enables detecting logically equivalent (i.e., duplicate) semantics. Invoke this function from `semantic.reduce(lhsSemanticNodeArray, rhsSemanticNodeArray)` when `lhsSemanticNodeArray` is `union()`.
 *
 * Nested `union()` semantics occurs in conjunctions. For example:
 *   "people I or `{user}` or `{user}` follow"
 *   `union(func(a),union(func(b),func(c)))` -> `union(func(a),func(b),func(c))`
 *
 * If this flattening occurs, checks the new semantic array is semantically legal, else returns `-1`. For example:
 *   "repos I created or Danny likes or Aang created"
 *   `union(repos-created(me),union(repos-created(1),repos-liked(0)))`
 *   -> `union(repos-created(me),repos-created(1),repos-liked(0))`
 *   -> -1
 *
 * This function primarily handles removing redundant, nested `union()` semantics within a single conjunction rule set. For example:
 *   "repos I or Danny or Aang like"
 *   -> `union(repos-liked(me),union(repos-liked(0),repos-liked(1)))`
 *   -> `union(repos-liked(me),repos-liked(0),repos-liked(1))`
 *
 * Even with an alternative grammar rule design that uses only one `union()` semantic for multiple "or" instances within a single rule set (an implementation of which is located at `lib/old/conjunctionsOneRootUnion`), this function's operation will be needed to detect semantic duplicity across nested conjunction rule sets. For example, the following two queries are semantically identical, but the second query requires removal of a nested `union()` added from a second conjunction rule set.
 *   "my repos I or Danny or my followers like"
 *   "my repos I or Danny like or my followers like"
 *
 * This function does not mutate `rhsSemanticNodeArray`; rather, it copies the array if changes are needed, else returns the original array.
 *
 * @private
 * @static
 * @param {Object[]} rhsSemanticNodeArray The semantic array from which to remove logically redundant, nested `union()` semantic nodes within the most shallow level, if any.
 * @returns {Object[]|number} Returns a copy of `rhsSemanticNodeArray` without `union()` in the most shallow level, if any and semantically legal, else `-1` if the flattened array is semantically illegal, else `rhsSemanticNodeArray` unchanged.
 */
function flattenUnion(rhsSemanticNodeArray) {
	var rhsSemanticNodeArrayCopy
	for (var s = 0, rhsLen = rhsSemanticNodeArray.length; s < rhsLen; ++s) {
		var rhsSemanticNode = rhsSemanticNodeArray[s]

		/**
		 * Replace the `union()` semantic node (within the most shallow level of `rhsSemanticNodeArray`) with the node's child semantic nodes. For example:
		 *   `union(func(a),union(func(b),func(c)))` -> `union(func(a),func(b),func(c))`
		 *
		 * Do not check these nested `union()` nodes for `isComplete`, which indicates the root of a conjunction set to `reduceUnion()`. `markUnionComplete()` assigns `isComplete` upon reaching the parent `intersect()` that follows `union()`, however, every rule with `union()` (in conjunctions) has RHS symbols that only produce rules with `intersect()` to group the `union()` semantic arguments on each side of an "or".
		 *
		 * Hence, `isComplete` does not indicate separate conjunction sets, because any conjunction with multiple instances of "or" will assign `isComplete` to every `union()`. Rather, it is this function's job to remove the redundant, nested `union()` semantics, leaving the only true root `union()`. `reduceUnion()` uses this root `union()` to distinguish multiple conjunction sets within a tree.
		 */
		if (rhsSemanticNode.semantic === unionSemantic) {
			// Copy `rhsSemanticNodeArray` to avoid mutating the shared resource.
			if (!rhsSemanticNodeArrayCopy) {
				rhsSemanticNodeArrayCopy = rhsSemanticNodeArray.slice(0, s)
			}

			/**
			 * Check for illegal semantics after removing redundant, nested `union()` semantics; i.e., duplicates, `not()` contradictions, or `forbidsMultiple` conflicts. For example:
			 *   "repos I created or Danny likes or Aang created"
			 *   `union(repos-created(me),union(repos-created(1),repos-liked(0)))`
			 *   -> `union(repos-created(me),repos-created(1),repos-liked(0))`
			 *   -> -1
			 */
			if (exports.isIllegalRHS(rhsSemanticNode.children, rhsSemanticNodeArrayCopy)) {
				return -1
			}

			/**
			 * Insert the `union()` child semantic nodes in place of the `union()` semantic node.
			 *
			 * Use `Array.prototype.push()` instead of `semantic.mergeRHS()`, which uses `Array.prototype.concat()`, because `rhsSemanticNodeArrayCopy` is already a copy.
			 */
			Array.prototype.push.apply(rhsSemanticNodeArrayCopy, rhsSemanticNode.children)
		} else if (rhsSemanticNodeArrayCopy) {
			/**
			 * Check for illegal semantics after removing redundant, nested `union()` semantics; i.e., duplicates, `not()` contradictions, or `forbidsMultiple` conflicts. For example:
			 *   "people I or Danny follow or I follow"
			 *   `union(union(users-followed(0),users-followed(me)),users-followed(me))`
			 *   -> `union(users-followed(0),users-followed(me),users-followed(me))`
			 *   -> -1
			 */
			if (exports.isIllegalRHS([ rhsSemanticNode ], rhsSemanticNodeArrayCopy)) {
				return -1
			}

			/**
			 * Restore original semantics that are not within nested `union()` semantics.
			 *
			 * Use `Array.prototype.push()` instead of `semantic.mergeRHS()`, which uses `Array.prototype.concat()`, because `rhsSemanticNodeArrayCopy` is already a copy.
			 */
			rhsSemanticNodeArrayCopy.push(rhsSemanticNode)
		}
	}

	// Need not sort if new semantic array; will sort when reducing with LHS.
	return rhsSemanticNodeArrayCopy || rhsSemanticNodeArray
}

/**
 * Recursively compares semantic trees for sorting.
 *
 * Sorts arguments before functions, sorts functions and arguments separately alphabetically, and recursively sorts identical functions by their arguments. This function is used as the compare function for `Array.prototype.sort()`.
 *
 * Semantic argument sorting is necessary to identify duplicate semantic trees.
 *
 * @static
 * @memberOf semantic
 * @param {Object} a The semantic tree to compare.
 * @param {Object} b The other semantic tree to compare.
 * @returns {number} Returns -1 to sort `a` before `b`, 1 to sort `a` after `b`, or 0 to leave `a` and `b` unchanged with respect to each other.
 */
exports.compare = function (a, b) {
	var aIsObject = a.children !== undefined
	var bIsObject = b.children !== undefined

	// `arg,func()`
	if (!aIsObject && bIsObject) {
		return -1
	}

	// `func(),arg`
	if (aIsObject && !bIsObject) {
		return 1
	}

	// `func(),func()`
	if (aIsObject && bIsObject) {
		var aName = a.semantic.name
		var bName = b.semantic.name

		if (aName < bName) return -1
		if (aName > bName) return 1

		// Semantic functions are the same (by name). -> Compare their semantic arguments (children).
		var aChildren = a.children
		var bChildren = b.children
		var returnVal = 0

		for (var i = 0, minLength = Math.min(aChildren.length, bChildren.length); i < minLength; ++i) {
			returnVal = exports.compare(aChildren[i], bChildren[i], a, b)
			if (returnVal) break
		}

		return returnVal
	}

	// Semantic argument, numeric id, or input-number.
	return a === b ? 0 : (a.semantic.name < b.semantic.name ? -1 : 1)
}

/**
 * Checks if `semanticNodeArray` is completely reduced.
 *
 * `semanticNodeArray` is reduced when it does not expect to accept semantic arguments; rather is can be passed to another semantic function (as a RHS semantic). This is the state after every semantic function in the tree has been output by `semantic.reduce()`. This function is used in grammar generation to mark a rule's semantic as RHS or not (properties which are using in parsing).
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} semanticNodeArray The semantic node array to inspect.
 * @returns {boolean} Returns `true` if the `semanticNodeArray` is completely reduced, else `false`.
 */
exports.isReduced = function (semanticNodeArray) {
	for (var s = 0, semanticArrayLen = semanticNodeArray.length; s < semanticArrayLen; ++s) {
		var semanticChildren = semanticNodeArray[s].children
		if (semanticChildren && (semanticChildren.length === 0 || !exports.isReduced(semanticChildren))) {
			return false
		}
	}

	return true
}

/**
 * Checks if `semanticNodeArray` has a semantic function in its first level that can be an antecedent.
 *
 * Semantic functions that can serve as antecedents for anaphora have the property `anaphoraPersonNumber`, defined as 'threePl', which indicates the function represents a set of people.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} semanticNodeArray The semantic node array to inspect.
 * @returns {boolean} Returns `true` if `semanticNodeArray` has an antecedent semantic function, else `false`.
 */
exports.hasAntecedent = function (semanticNodeArray) {
	for (var s = 0, semanticArrayLen = semanticNodeArray.length; s < semanticArrayLen; ++s) {
		if (semanticNodeArray[s].semantic.anaphoraPersonNumber) {
			return true
		}
	}

	return false
}

/**
 * Extend `semantic` with following methods:
 * `semantic.toString(semanticArray)` - Converts `semanticArray` to a string string representation.
 *
 * `semantic.toStylizedString(semanticArray)` - Coverts `semanticArray` to a string representation like `semantic.toString()`, but with syntax highlighting.
 *
 * `semantic.toSimpleObject(semanticArray)` - Converts `semanticArray` to a simple `Object` representation.
 *
 * `semantic.stringToObject(semanticString)` - Converts `semanticString` output by `semantic.toString()` to its original object array format.
 */
Object.assign(exports, require('./semanticUtil'))