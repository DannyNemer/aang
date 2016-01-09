/**
 * The schema of a tag used in the test suite.
 *
 * @typedef TagSchema
 * @type {Object}
 * @property {string} description The tag description.
 * @property {Function} appliesToTest The function that returns truthy if the tag applies to a given test and its parse results. The function is invoked with two arguments: (test, parseResults).
 */

/**
 * The map of tag names to `TagSchema` objects. Each defines a tag used in the test suite and can check its application to a provided test.
 *
 * @type {Object.<string, TagSchema>}
 */
module.exports = {
	'union': {
		description: 'Indicates the parse incorporates the `union()` semantic, whether or not semantically legal. This involves a complicated process of correctly positioning the `union()` semantic within the output semantic trees',
		appliesToTest: function (test, parseResults) {
			var reHasOr = /\bor\b/
			var reHasUnion = /\bunion\(\b/

			// Check if input query contains "or".
			if (reHasOr.test(test.query)) {
				return true
			}

			// Check if test's expected top parse result has display text with "or" or semantic with `union()`.
			var expectedTopResult = test.topResult
			if (expectedTopResult && (reHasOr.test(expectedTopResult.text) || reHasUnion.test(expectedTopResult.semantic))) {
				return true
			}

			// Check if top parse result has display text with "or" or semantic with `union()`.
			var parseTopResult = parseResults.trees && parseResults.trees[0]
			if (parseTopResult && (reHasOr.test(parseTopResult.text) || reHasUnion.test(parseTopResult.semanticStr))) {
				return true
			}

			return false
		},
	},
	'anaphora': {
		description: 'Indicates the parse requires anaphora resolution, whether or not the resolution succeeds.',
		appliesToTest: function (test, parseResults) {
			var reAnaphors = /\b(he|him|his|she|her|hers|they|they|their|theirs)\b/

			// Check if input query contains an anaphor.
			if (reAnaphors.test(test.query)) {
				return true
			}

			// Check if test's expected top parse result has display text with an anaphor.
			var expectedTopResult = test.topResult
			if (expectedTopResult && reAnaphors.test(expectedTopResult.text)) {
				return true
			}

			// Check if top parse result has display text with an anaphor.
			var parseTopResult = parseResults.trees && parseResults.trees[0]
			if (parseTopResult && reAnaphors.test(parseTopResult.text)) {
				return true
			}

			return false
		},
	},
	'start-sym-fail': {
		description: 'Indicates the parse initially fails to reach the start symbol, which requires marking all input tokens as deletable and re-parsing. The subsequent re-parse may also fail.',
		appliesToTest: function (test, parseResults) {
			return parseResults.failedInitStartSym
		},
	},
	'no-legal-trees': {
		description: 'Indicates the parse initially failed to generate any legal parse trees due to illegal semantics, which requires marking all input tokens as deletable and re-parsing. The subsequent re-parse may also fail.',
		appliesToTest: function (test, parseResults) {
			return parseResults.failedInitLegalTrees
		},
	},
}