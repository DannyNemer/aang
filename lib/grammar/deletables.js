var g = require('./grammar')


/**
 * Adds deletables to the grammar.
 *
 * Each deletable is a uni-token term that can be deleted when seen in input. A sequence of consecutive deletables can also be deleted.
 *
 * For each token that immediately follows a deletable token, `Parser` creates nodes for each terminal rule that produces the token (as normal) and a second set of nodes for the same terminal rules with a larger `size` value that spans to include the preceding deletable(s) and a cost penalty of 1 per preceding deletable.
 */
g.deletables.push(
	'a',
	'again',
	'all',
	'also',
	'am',
	'an',
	'and',
	'any',
	'are',
	'as',
	'because',
	'both',
	'but',
	'cannot',
	'did',
	'do',
	'does',
	'doing',
	'for',
	'here',
	'how',
	'is',
	'it',
	'just',
	'more',
	'most',
	'nor',
	'not',
	'once',
	'only',
	'or',
	'some',
	'the',
	'there',
	'these',
	'those',
	'too',
	'until',
	'while',
	'why'
)