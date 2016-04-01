/**
 * Maps `trees` to an array of their semantic strings (including disambiguated semantics).
 *
 * @static
 * @param {Object[]} [trees] The parse trees to map.
 * @returns {string[]} Returns the semantic stringss of `trees`.
 */
module.exports = function (trees) {
	var semanticStrs = []

	if (trees) {
		for (var t = 0, treesLen = trees.length; t < treesLen; ++t) {
			var tree = trees[t]

			semanticStrs.push(tree.semanticStr)

			if (tree.ambiguousSemantics) {
				Array.prototype.push.apply(semanticStrs, tree.ambiguousSemantics)
			}
		}
	}

	return semanticStrs
}