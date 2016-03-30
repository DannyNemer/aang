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

// The `intersect()` semantic used by `semantic.reduce()`.
var intersectSemantic
// The `union()` semantic used by `semantic.reduce()`.
var unionSemantic
// The `not()` semantic used by `semantic.isIllegalRHS()` and `hasSemantic()`.
var notSemantic
// If not currently building the grammar, then load the `intersect()`, `union()`, and `not()` semantics from the grammar file, which works for comparisons because of `initSemantics`.
if (require.main.filename !== require.resolve('./buildGrammar')) {
	// Map to `exports._semantics` to enable `semantic.stringToObject()`.
	exports._semantics = require('../grammar.json').semantics

	intersectSemantic = exports._semantics.intersect
	unionSemantic = exports._semantics.union
	notSemantic = exports._semantics.not
}

/**
 * Adds a new semantic function or argument to the grammar.
 *
 * @static
 * @memberOf semantic
 * @param {Object} options The options object.
 * @returns {Object[]} Returns the new semantic.
 */
exports.new = function (options) {
	var semanticArray = options.isArg ? newSemanticArg(options) : newSemanticFunc(options)
	var semanticDef = semanticArray[0].semantic
	var semanticName = semanticDef.name

	// Check for duplicate after invoking `util.illFormedOpts()` on `options` in the appropriate instantiation function above.
	if (grammarUtil.isDuplicateName(semanticName, exports._defLines, 'semantic')) {
		throw new Error('Duplicate semantic name')
	}

	// Save instantiation file path and line number for error reporting.
	exports._defLines[semanticName] = util.getModuleCallerPathAndLineNumber()

	// Save semantics for use by `semantic` methods.
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
 * Adds a new semantic function to the grammar.
 *
 * @private
 * @static
 * @param {Object} options The options object.
 * @returns {Object[]} Returns the new semantic function.
 */
var semanticFuncSchema = {
	// The unique name.
	name: { type: String, required: true },
	// The parsing cost.
	cost: { type: Number, required: true },
	// The minimum number of arguments this semantic function can accept.
	minParams: { type: Number, required: true },
	// The maximum number of arguments this semantic function can accept.
	maxParams: { type: Number, required: true },
	// Specify permitting only one instance of this semantic function in another semantic's RHS.
	// When a database object can only have one value for a specific property (e.g., "repos only created by 1 person"), forbid multiple instances of the corresponding semantic function within another semantic's arguments (irrespective of child semantics). Otherwise, an intersection of objects with different values for this property will return an empty set.
	forbidsMultiple: Boolean,
	// The semantic required to be in the same semantic tree and within the same instances of `intersect()` as this semantic, else the semantic tree is rejected.
	requires: Array,
	// Specify this semantic represents a set of multiple people and can serve as the antecedent for an anaphoric, plural (grammatical number) expression.
	isPeople: Boolean,
}

function newSemanticFunc(options) {
	if (util.illFormedOpts(semanticFuncSchema, options)) {
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
		// The person-number with which to resolve plural, anaphoric expressions (in `pfsearch`), where this semantic is the antecedent.
		semanticDef.anaphoraPersonNumber = 'threePl'
	}

	// An `Array` is necessary for `semantic.arraysEqual()`, generating a non-reduced semantic tree for a rule (i.e., behaving as a non-reduced RHS semantic), and general consistency.
	return [ {
		semantic: semanticDef,
		children: [],
	} ]
}

/**
 * Adds a new semantic argument to the grammar.
 *
 * @private
 * @static
 * @param {Object} options The options object.
 * @returns {Object[]} Returns the new semantic argument.
 */
var semanticArgSchema = {
	// Specify this is a semantic argument.
	isArg: { type: Boolean, required: true },
	// The unique name.
	name: { type: String, required: true },
	// The parsing cost.
	cost: { type: Number, required: true },
}

function newSemanticArg(options) {
	if (util.illFormedOpts(semanticArgSchema, options)) {
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
 * Calculates the sum of the costs of all semantic functions in a semantic tree.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} semanticArray The semantic tree to sum.
 * @returns {number} Returns the sum of the costs in the semantic tree.
 */
exports.sumCosts = function (semanticArray) {
	return semanticArray.reduce(function (accum, cur) {
		return accum + cur.semantic.cost + (cur.children ? exports.sumCosts(cur.children) : 0)
	}, 0)
}

/**
 * Merges two reduced (RHS) semantic arrays into a single array, if the merge is semantically legal. Else, returns `-1`.
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
	if (exports.isIllegalRHS(a, b)) return -1

	// Do sort because will be sorted when added to a LHS.
	// `Array.prototype.concat()` is faster than `Array.prototype.slice()` + `Array.prototype.push.apply()`.
	return a.concat(b)
}

/**
 * Checks if reduced (RHS) semantic arrays `a` and `b` are forbidden to merge as a single set of RHS semantic arguments. This is `true` for the following cases:
 * - There are duplicate semantics.
 * - Violates a semantic's `forbidsMultiple` property.
 * - There are contradictory negations.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} a The semantic array to compare.
 * @param {Object[]} b The other semantic array to compare.
 * @returns {boolean} Returns `true` if the semantics are forbidden to merge, else `false`.
 */
exports.isIllegalRHS = function (a, b) {
	var bLen = b.length

	for (var i = 0, aLen = a.length; i < aLen; ++i) {
		var semanticNodeA = a[i]
		var semanticA = semanticNodeA.semantic
		var semanticAForbidsMultiple = semanticA.forbidsMultiple
		var semanticAIsNegation = semanticA === notSemantic

		for (var j = 0; j < bLen; ++j) {
			var semanticNodeB = b[j]
			var semanticB = semanticNodeB.semantic

			// Prevent multiple instances of this semantic within a RHS (e.g., 'users-gender()').
			if (semanticAForbidsMultiple && semanticA === semanticB) {
				return true
			}

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
 * Checks if a new LHS semantic function (yet to be reduced) exists in the previous RHS semantics (already reduced) and multiple instances of that semantic function (irrespective of children) are forbidden. Hence, it allows its parse tree to be rejected without having to complete the new LHS semantic and later rejecting the tree for this reason in `semantic.mergeRHS()`.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} rhs The most recent set of reduced semantics in a tree that have yet to be reduced into their parent semantic.
 * @param {Object[]} newLHS The new semantic, yet to be reduced, which will eventually be concatenated with `rhs` and share the same parent semantic.
 * @returns {boolean} Returns `true` if `rhs` contains an instance of `newLHS`'s semantic function of which multiple instances are forbidden, else `false`.
 */
exports.isForbiddenMultiple = function (rhs, newLHS) {
	// `newLHS` can only ever have one semantic (which has yet to be reduced).
	var lhsSemantic = newLHS[0].semantic

	if (lhsSemantic.forbidsMultiple) {
		for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
			// Prevent multiple instances of this function within a function's args (e.g., 'users-gender()'').
			if (rhs[s].semantic === lhsSemantic) {
				return true
			}
		}
	}

	return false
}

/**
 * Performs a deep comparison between two semantics to determine if they are equivalent.
 *
 * Requires invoking `initSemantics` on the semantics beforehand, which enables comparing semantics by reference instead of checking their `name` properties. In addition, `initSemantics` accelerates semantic comparisons by replacing identical semantics in the grammar with references to a single object.
 *
 * @static
 * @memberOf semantic
 * @param {Object} a The semantic to compare.
 * @param {Object} b The other semantic to compare.
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
 * Performs a deep comparison between two arrays of semantics to determine if they are equivalent. Each semantic in the arrays is a reduced (i.e., RHS) semantic.
 *
 * Requires invoking `initSemantics` on the semantics beforehand, which enables comparing semantics by reference instead of checking their `name` properties. In addition, `initSemantics` accelerates semantic comparisons by replacing identical semantics in the grammar with references to a single object.
 *
 * @static
 * @memberOf semantic
 * @param {Object} a The semantic array to compare.
 * @param {Object} b The other semantic array to compare.
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
 * Applies a completed semantic rule (`lhs` -> `rhs`) to a more recent semantic tree (`rhs`), joining them together as one semantic tree with `lhs` as the new root function.
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} lhs The LHS non-reduced semantic.
 * @param {Object[]} rhs The array of RHS reduced semantics.
 * @returns {Object[]|number} Returns the new, reduced semantic if semantically legal, else `-1`.
 */
exports.reduce = function (lhs, rhs) {
	if (lhs.length !== 1) {
		util.logError('Semantic reduction: lhs.length !== 1')
		util.dir(lhs, rhs)
		throw new Error('Semantic reduction error')
	}

	var lhsSemanticNode = lhs[0]
	var lhsSemantic = lhsSemanticNode.semantic
	var rhsLen = rhs.length

	if (lhsSemantic === intersectSemantic) {
		if (lhsSemanticNode.children.length > 0) {
			util.logError('Semantic reduction: LHS `intersect()` has children')
			util.dir(lhs, rhs)
			throw new Error('Semantic reduction error')
		}

		/**
		 * Reject if `rhs` contains a semantic that `requires` another semantic not within this semantic tree, stopping before instances of the `intersect()` semantic.
		 *
		 * This check must occur at `intersect()`, else semantics such as the following would be rejected (because the required semantic is not within `not()`):
		 *   `not(repositories-visibility(public)),repositories-created(me)`
		 *
		 * This check must occur before the check below (for when the `lhs` is `intersect()` and `rhs` is a single semantic) because it is possible for a semantic tree to lack `intersect()`.
		 */
		if (isMissingRequiredSemantic(rhs)) {
			return -1
		}

		// Do not reduce `intersect()` with `rhs` if `rhs` only contains one semantic node.
		if (rhsLen === 1) {
			/**
			 * If `rhs` is a `union()` semantic node, having reached its parent `intersect()` semantic, assign `isCompletedUnion` to the semantic node to prevent `reduceUnion()` from moving the `union()` semantic node too far up its semantic tree.
			 *
			 * Else if `rhs` is an `intersect()` semantic node, having reached its parent `intersect()` semantic, assign `isCompletedIntersect` to the semantic node to prevent `reduceUnion()` from incorrectly distributing the LHS semantic that follows a `union()` semantic too far amongst instances of `intersect()` within the `union()` semantic.
			 *
			 * Else, return `rhs` as is.
			 */
			return markRHSConjunctionComplete(rhs)
		}
	}

	/**
	 * Reduce `lhs` with the `rhs` `union()` semantic node by distributing the LHS semantic, `lhs`, among the `union()` semantic arguments, `rhsSemanticNode.children`, creating a new semantic tree with `union()` as the root.
	 *
	 * Invoke `reduceUnion()` after the `intersect()` check, which invokes `markRHSConjunctionComplete()` to assign properties indication reaching a conjunction's root. Invoke before traversing `lhs` children, if any, to properly distribute all of `lhs` among the `union()` arguments.
	 */
	if (rhsLen === 1) {
		var rhsSemanticNode = rhs[0]
		if (rhsSemanticNode.semantic === unionSemantic && !rhsSemanticNode.isCompletedUnion) {
			return reduceUnion(lhs, rhsSemanticNode)
		}
	}

	/**
	 * Insert `rhs` at innermost semantic function, and rebuild the `lhs` semantic tree while unwrapping,duplicating LHS semantic functions if necessary. For example:
	 *   LHS: `not(repos-liked())`
	 *   RHS: `[ 1, 2 ]`
	 *   -> `not(repos-liked(1),repos-liked(2)) -> `not(repos-liked(1)),not(repos-liked(2))`
	 *
	 * Invoke after invoking `reduceUnion()`, which properly moves a `union()` semantic up a semantic tree and distributes the entire `lhs` among the `union()` arguments. For example:
	 *   "repos Danny or Aang do not like"
	 *   LHS: `not(repos-liked())`
	 *   RHS: `union(0,1)`
	 *   -> union(not(repos-liked(0)),not(repos-liked(1)))`
	 */
	if (lhsSemanticNode.children.length > 0) {
		rhs = exports.reduce(lhsSemanticNode.children, rhs)

		// Reject for semantic violations found with `lhsSemanticNode.children` and `rhs`.
		if (rhs === -1) {
			return -1
		}

		// Update `rhsLen`, which might have increased from duplicating semantic children for multiple nodes in `rhs`.
		rhsLen = rhs.length
	}

	if (rhsLen < lhsSemantic.minParams) {
		util.logError('Semantic reduction: rhs.length < minParams')
		util.dir(lhs, rhs)
		throw new Error('Semantic reduction error')
	}

	if (rhsLen > lhsSemantic.maxParams) {
		if (lhsSemantic.maxParams > 1) {
			util.logError('Semantic reduction: rhs.length > lhs.maxParams && lhs.maxParams > 1')
			util.dir(lhs, rhs)
			throw new Error('Semantic reduction error')
		}

		// Check if `lhsSemantic` forbids multiple instances, yet the rules enabled it to receive multiple semantic arguments (i.e., the grammar should prevent this).
		if (lhsSemantic.forbidsMultiple) {
			util.logError('Semantic reduction: rhs.length > lhs.maxParams and lhs.forbidsMultiple')
			util.dir(lhs, rhs)
			throw new Error('Semantic reduction error')
		}

		// Copy the LHS semantic for each RHS semantic.
		// - "repos liked by me and my followers" -> copy `repos-liked()` for each child.
		var newLHS = []
		for (var s = 0; s < rhsLen; ++s) {
			var rhsSemanticNode = rhs[s]

			// Check for `union()` without `isCompletedUnion` in the RHS, as opposed to being caught above and passed to `reduceUnion()` when RHS length of 1.
			if (rhsSemanticNode.semantic === unionSemantic && !rhsSemanticNode.isCompletedUnion) {
				util.logError('Semantic reduction: incomplete `union()` in semantic RHS with length > 1')
				util.dir(lhs, rhs)
				throw new Error('Semantic reduction error')
			}

			newLHS[s] = {
				semantic: lhsSemantic,
				children: [ rhsSemanticNode ],
			}
		}

		return newLHS
	}

	if (lhsSemantic === unionSemantic) {
		// If `lhsSemantic` is a `union()` semantic node, replace instances of `union()` semantic nodes within the first (most shallow) level of `rhs` with their child semantic nodes, if any. This removes logically redundant instances of nested `union()` semantics, which enables detecting duplicate semantics.
		rhs = flattenUnion(rhs)

		// Return `-1` if the flattened semantic array is semantically illegal.
		if (rhs === -1) {
			return -1
		}
	}

	// Return an array because it becomes another semantic node's `children`.
	return [ {
		semantic: lhsSemantic,
		// Mutating the shared `rhs` array is inconsequential because all will needed to be sorted (the same) eventually.
		children: rhs.sort(exports.compare),
	} ]
}

/**
 * Checks if `semanticArray` contains a semantic that `requires` another semantic not within this semantic tree, stopping before instances of the `intersect()` semantic.
 *
 * This check must occur at `intersect()`, else semantics such as the following would be rejected (because the required semantic is not within `not()`):
 *   `not(repositories-visibility(public)),repositories-created(me)`
 *
 * @private
 * @static
 * @param {Object[]} semanticArray The LHS semantic to check for required semantics.
 * @returns {Boolean} Returns `true` if `semanticArray` is missing a required semantic, else `false`.
 */
function isMissingRequiredSemantic(semanticArray, baseSemanticArray) {
	var baseSemanticArray = baseSemanticArray || semanticArray

	for (var s = 0, semanticArrayLen = semanticArray.length; s < semanticArrayLen; ++s) {
		var semanticNode = semanticArray[s]
		var semantic = semanticNode.semantic

		// Bind check at `intersect()` semantic.
		if (semantic !== intersectSemantic) {
			if (semantic.requires && !hasSemantic(baseSemanticArray, semantic.requires)) {
				return true
			}

			// Check for child semantics that require semantics within the initial semantic array (i.e., as opposed to checking the semantic children array for required semantics).
			if (semanticNode.children && isMissingRequiredSemantic(semanticNode.children, baseSemanticArray)) {
				return true
			}
		}
	}

	return false
}

/**
 * Checks if `semanticArray` contains `semanticNode`, stopping before instances of the `intersect()` and `not()` semantics.
 *
 * @private
 * @static
 * @param {Object[]} semanticArray The LHS semantic to check for `semanticNode`.
 * @param {Object} semanticNode The semantic node (from a semantic tree) to look for.
 * @returns {Boolean} Returns `true` if semanticArray` contains `semanticNode`, else `false`.
 */
function hasSemantic(semanticArray, semanticNode) {
	for (var s = 0, semanticArrayLen = semanticArray.length; s < semanticArrayLen; ++s) {
		var otherSemanticNode = semanticArray[s]

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
 * If `rhsSemanticNodeArray` is a `union()` semantic node, having reached its parent `intersect()` semantic, assign `isCompletedUnion` to the semantic node to prevent `reduceUnion()` from moving the `union()` semantic node too far up its semantic tree.
 *
 * Else if `rhsSemanticNodeArray` is an `intersect()` semantic node, having reached its parent `intersect()` semantic, assign `isCompletedIntersect` to the semantic node to prevent `reduceUnion()` from incorrectly distributing the LHS semantic that follows a `union()` semantic too far amongst instances of `intersect()` within the `union()` semantic.
 *
 * Else, return `rhsSemanticNodeArray` as is.
 *
 * This function does not mutate `rhsSemanticNodeArray`; rather, it copies the array if changes are needed, else returns the original array.
 *
 * @private
 * @static
 * @param {Object[]} rhsSemanticNodeArray [description]
 * @returns {Object[]} Returns a modified copy of `rhsSemanticNodeArray` with the appropriate conjunction property, if any, else `rhsSemanticNodeArray` unchanged.
 */
function markRHSConjunctionComplete(rhsSemanticNodeArray) {
	// Check `rhsSemanticNodeArray` is of length 1.
	if (rhsSemanticNodeArray.length !== 1) {
		util.logError('markRHSConjunctionComplete: `rhsSemanticNodeArray` is not of length 1:', rhsSemanticNodeArray)
		throw new Error('Semantic reduction error')
	}

	var rhsSemanticNode = rhsSemanticNodeArray[0]

	/**
	 * If `rhsSemanticNodeArray` is a `union()` semantic node, assign `isCompletedUnion` to the semantic node to prevent `reduceUnion()` from moving the `union()` semantic node too far up its semantic tree.
	 *
	 * Check `rhsSemanticNode` lacks `isCompletedUnion` to avoid unnecessarily recreating the semantic node when it already has the property.
	 */
	if (rhsSemanticNode.semantic === unionSemantic && !rhsSemanticNode.isCompletedUnion) {
		return markUnionComplete(rhsSemanticNode)
	}

	// If `rhsSemanticNodeArray` is an `intersect()` semantic node, assign `isCompletedIntersect` to the semantic node to prevent `reduceUnion()` from incorrectly distributing the LHS semantic that follows a `union()` semantic too far amongst instances of `intersect()` within the `union()` semantic.
	if (rhsSemanticNode.semantic === intersectSemantic) {
		// Check if `rhsSemanticNode already has `isCompletedIntersect`, which could only occur if there are three consecutive `intersect()` semantics.
		if (rhsSemanticNode.isCompletedIntersect) {
			util.logError('`rhsSemanticNode` already has `isCompletedIntersect`', rhsSemanticNode)
			throw new Error('Semantic reduction error')
		}

		return markIntersectComplete(rhsSemanticNode)
	}

	// Return `rhsSemanticNodeArray` as is.
	return rhsSemanticNodeArray
}

/**
 * Creates a semantic node array with a copy of `unionSemanticNode` extended with the boolean property `isCompletedUnion` defined as `true`. This property prevents reduceUnion()` from moving the `union()` semantic node too far up its semantic tree. Invoke this function when reducing the LHS semantic `intersect()` with a RHS semantic array containing a single `union()` semantic node, `unionSemanticNode`.
 *
 * In the grammar, rules with the `union()` semantic follow the LHS semantic function to which they apply. `reduceUnion()` moves instances of `union()` up a semantic tree and distributes the outer LHS semantic function(s) among the `union()` semantic arguments. For example:
 *   LHS: `lhsFunc()`
 *   RHS: `union(0,intersect(1,followers(me)))`
 *   -> `union(lhsFunc(0),intersect(lhsFunc(1),lhsFunc(followers(me))))`
 *
 * To determine having completed the semantic reduction for a `union()` conjunction, and when to stop moving `union()` up the semantic tree as described, `semantic.reduce()` invokes this function upon reaching the parent `intersect()` semantic to mark `union()` semantic nodes, if any, with the property `isCompletedUnion`. `reduceUnion()` then checks for the `isCompletedUnion` property.
 *
 * This function does not mutate `unionSemanticNode`; rather, it returns a modified copy.
 *
 * @private
 * @static
 * @param {Object} unionSemanticNode The RHS `union()` semantic node being reduced with `intersect()`, for which to extend with `isCompletedUnion`.
 * @returns {Object[]} Returns a semantic array with a copy of `unionSemanticNode` extended with the boolean property `isCompletedUnion` defined as `true`.
 */
function markUnionComplete(unionSemanticNode) {
	// Check `unionSemanticNode` is a `union()` semantic node.
	if (unionSemanticNode.semantic !== unionSemantic) {
		util.logError('markUnionComplete: `unionSemanticNode` is not a `union()` semantic node:', unionSemanticNode)
		throw new Error('Semantic reduction error')
	}

	// Recreate RHS `union()` semantic node with `isCompletedUnion` as `true`. Copy to not mutate the shared resource.
	return [ {
		semantic: unionSemanticNode.semantic,
		children: unionSemanticNode.children,
		isCompletedUnion: true,
	} ]
}

/**
 * Creates a semantic node array with a copy of `intersectSemanticNode` extended with the boolean property `isCompletedIntersect` defined as `true`. This property prevents `reduceUnion()` from incorrectly distributing the LHS semantic that follows a `union()` semantic too far amongst instances of `intersect()` within the `union()` semantic. Invoke this function when reducing the LHS semantic `intersect()` with a RHS semantic array containing a single `intersect()` semantic node, `intersectSemanticNode`.
 *
 * When an `intersect()` follows an `intersect()` (as is when this function is invoked), then there were no intermediate semantics, which only occurs for `union()` rules in a conjunction rule set.
 *
 * This LHS `intersect()` is used to separate the two RHS branches on either side of "or", to group the `union()` semantic arguments. This RHS `intersect()` is the top of a subtree, beginning at `[cat-plural]`.
 *
 *  In this case, the LHS semantic that is above the `union()` semantic, which is above this LHS `intersect()` semantic, should not be distributed among this RHS `intersect()` semantic arguments. Hence, recreates `rhsSemanticNode` to define the `isCompletedIntersect` as `true` to prevent `reduceUnion()` from distributing the LHS semantic that will follow `union()` among the `rhsSemanticNode` semantic children.
 *
 * This function does not mutate `rhsUnionSemanticNode`; rather, it returns a modified copy.
 *
 * @private
 * @static
 * @param {Object} intersectSemanticNode The RHS `intersect()` semantic node being reduced with `intersect()`, for which to extend with `isCompletedIntersect`.
 * @returns {Object[]} Returns a semantic array with a copy of `intersectSemanticNode` extended with the boolean property `isCompletedIntersect` defined as `true`.
 */
function markIntersectComplete(intersectSemanticNode) {
	// Check `intersectSemanticNode` is an `intersect()` semantic node.
	if (intersectSemanticNode.semantic !== intersectSemantic) {
		util.logError('markIntersectComplete: `intersectSemanticNode` is not an `intersect()` semantic node:', intersectSemanticNode)
		throw new Error('Semantic reduction error')
	}

	// Recreate RHS `intersect()` semantic node with `isCompletedIntersect` as `true`. Copy to not mutate the shared resource.
	return [ {
		semantic: intersectSemanticNode.semantic,
		children: intersectSemanticNode.children,
		isCompletedIntersect: true,
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
 *   "repos Danny or Aang do not like"
 *   LHS: `not(repos-liked())`
 *   RHS: `union(0,1)`
 *   -> union(not(repos-liked(0)),not(repos-liked(1)))`
 *
 * For use by `semantic.reduce(lhs, rhs)`, when `lhs` is an unreduced semantic array and `rhs` is a semantic array with a single semantic node for `union()` and the boolean property `unionSemanticNode.isCompletedUnion` is falsey. Invoke this function after the `intersect()` check in `semantic.reduce()`.
 *
 * @private
 * @static
 * @param {Objct} lhsSemanticNodeArray The LHS semantic tree to reduce with `unionSemanticNode.children`.
 * @param {Object} unionSemanticNode The `union()` semantic node.
 * @returns {Object[]} Returns the reduced semantic tree with `union()` as the root node.
 */
function reduceUnion(lhsSemanticNodeArray, unionSemanticNode) {
	// Check `unionSemanticNode` is a `union()` semantic node.
	if (unionSemanticNode.semantic !== unionSemantic) {
		util.logError('reduceUnion: `unionSemanticNode` is not a `union()` semantic node:', unionSemanticNode)
		throw new Error('Semantic reduction error')
	}

	// Check `unionSemanticNode` is the root semantic of a conjunction set.
	if (unionSemanticNode.isCompletedUnion) {
		util.logError('reduceUnion: `unionSemanticNode.isCompletedUnion` is `true`:', unionSemanticNode)
		throw new Error('Semantic reduction error')
	}

	var newLHSNode = {
		semantic: unionSemantic,
		children: [],
		// Define `isCompletedUnion` as `true` to mark the conjunction as complete to prevent `reduceUnion()` from moving the semantic node any further up the tree.
		isCompletedUnion: true,
	}

	/**
	 * Distribute the LHS semantic, `lhsSemanticNodeArray`, among the semantic arguments of `union()`. For example:
	 *   `func(union(0,intersect(1,followers(me))))` -> `union(func(0),intersect(func(1),func(followers(me))))`
	 */
	var unionChildren = unionSemanticNode.children
	for (var u = 0, unionChildrenLen = unionChildren.length; u < unionChildrenLen; ++u) {
		var unionChildNode = unionChildren[u]
		if (unionChildNode.semantic === intersectSemantic && !unionChildNode.isCompletedIntersect) {
			/**
			 * Distribute the LHS semantic among children of `intersect()`, created from an "and" pair between instances of "or", and put `intersect()` at the root of the resulting semantic tree. For example:
			 *   "(people who follow) `[obj-users]` and `[obj-users]` or (`[obj-users+]`)"
			 *   `lhsFunc(intersect(1,followers(me)))` -> `intersect(lhsFunc(1),lhsFunc(followers(me)))`
			 *
			 * Check `isCompletedIntersect` on the `intersect()` semantic node to ensure the `lhsSemanticNodeArray` distribution only occurs for `intersect()` instances for the same conjunction rule set as `unionSemanticNode`, and not a nested, different rule set. For example, in the following query, the resulting `intersect()` that captures "Danny and my followers" is part of the same rule set as "I or ... like".
			 *   "repos I or Danny and my followers like"
			 *   `repos-liked(union(me,intersect(0,followers(me))))`
			 *
			 * In contrast, consider the following queries that contain an `intersect()` semantic within a conjunction that is not part of the conjunction rule set, for which `lhsSemanticNodeArray` should not be distributed among the semantic arguments.
			 *   "people who like my repos I like or Node.js"
			 *   With `isCompletedIntersect` check:    Without check (incorrect):
			 *   union(                                union(
			 *     likers(                               intersect(
			 *       intersect(                            likers(repos-created(me)),
			 *         repos-created(me),                  likers(repos-liked(me)) ),
			 *         repos-liked(me) ) ),              likers(20) )
			 *     likers(20) )
			 *
			 *   "people who follow Danny or my followers who are Danny's followers"
			 *   With `isCompletedIntersect` check:    Without check (incorrect):
			 *   union(                                union(
			 *     followers(0),                         followers(0),
			 *     followers(                            intersect(
			 *       intersect(                            followers(followers(16)),
			 *         followers(16),                      followers(followers(me)) ) )
			 *         followers(me) ) ) )
			 *
			 * This enforcement of correct intersection logic, in accordance with set theory, enforces correct classification of identical semantic trees (otherwise, some semantically identical are not caught and other semantically distinct queries are incorrectly classified as identical).
			 */
			newLHSNode.children.push({
				semantic: intersectSemantic,
				// Need not sort `intersect()` children because they were sorted before distributing the LHS semantic function, and the order will not change because all are prefixed with the same function.
				children: exports.reduce(lhsSemanticNodeArray, unionChildNode.children),
			})
		} else {
			Array.prototype.push.apply(newLHSNode.children, exports.reduce(lhsSemanticNodeArray, [ unionChildNode ]))
		}
	}

	// Sort `union()` semantic children.
	newLHSNode.children.sort(exports.compare)

	return [ newLHSNode ]
}

/**
 * Replaces instances of `union()` semantic nodes within the first (most shallow) level of `rhsSemanticNodeArray`, if any, with their child semantic nodes. This removes logically redundant instances of nested `union()` semantics, which enables detecting duplicate semantics. Invoke this function from `semantic.reduce(lhs, rhs)` when `lhs` is `union()`.
 *
 * This semantic tree structure occurs in conjunctions. For example:
 *   "people I or {user} or {user} follow"
 *   `union(func(a),union(func(b),func(c)))` -> `union(func(a),func(b),func(c))`
 *
 * If such flattening occurs, checks the new semantic array is semantically legal, else returns `-1`. For example:
 *   "repos I created or Danny likes or Aang created"
 *   `union(repos-created(me),union(repos-created(1),repos-liked(0)))`
 *   -> `union(repos-created(me),repos-created(1),repos-liked(0))`
 *   -> -1
 *
 * This function primarily handles removing redundant, nested `union()` semantics within a single conjunction rule set. For example:
 *   "repos I or Danny or Aang like"
 *   -> union(repos-liked(me),union(repos-liked(0),repos-liked(1)))`
 *   -> union(repos-liked(me),repos-liked(0),repos-liked(1))`
 *
 * Even with an alternative grammar rule design that uses only one `union()` semantic for multiple "or" instances within a single rule set (an implementation of which is located at `lib/old/conjunctionsOneRootUnion`), this operation is needed to detect semantic duplicity across nested conjunction rule sets. For example, the following two queries are semantically identical, but the second query requires removal of a nested `union()` added from a nested, separate conjunction rule set.
 *   "my repos I or Danny or my followers like"
 *   "my repos I or Danny like or my followers like"
 *
 * This function does not mutate `rhsSemanticNodeArray`; rather, it copies the array if changes are needed, else returns the original array.
 *
 * @private
 * @static
 * @param {Object[]} rhsSemanticNodeArray The semantic array from which to replace `union()` semantic nodes within the most shallow level, if any, with their child semantic nodes.
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
		 * Do not check for `isCompletedUnion` because there is an `intersect()` for each RHS symbol of rules with `union()` to group the semantics between instances of "or". Hence, those `intersect()` instances are not separating sections of the tree, which `reduceUnion()` looks for with `isCompletedUnion`. Rather, because reducing `union()` with a RHS that also has `union()`, the semantics are part of the same conjunction parse subtree.
		 */
		if (rhsSemanticNode.semantic === unionSemantic) {
			// Copy `rhsSemanticNodeArray` to avoid mutating the shared resource.
			if (!rhsSemanticNodeArrayCopy) {
				rhsSemanticNodeArrayCopy = rhsSemanticNodeArray.slice(0, s)
			}

			// Insert the `union()` child semantic nodes in place of the `union()` node.
			rhsSemanticNodeArrayCopy = exports.mergeRHS(rhsSemanticNodeArrayCopy, rhsSemanticNode.children)

			/**
			 * Check the merged semantic array is legal; i.e., no duplicates, `not()` contradictions, or `forbidsMultiple` conflicts. For example:
			 *   "repos I created or Danny likes or Aang created"
			 *   `union(repos-created(me),union(repos-created(1),repos-liked(0)))`
			 *   -> `union(repos-created(me),repos-created(1),repos-liked(0))`
			 *   -> -1
			 */
			if (rhsSemanticNodeArrayCopy === -1) {
				return -1
			}
		} else if (rhsSemanticNodeArrayCopy) {
			rhsSemanticNodeArrayCopy.push(rhsSemanticNode)
		}
	}

	return rhsSemanticNodeArrayCopy || rhsSemanticNodeArray
}

/**
 * Recursively compares semantic trees for sorting.
 *
 * Sorts arguments before functions, sorts functions and arguments separately alphabetically, and recursively sorts identical functions by their arguments. This function is used as the compare function for `Array.prototype.sort()`.
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

		// Same semantic function (by name).
		// Compare semantic children.
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
 * Checks if `semanticArray` is completely reduced.
 *
 * `semanticArray` is reduced when it does not expect to accept semantic arguments; rather is can be passed to another semantic function (as a RHS semantic). This is the state after every function in the tree has been output by `semantic.reduce()`. This function is used in grammar generation to mark a rule's semantic as RHS or not (properties which are using in parsing).
 *
 * @static
 * @memberOf semantic
 * @param {Object[]} semanticArray The semantic tree to inspect.
 * @returns {boolean} Returns `true` if the `semanticArray` is completely reduced, else `false.
 */
exports.isReduced = function (semanticArray) {
	for (var s = 0, semanticArrayLen = semanticArray.length; s < semanticArrayLen; ++s) {
		var semanticChildren = semanticArray[s].children
		if (semanticChildren && (semanticChildren.length === 0 || !exports.isReduced(semanticChildren))) {
			return false
		}
	}

	return true
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