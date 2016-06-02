/**
 * Performs anaphora resolution by searching `semanticList` for the antecedent semantic with the referent anaphor's person-number property, `anaphoraPersonNumber`, if any.
 *
 * @static
 * @param {Object} semanticList The semantic linked list to search.
 * @param {string} anaphoraPersonNumber The person-number of the referent anaphor with which the antecedent semantic must match.
 * @returns {Object[]|number} Returns a new RHS semantic with the antecedent semantic if found and legal, else `-1`.
 */
module.exports = function (semanticList, anaphoraPersonNumber) {
	while (semanticList) {
		if (semanticList.isRHS) {
			// Check if semantic (of same person-number) previously found.
			var antecedentSemantic = semanticList[anaphoraPersonNumber]
			if (antecedentSemantic) {
				return antecedentSemantic
			}

			var stack = semanticList.semantic.slice()

			for (var s = 0, stackLen = stack.length; s < stackLen; ++s) {
				var semanticNode = stack[s]
				var semanticChildren = semanticNode.children

				if (semanticNode.semantic.anaphoraPersonNumber === anaphoraPersonNumber) {
					if (!antecedentSemantic) {
						// The antecedent.
						antecedentSemantic = semanticNode
					} else if (antecedentSemantic !== semanticNode) {
						// Reject if multiple 3-sg antecedents, because then it is ambiguous which entity is the anaphor.
						// Allow multiple anaphors for the same 3-sg antecedent (i.e., the same entity). E.g., "repos Danny likes that he created and he contributed to".
						return -1
					}
				} else if (semanticChildren) {
					// Traverse semantic tree to find the antecedent.
					Array.prototype.push.apply(stack, semanticChildren)
					stackLen += semanticChildren.length
				}
			}

			if (antecedentSemantic) {
				// Save semantic (for this person-number) for future invocations on the same semantic list.
				return semanticList[anaphoraPersonNumber] = [ antecedentSemantic ]
			}

			// Do not return -1 here, because if the previous RHS semantic is `me`, which is not 3-sg, there can still exist an earlier acceptable 3-sg antecedent semantic argument. E.g., "repos Danny likes that he and I contribute to".
		}

		semanticList = semanticList.prev
	}

	// No preceding semantic argument exists as a 3-sg antecedent for the anaphor semantic.
	return -1
}