var util = require('../util/util')


/**
 * The schema of a tag used in the test suite.
 *
 * @typedef {Object} TagSchema
 * @property {string} description The tag description.
 * @property {Function} appliesToTest The function that returns truthy if the tag applies to a given test and its parse results. The function is invoked with two arguments: (test, parseResults).
 */
var tagSchema = {
	description: { type: String, required: true },
	appliesToTest: { type: Function, required: true },
}

/**
 * The map of test suite tag names to `TagSchema` objects. Each defines a tag used in the test suite and can check its application to a provided test.
 *
 * @type {Object.<string, TagSchema>}
 */
module.exports = {
	'start-sym-fail': {
		description: 'Indicates the parse initially fails to reach the start symbol, which requires marking all input tokens as deletable and re-parsing. The re-parse may also fail.',
		appliesToTest: function (test, parseResults) {
			return parseResults.failedInitStartSym
		},
	},
	'no-legal-trees': {
		description: 'Indicates the parse initially fails to generate any legal parse trees (after reaching the start symbol) due to illegal semantics, which requires marking all input tokens as deletable and re-parsing. The re-parse may also fail.',
		appliesToTest: function (test, parseResults) {
			return parseResults.failedInitLegalTrees
		},
	},
	'union': {
		description: 'Indicates the parse incorporates the `union()` semantic, whether or not semantically legal. This involves a complicated process of correctly positioning the `union()` semantic within the output semantic trees.',
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
			var parseTrees = parseResults.trees
			if (parseTrees) {
				for (var t = 0, parseTreesLen = parseTrees.length; t < parseTreesLen; ++t) {
					var tree = parseTrees[t]
					if (reHasOr.test(tree.text) || reHasUnion.test(tree.semanticStr)) {
						return true
					}
				}
			}

			return false
		},
	},
	'anaphora': {
		description: 'Indicates the parse requires anaphora resolution, whether or not the resolution succeeds.',
		appliesToTest: function (test, parseResults) {
			var reAnaphors = /\b(he|him|his|she|her|hers|they|them|their|theirs)\b/

			// Check if input query contains an anaphor.
			if (reAnaphors.test(test.query)) {
				return true
			}

			// Check if test's expected top parse result has display text with an anaphor.
			var expectedTopResult = test.topResult
			if (expectedTopResult && reAnaphors.test(expectedTopResult.text)) {
				return true
			}

			// Check if any parse trees has display text with an anaphor.
			var parseTrees = parseResults.trees
			if (parseTrees) {
				for (var t = 0, parseTreesLen = parseTrees.length; t < parseTreesLen; ++t) {
					if (reAnaphors.test(parseTrees[t].text)) {
						return true
					}
				}
			}

			return false
		},
	},
}


// Check for ill-formed tags, and exit process with an error code of `1` if found.
for (var tagName in module.exports) {
	var tagDef = module.exports[tagName]

	if (util.illFormedOpts(tagSchema, tagDef)) {
		illFormedTagError(tagName)
	}

	// Check tag description style.
	var description = tagDef.description
	if (description.indexOf('Indicates the parse ') !== 0) {
		util.logError('Description does not start with "Indicates the parse ...":')
		util.log('  ' + util.stylize(description))
		util.log()
		illFormedTagError(tagName)
	} else if (description[description.length - 1] !== '.') {
		util.logError('Description does end with a period:')
		util.log('  ' + util.stylize(description))
		util.log()
		illFormedTagError(tagName)
	}
}

/**
 * Prints an error message with the associated file path and line number for an ill-formed test, and exits the process with an error code of `1`.
 *
 * @private
 * @static
 * @param {string} tagName The name of the ill-formed test tag.
 */
function illFormedTagError(tagName) {
	util.log('Ill-formed test tag:', util.stylize(tagName))
	util.log('  ' + util.firstPathAndLineNumberOf(__filename, tagName))
	process.exit(1)
}