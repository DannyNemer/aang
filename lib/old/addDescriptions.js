var util = require('../util/util')
var readlineSync = require('readline-sync')

var testsFilePath = './tests.json'
var tests = require(testsFilePath)

var testsSansDescriptions = tests.filter(test => test.description === undefined)

for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
	var test = tests[t]

	if (!test.description) {
		var testQuery = test.query
		var newTest = {
			query: testQuery,
			description: undefined,
			tags: test.tags,
			topResult: test.topResult,
			semantics: test.semantics,
		}

		if (test.topResult) {
			if (test.topResult.text !== testQuery) {
				var diff = util.diffStrings(testQuery, test.topResult.text)
				util.log(diff.expected)
				util.log(diff.actual)
			} else {
				util.log(testQuery)
			}

			util.log('  ', test.topResult.semantic)
		} else {
			util.log(testQuery)
		}

		util.log()
		newTest.description = getDescription(testsSansDescriptions.indexOf(test) + 1)

		saveTest(tests, newTest, t, 'Save this test?')
		util.log()
		util.log()
	}
}

function getDescription(testIndex) {
	while (true) {
		var description = readlineSync.question(`(${testIndex} of ${testsSansDescriptions.length}) description: `)

		if (description) {
			if (description.indexOf('Check ') !== 0) {
				util.logError('Description does not start with "Check ...":', util.stylize(description))
				continue
			}

			// Ensure descriptions end with a period.
			if (description[description.length - 1] !== '.') {
				description += '.'
			}

			return description
		} else {
			util.logError('A description is required.')
		}
	}
}

function saveTest(tests, newTest, index, promptMsg) {
	if (readlineSync.keyInYNStrict(promptMsg)) {
		// Print success message before "File saved" message.
		util.log('Test added:', util.stylize(newTest.query))

		// Add test to test suite at `index`
		tests[index] = newTest
		util.writeJSONFile(testsFilePath, tests)
	} else {
		util.log('Test not saved.')
	}
}