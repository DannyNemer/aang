/**
 * Checks for ill-formed and duplicate tests in the test suite. If found, exits process with error code `1`.
 */


var util = require('../util/util')
var testTagsUtil = require('./testTagsUtil')


// The file path of the test suite for error reporting.
var testsFilePath = require.resolve('./tests.json')
// The test cases, each with a query and expected values for parse results.
var tests = require(testsFilePath)
// The tags used in the test suite.
var tags = Object.keys(testTagsUtil.tags)


var testSchema = {
	// The query to parse.
	query: { type: String, required: true },
	// The optional test description.
	description: String,
	// The optional test tags.
	tags: { type: Array, arrayType: String, allowEmpty: true, required: true },
	// The optional expected top result.
	topResult: Object,
	// The unsorted expected semantics to compare (irrespective of order) to test output.
	semantics: { type: Array, arrayType: String, allowEmpty: true, required: true },
}

var testTopResultSchema = {
	// The expected display text of the parse's top result.
	text: { type: String, required: true },
	// The expected semantic of the parse's top result.
	semantic: { type: String, required: true },
}


// Check for ill-formed and duplicate tests.
for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
	var test = tests[t]
	var testQuery = test.query

	// Surround test query with quotation marks so that `test` can be found in `testsFilePath`.
	var testQueryQuoted = '"query": "' + testQuery + '"'

	if (util.illFormedOpts(testSchema, test) || (test.topResult && util.illFormedOpts(testTopResultSchema, test.topResult))) {
		util.log('  ' + util.firstPathAndLineNumberOf(testsFilePath, testQueryQuoted))
		process.exit(1)
	}

	// Check for duplicate tests.
	for (var a = t + 1; a < testsLen; ++a) {
		if (testQuery === tests[a].query) {
			util.logError('Duplicate test:', util.stylize(testQuery))
			util.pathAndLineNumbersOf(testsFilePath, testQueryQuoted).forEach(function (path) {
				util.log('  ' + path)
			})
			process.exit(1)
		}
	}

	// Check for unrecognized and duplicate test tags.
	var testTags = test.tags
	for (var i = 0, testTagsLen = testTags.length; i < testTagsLen; ++i) {
		var tagName = testTags[i]
		if (tags.indexOf(tagName) === -1) {
			util.logError('Unrecognized test tag:', util.stylize(tagName))
			util.log('  ', testTags)
			util.log('  ' + util.firstPathAndLineNumberOf(testsFilePath, testQueryQuoted, 'tags'))
			process.exit(1)
		}

		if (testTags.lastIndexOf(tagName) !== i) {
			util.logError('Duplicate test tag:', util.stylize(tagName))
			util.log('  ', testTags)
			util.log('  ' + util.firstPathAndLineNumberOf(testsFilePath, testQueryQuoted, 'tags'))
			process.exit(1)
		}
	}

	// Check for descriptions with incorrect style.
	var description = test.description
	if (description) {
		if (description.indexOf('Check ') !== 0) {
			util.logError('Description does not start with "Check ...":', util.stylize(description))
			util.log('  ' + util.firstPathAndLineNumberOf(testsFilePath, testQueryQuoted, 'description'))
			process.exit(1)
		}

		if (description[description.length - 1] !== '.') {
			util.logError('Description does not end with a period:', util.stylize(description))
			util.log('  ' + util.firstPathAndLineNumberOf(testsFilePath, testQueryQuoted, 'description'))
			process.exit(1)
		}
	}
}