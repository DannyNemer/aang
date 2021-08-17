var semantic = require('../grammar/semantic')
var resolveAnaphora = require('./resolveAnaphora')


/**
 * When no semantics can follow this node/branch (e.g., a terminal rule),
 * appends a RHS semantic, if any, to the previous path's semantic list, and
 * then reduces the path's semantic tree up to the first incompletely reduced
 * node.
 *
 * Fails if resulting semantic is illegal (e.g., duplicates within a RHS
 * semantic), and then returns `-1`.
 *
 * Only invoked from `createPath()` on terminal nodes, because all other
 * reductions know `ruleProps.rhsSemantic` exists and use
 * `baseReduceSemanticTree()`.
 *
 * @private
 * @static
 * @param {Object} semanticList The previous path's semantic linked list to
 * append and reduce.
 * @param {number} nextNodeCount The number of nodes in the previous path's
 * `nextItemList` that can produce a semantic. Used to determine if a RHS
 * semantic is complete (no more semantics will follow it) and can be reduced
 * with the preceding LHS semantic.
 * @param {Object} ruleProps The terminal rule's rule properties.
 * @param {Object[]} [ruleProps.rhsSemantic] The rule's RHS semantic.
 * @param {string} [ruleProps.anaphoraPersonNumber] The person-number of the
 * referent anaphor with which the antecedent semantic must match.
 * @returns {Object|number} Returns the reduced semantic linked list if
 * reduction is semantically legal, else `-1`.
 */
exports.reduceSemanticTree = function (semanticList, nextNodeCount, ruleProps) {
	if (ruleProps.semantic) {
		// Append `ruleProps.semantic` to `semanticList` and reduce up to the
		// first incompletely reduced node.
		return exports.baseReduceSemanticTree(semanticList, nextNodeCount, ruleProps.semantic)
	}

	// `anaphoraPersonNumber` appears on terminal rules following
	// ``flattenTermSequence`.
	if (ruleProps.anaphoraPersonNumber) {
		// Resolve anaphora by copying the matching antecedent semantic. Only
		// invoked here (not in `baseReduceSemanticTree()`) because
		// `anaphoraPersonNumber` only occurs on nonterminal rules.
		var newRHSSemantic = resolveAnaphora(semanticList, ruleProps.anaphoraPersonNumber)
		if (newRHSSemantic === -1) {
			return -1
		}

		// Reduce the path's semantic tree up to the first incompletely reduced
		// node because no semantics can follow this node/branch.
		return exports.baseReduceSemanticTree(semanticList, nextNodeCount, newRHSSemantic)
	}

	if (semanticList.isRHS) {
		var prevSemanticListItem = semanticList.prev

		/**
		 * Instead of blindly passing `semanticList.semantic` to
		 * `baseReduceSemanticTree()` as `rhsSemantic` , check if the loop in
		 * `baseReduceSemanticTree()` will fail to avoid unnecessarily
		 * recreating `semanticList` in the function. This condition is true for
		 * 92% of occurrences.
		 */
		if (!prevSemanticListItem || nextNodeCount > prevSemanticListItem.nextNodeCount) {
			return semanticList
		}

		// Reduce the semantic list up to the first incompletely reduced node.
		return exports.baseReduceSemanticTree(prevSemanticListItem, nextNodeCount, semanticList.semantic)
	}

	if (nextNodeCount <= semanticList.nextNodeCount) {
		// Attempting to reduce a LHS semantic without RHS arguments. Currently,
		// only ever `intersect()` and `not()`; e.g., "people who follow people".
		return -1
	}

	return semanticList
}

/**
 * The base implementation of `reduceSemanticTree()`, without support for
 * handling no `rhsSemantic` argument, that appends a RHS semantic to the
 * previous path's semantic list, and then reduces the path's semantic tree
 * up to the first incompletely reduced node.
 *
 * Merges the rule's semantic, if any, with the preceding RHS semantic(s),
 * if any. Then reduces the RHS semantics with any preceding LHS semantics
 * in the tree, up to a LHS semantic whose parse node has a second child
 * node (i.e., a second branch) yet to be reduced. I.e., a LHS semantic can
 * only be reduced after all of the RHS semantics have been found.
 *
 * Fails if resulting semantic is illegal (e.g., duplicates within a RHS
 * semantic), and then returns `-1`.
 *
 * @private
 * @static
 * @param {Object} semanticList The previous path's semantic linked list to
 * append and reduce.
 * @param {number} nextNodeCount The number of nodes in the previous path's
 * `nextItemList` that can produce a semantic. Used to determine if a RHS
 * semantic is complete (no more semantics will follow it) and can be
 * reduced with the preceding LHS semantic.
 * @param {Object[]} rhsSemantic The RHS semantic.
 * @returns {Object|number} Returns the reduced semantic linked list if
 * reduction is semantically legal, else `-1`.
 */
exports.baseReduceSemanticTree = function (semanticList, nextNodeCount, rhsSemantic) {
	// Reduce the semantic tree up to a LHS semantic whose parse node has a
	// second child node (i.e., a second branch) yet to be reduced.
	while (semanticList) {
		// Merge RHS semantics.
		if (semanticList.isRHS) {
			rhsSemantic = semantic.mergeRHS(semanticList.semantic, rhsSemantic)

			// Discard if RHS is semantically illegal (e.g., contains duplicates).
			if (rhsSemantic === -1) {
				return -1
			}
		}

		// Reduce the LHS semantic after parsing the right-most branch that
		// follows the semantic.
		else if (nextNodeCount <= semanticList.nextNodeCount) {
			rhsSemantic = semantic.reduce(semanticList.semantic, rhsSemantic)

			// Discard if reduction is semantically illegal (e.g., LHS forbids
			// multiple arguments but RHS is multiple semantics).
			if (rhsSemantic === -1) {
				return -1
			}
		}

		// Check if reducing `rhsSemantic` with LHS `semanticList` and merging the
		// resulting semantic with RHS `semanticList.prev` will produce an illegal
		// semantic. These illegal semantics would otherwise be caught later.
		else if (exports.isIllegalSemanticReduction(semanticList, rhsSemantic)) {
			return -1
		}

		// Stop at a LHS semantic whose parse node has yet-to-reduce child nodes.
		else {
			break
		}

		semanticList = semanticList.prev
	}

	return {
		// The RHS semantic.
		semantic: rhsSemantic,
		isRHS: true,
		prev: semanticList,
	}
}

 /**
 * Checks if reducing `rhsSemantic` with LHS `semanticList` and merging the
 * resulting semantic with RHS `semanticList.prev` will produce an illegal
 * semantic.
 *
 * LHS `semanticList` can not reduce with `rhsSemantic` because another
 * semantic can come and merge with `rhsSemantic` as a RHS array. If
 * `semanticList` has a `maxParams` of `1`, and will be copied for each
 * semantic within the semantic array to contain `rhsSemantic`, then checks if
 * that semantic will be illegal when merged with `semanticList.prev`.
 *
 * Example:
 * repositories-liked(me)  // `semanticList.prev`
 * -> repositories-liked() // `semanticList`
 *    -> 'me'              // `rhsSemantic`
 *       -> ? - Normally, must wait to inspect '?'. Instead, this check
 *              discover the reduced semantic will be illegal.
 *
 * @private
 * @static
 * @param {Object} semanticList The previous path's semantic linked list,
 * ending with a LHS semantic.
 * @param {Object[]} rhsSemantic The new RHS semantic.
 * @returns {boolean} Returns `true` if the resulting semantic will be
 * illegal, else `false`.
 */
exports.isIllegalSemanticReduction = function (semanticList, rhsSemantic) {
	var prevSemanticNode = semanticList.semantic[0]

	// Check if `semanticList` will be copied for each of its RHS semantics
	// (because it has a `maxParams` of `1`), and `semanticList.prev` is
	// reduced.
	if (prevSemanticNode.semantic.maxParams === 1 && semanticList.prev && semanticList.prev.isRHS) {
		var prevPrevSemanticArray = semanticList.prev.semantic
		var prevPrevSemanticArrayLen = prevPrevSemanticArray.length

		for (var s = 0; s < prevPrevSemanticArrayLen; ++s) {
			var prevPrevSemanticNode = prevPrevSemanticArray[s]

			// Check if `semanticList` and `semanticList.prev` have the same root
			// semantic function.
			if (prevSemanticNode.semantic === prevPrevSemanticNode.semantic) {
				/**
				 * Check if `semanticList` + `rhsSemantic` and `semanticList.prev`
				 * will be semantically illegal.
				 *
				 * If not, can not reduce `semanticList` + `rhsSemantic`, merge with
				 * `semanticList.prev`, and copy `semanticList` for the future
				 * semantics, as will eventually happen. This is because it is
				 * possible no semantics will come down this branch, which can not
				 * be determined in advance, and the copied function will remain
				 * illegally empty.
				 */
				if (semantic.isIllegalRHS(prevPrevSemanticNode.children, rhsSemantic)) {
					// Discard semantically illegal RHS (e.g., will contain duplicates).
					return true
				}
			}
		}
	}

	return false
}
