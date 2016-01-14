/**
 * Maps the semantic strings and disambiguated semantics of `trees` to an array.
 *
 * @static
 * @param {Object[]} [trees] The parse trees from which to collect the semantics.
 * @returns {string[]} Returns the semantic strings and disambiguated semantics of `trees`.
 */
module.exports = function (trees) {
	var semantics = []

	if (trees) {
		for (var t = 0, treesLen = trees.length; t < treesLen; ++t) {
			var tree = trees[t]

			semantics.push(tree.semanticStr)

			if (tree.ambiguousSemantics) {
				Array.prototype.push.apply(semantics, tree.ambiguousSemantics)
			}
		}
	}

	return semantics
}