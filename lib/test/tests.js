/**
 * Queries to test speed and various cases.
 *
 * Expected display text of the parse's first result:
 * - If `test.correction` is `false`    -> must match `test.query` (i.e., no edits).
 * - If `test.correction` is a `string` -> must match `test.correction`.
 * - If `test.correction` is `true`     -> must be distinguishable from `test.query`.
 *
 * @type Object[]
 */
module.exports = [
	{
		query: 'repos I have liked',
		correction: false,
	}, {
		query: 'repos created by me and my followers',
		correction: true,
	}, {
		query: 'repos I and my followers created',
		correction: true,
	}, {
		query: 'people who like my repos liked by people who follow people I follow',
		correction: false,
	}, {
		query: 'people who like repos',
		correction: true,
	}, {
		query: 'repos been followers',
		correction: true,
	}, {
		query: 'repos been followers people who like repos that I have',
		correction: true,
	}, {
		query: 'repos people who like and created',
		correction: true,
	}, {
		query: 'repos that have been created by people and like and I contributed to',
		correction: true,
	}, {
		query: 'repos that are repos',
		correction: true,
	}, {
		query: 'my followers who are my followers',
		correction: true,
	}, {
		query: 'my followers who are followers of followers of mine',
		correction: false,
	}, {
		query: 'my followers who are followers of followers of mine who liked that repos contributed to of mine',
		correction: true,
	}, {
		query: 'repos',
		correction: true,
	}, {
		query: 'people',
		correction: true,
	}, {
		query: 'people who created my repos and my pull requests',
		correction: true,
	}, {
		query: 'people pull requests like repos I like',
		correction: true,
	}, {
		query: 'repos liked by followers of followers of mine',
		correction: false,
	}, {
		query: 'repos liked by me and my followers',
		correction: false,
	}, {
		query: 'repos liked by me and my followers and people who like JavaScript repos liked by me and my followers',
		correction: false,
	}, {
		query: 'my repos that are JavaScript repos',
		correction: false,
	}, {
		query: 'my JavaScript repos',
		correction: false,
	}, {
		query: 'repos that are written in JavaScript',
		correction: false,
	}, {
		// Should have some results
		query: 'my JavaScript repos that are written in JavaScript',
		correction: true,
	}, {
		query: 'issues assigned to me I opened and am mentioned in',
		correction: false,
	}, {
		query: 'people who are assigned to my issues and follow people who contributed to repos I created and are mentioned in pull requests of mine',
		correction: false,
	}, {
		query: 'people who are mentioned in my issues and pull requests',
		correction: false,
	}, {
		query: 'people who are assigned to my issues and my pull requests',
		correction: false,
	}, {
		query: 'people mentioned in my issues and my pull requests',
		correction: false,
	}, {
		query: 'my {left-stop-word} repos',
		correction: 'my repos',
	}, {
		query: 'my {left-stop-word} JavaScript repos',
		correction: 'my JavaScript repos',
	}, {
		query: 'my JavaScript {left-stop-word} repos',
		correction: 'my JavaScript repos',
	}, {
		query: 'my {left-stop-word} JavaScript {left-stop-word} repos',
		correction: 'my JavaScript repos',
	}, {
		query: 'my {left-stop-word} {left-stop-word} repos',
		correction: 'my repos',
	}, {
		query: 'open issues',
		correction: false,
	}, {
		query: 'issues that are open',
		correction: false,
	}, {
		query: 'people assigned to my closed issues',
		correction: false,
	}, {
		query: 'contributors to my repos',
		correction: false,
	}, {
		query: 'contributors to my repos and repos of mine',
		correction: true,
	}, {
		query: 'likers of my repos',
		correction: false,
	}, {
		query: 'creators of repos I like',
		correction: false,
	}, {
		query: 'likers of repos I like and repos I contributed to',
		correction: false,
	}, {
		query: 'creators of repos I like and repos I contributed to',
		correction: false,
	}, {
		query: 'creators of pull requests I like and repos I like',
		correction: false,
	}, {
		query: 'likers of my repos and repos I contributed to',
		correction: false,
	}, {
		query: 'creators of repos I like and pull requests I am mentioned in',
		correction: false,
	}, {
		query: 'openers of closed issues that mention people I and my followers follow',
		correction: false,
	}, {
		query: 'people who are not followers of mine',
		correction: false,
	}, {
		query: 'people who have not been followed by me',
		correction: false,
	}, {
		query: 'issues that are not open',
		correction: false,
	}, {
		query: 'issues that are closed',
		correction: false,
	}, {
		query: 'people I do not follow',
		correction: false,
	}, {
		query: 'people who follow me and do not follow Danny',
		correction: false,
	}, {
		query: 'issues I am assigned to',
		correction: false,
	}, {
		query: 'issues assigned to me',
		correction: false,
	}, {
		query: '{left-stop-word} open issues that are never assigned to people who {pre-filter-stop-word} follow me',
		correction: 'open issues that are assigned to people who follow me',
	}, {
		query: 'repos of people who follow me',
		correction: false,
	}, {
		query: 'followers of mine and people who follow me',
		correction: false,
	}, {
		query: 'repos of mine and people who follow me',
		correction: true,
	}, {
		query: 'repos I like or my followers likes',
		correction: true,
	}, {
		query: 'repos I or my followers likes',
		correction: true,
	}, {
		query: 'repos created by people I follow and Danny follows',
		correction: false,
	}, {
		query: 'repos created by people I and Danny follow',
		correction: false,
	}, {
		query: 'people who follow people',
		correction: true,
	}, {
		query: 'people followed by myself',
		correction: 'people followed by me',
	}, {
		query: 'people who follow I',
		correction: 'people who follow me',
	}, {
		query: 'people me follows',
		correction: 'people I follow',
	}, {
		query: 'openers of my closed issues that mention me people who follow me and my followers follow follow',
		correction: false,
	}, {
		query: 'repos people my followers follow like',
		correction: false,
	}, {
		query: 'people people Danny follows follow',
		correction: false,
	}, {
		query: 'repos people people Danny follows follow created Danny likes',
		correction: true,
	}, {
		query: 'followers of my followers who are followers of mine my followers who created repositories of my followers followers of mine who I follow like that are repos I contributed to follow',
		correction: false,
	}, {
		query: 'repos contributed to by me',
		correction: false,
	}, {
		query: 'repos to by me',
		correction: true,
	}, {
		query: 'repos liked contributed to by me',
		correction: true,
	}, {
		query: 'repos by me',
		correction: true,
	}, {
		// transposition
		query: 'issues opened by me assigned to me',
		correction: true,
	}, {
		query: 'issues with 22 comments',
		correction: false,
	}, {
		query: 'issues assigned to me with 22 comments',
		correction: false,
	}, {
		query: 'issues with 20 to 34 comments I opened',
		correction: false,
	}, {
		// I do not like how that sounds. Might be ok.
		query: 'issues that are with between 20 comments and 34 comments',
		correction: false,
	}, {
		query: 'issues with between 20 and 24 comments',
		correction: false,
	}, {
		query: 'issues with between 20 and 24 comment',
		correction: true,
	}, {
		query: 'issues with between 20 comments and 24 comments',
		correction: false,
	}, {
		query: 'issues with between 20 comment and 24 comment',
		correction: true,
	}, {
		query: 'issues with 3 comments to 3 comments',
		correction: true,
	}, {
		query: 'issues with 3 to 3 comments',
		correction: true,
	}, {
		query: 'issues with 1 comments to 5 comments',
		correction: false,
	}, {
		query: 'issues with 1 to 5 comments',
		correction: false,
	}, {
		query: 'issues with less than 2 > 4 comments',
		correction: true,
	}, {
		query: 'issues with less than 2 and > 4 comments',
		correction: false,
	}, {
		query: 'JavaScript repos liked by me and my followers',
		correction: false,
	}, {
		query: 'repos with between 22 and 23 likes',
		correction: false,
	}, {
		query: 'repos with between 22 and 23 stars',
		correction: true,
	}, {
		query: 'repos created in 2014',
		correction: false,
	}, {
		query: 'repos created 2014',
		correction: true,
	}, {
		query: 'repos created in June 2014',
		correction: false,
	}, {
		query: 'repos created in June 24 2014',
		correction: true,
	}, {
		query: 'repos created this year',
		correction: false,
	}, {
		query: 'repos created after this year',
		correction: false,
	}, {
		query: 'repos created between last year and this year',
		correction: false,
	}, {
		query: 'repos created from 2012 to 2014',
		correction: false,
	}, {
		// perhaps could prevent because logically contradictory
		query: 'repos created before June 20 2000 and after this year',
		correction: false,
	}, {
		query: 'people I and Danny follows',
		correction: true,
	}, {
		query: 'people people Danny follow and Danny follows',
		correction: true,
	}, {
		query: 'likers of my repos I contributed to that I like and my repos I contributed to',
		correction: false,
	}, {
		// correct capitalization
		query: 'my GitHub repos liked by my github followers',
		correction: 'my GitHub repos liked by my GitHub followers',
	}, {
		query: 'my followers\' repos',
		correction: false,
	}, {
		query: 'my {left-stop-word} followers\' repos',
		correction: 'my followers\' repos',
	}, {
		query: 'my {left-stop-word} followers\' {left-stop-word} repos',
		correction: 'my followers\' repos',
	}, {
		query: 'Danny\'s followers\' followers',
		correction: false,
	}, {
		query: 'repos of Danny\'s',
		correction: false,
	}, {
		query: 'Danny\'s followers',
		correction: false,
	}, {
		// perhaps -> "females"
		query: 'female people',
		correction: false,
	}, {
		query: 'female people who are male',
		correction: true,
	}, {
		query: 'male people who are not male',
		correction: true,
	}, {
		query: 'my male followers',
		correction: false,
	}, {
		query: 'Danny\'s male followers',
		correction: false,
	}, {
		query: 'my followers\' female followers',
		correction: false,
	}, {
		query: 'my female followers\' female followers',
		correction: false,
	}, {
		query: 'my female followers\' female followers who are not male',
		correction: false,
	}, {
		query: 'REPOS i LiKe',
		correction: 'repos I like',
	}, {
		// should be "were"
		query: 'repos that are not created today liked by me',
		correction: 'repos that were not created today liked by me',
	}, {
		query: 'people who are not my followers',
		correction: false,
	}, {
		query: 'repos not created today not liked by me',
		correction: true,
	}, {
		query: 'women',
		correction: false,
	}, {
		query: 'men I follow',
		correction: false,
	}, {
		query: 'men who I follow',
		correction: false,
	}, {
		query: 'people who are male',
		correction: false,
	}, {
		// or should it correct to 'male'
		query: 'people who are males',
		correction: false,
	}, {
		query: 'male women',
		correction: true,
	}, {
		query: 'female people who are women',
		correction: true,
	}, {
		query: 'repos that are created by me and are not created by me',
		correction: true,
	}, {
		query: 'repos that are not created by me and are created by me',
		correction: true,
	}, {
		query: 'people people I follow who Danny follow and follow Danny follow',
		correction: true,
	}, {
		query: 'repos people I follow created that Danny like',
		correction: true,
	}, {
		query: 'issues assigned to me Danny opened and Aang are mentioned in',
		correction: true,
	}, {
		// Intentionally fails. can't use entity name
		query: 'people {user} follows',
		correction: true,
	}, {
		// Intentionally fails
		query: 'people I and {user} follow',
		correction: true,
	}, {
		// Intentionally fails
		query: 'issues with <int> comments',
		correction: true,
	}, {
		query: 'my repos me people who follow my followers have been and',
		correction: true,
	}, {
		query: 'people my followers who created repositories of my followers followers of mine who I follow like follow',
		correction: false,
	}, {
		query: 'contributors to my repos or repos I like or Danny likes',
		correction: false,
	}, {
		query: 'repos I like or I created',
		correction: false,
	}, {
		query: 'repos I or Danny like',
		correction: false,
	}, {
		query: 'repos I or Danny or my followers like',
		correction: false,
	}, {
		query: 'repos I or Danny and my followers like',
		correction: false,
	}, {
		query: 'repos I or Danny created',
		correction: false,
	}, {
		query: 'people never currently I follow',
		correction: true,
	}, {
		query: 'people I have',
		correction: true,
	}, {
		query: 'repos I have',
		correction: true,
	}, {
		query: 'repos been liked by me',
		correction: true,
	}, {
		query: 'people who not been followed by me',
		correction: true,
	}, {
		query: 'repos I contributed to',
		correction: false,
	}, {
		query: 'repos I did not contributed to',
		correction: true,
	}, {
		query: 'repos I have not contributed to',
		correction: false,
	}, {
		// unsure. Maybe only "have not"
		query: 'repos I did not contribute to',
		correction: false,
	}, {
		// unsure
		query: 'repos I do not contribute to',
		correction: false,
	}, {
		query: 'repos I to contributed to',
		correction: true,
	}, {
		query: 'repos I to created',
		correction: true,
	}, {
		query: 'repos I to have created',
		correction: true,
	}, {
		query: 'repos I and Danny have contributed to',
		correction: false,
	}, {
		query: 'repos I did create',
		correction: true,
	}, {
		query: 'people who have liked my repos',
		correction: false,
	}, {
		query: 'people who',
		correction: true,
	}, {
		query: 'people who like',
		correction: true,
	}, {
		query: 'people who have',
		correction: true,
	}, {
		query: 'people who have been',
		correction: true,
	}, {
		query: 'repos that',
		correction: true,
	}, {
		query: 'repos that have',
		correction: true,
	}, {
		query: 'repos that been',
		correction: true,
	}, {
		query: 'repos that have been',
		correction: true,
	}, {
		query: 'issues that',
		correction: true,
	}, {
		query: 'issues that have',
		correction: true,
	}, {
		query: 'issues that been',
		correction: true,
	}, {
		query: 'issues that have been',
		correction: true,
	}, {
		query: 'pull requests that',
		correction: true,
	}, {
		query: 'pull requests that have',
		correction: true,
	}, {
		query: 'pull requests that been',
		correction: true,
	}, {
		query: 'pull requests that have been',
		correction: true,
	}, {
		query: 'people who repos',
		correction: true,
	}, {
		query: 'people who have repos',
		correction: true,
	}, {
		query: 'people who have my repos',
		correction: true,
	}, {
		query: 'people who issues',
		correction: true,
	}, {
		query: 'people who have issues',
		correction: true,
	}, {
		query: 'people who have my issues',
		correction: true,
	}, {
		query: 'people who pull requests',
		correction: true,
	}, {
		query: 'people who have pull requests',
		correction: true,
	}, {
		query: 'people who have my pull requests',
		correction: true,
	}, {
		query: 'repos who have liked my repos',
		correction: true,
	}, {
		query: 'people who have issues pull requests',
		correction: true,
	}, {
		query: 'people who have issues pull requests repos',
		correction: true,
	}, {
		query: 'issues been',
		correction: true,
	}, {
		query: 'issues opened by me that mention followers of people who like repos creators of Node contributed to',
		correction: false,
	}, {
		query: 'issues opened by me that mention followers of people who like repos creators of Node contributed to and are assigned to pull requests I am not mentioned in',
		correction: false,
	}, {
		query: 'issues opened by me that mention followers of people who like repos creators of Node contribute to and are assigned to pull requests I am not mentioned in',
		correction: false,
	}, {
		query: 'issues opened me followers people repos creators of Node contributed to assigned to pull requests am not mentioned in',
		correction: true,
	}, {
		query: 'people who do contributed to my repos',
		correction: true,
	}, {
		query: 'people who do contributed not to my repos',
		correction: true,
	}, {
		// needs some output
		query: 'issues with -20 to 34 comments I opened',
		correction: true,
	}, {
		// needs som output
		query: 'repos created before June 0 2000 and July -2 3000',
		correction: true,
	}, {
		// needs some output
		query: 'repos created before June 32 1940',
		correction: true,
	}, {
		query: 'repos created before June 31 1950',
		correction: false,
	}, {
		query: 'people who do not follow me',
		correction: false,
	}, {
		query: 'people who people',
		correction: true,
	}, {
		query: 'people who followers',
		correction: true,
	}, {
		query: 'my pull requests assigned to me',
		correction: false,
	}, {
		query: 'repos I do not like',
		correction: false,
	}, {
		// I do not know, because "repos I did not star" is good
		query: 'repos I did not like',
		correction: true,
	}, {
		query: 'repos Danny does not like',
		correction: false,
	}, {
		query: 'repos Danny has not liked',
		correction: false,
	}, {
		query: 'repos Danny has liked',
		correction: false,
	}, {
		query: 'repos Danny have likes',
		correction: 'repos Danny has liked',
	}, {
		query: 'repos I have not liked',
		correction: false,
	}, {
		query: 'repos I has not liked',
		correction: 'repos I have not liked',
	}, {
		// enable transpositions?
		query: 'repos I not have liked',
		correction: true,
	}, {
		query: 'repos people who follow me and I do not like',
		correction: false,
	}, {
		query: 'repos people who follow me and me do not like',
		correction: true,
	}, {
		query: 'repos people who follow me created that Aang does not like',
		correction: false,
	}, {
		query: 'repos people who follow me and I does not like',
		correction: true,
	}, {
		query: 'repos people who follow me and I have not liked',
		correction: false,
	}, {
		query: 'repos people who follow me and I has not likes',
		correction: true,
	}, {
		query: 'repos people who have not liked Danny\'s repos created',
		correction: false,
	}, {
		query: 'repos I did not have liked',
		correction: true,
	}, {
		query: 'repos Danny and I do not like',
		correction: false,
	}, {
		query: 'repos Danny and people who follow Danny have not liked',
		correction: false,
	}, {
		query: 'repos that have been liked by me',
		correction: false,
	}, {
		query: 'people who do not like my repos',
		correction: false,
	}, {
		query: 'repos that have not been liked by me',
		correction: false,
	}, {
		query: 'repos that not been liked by me',
		correction: true,
	}, {
		query: 'repos not been liked by me',
		correction: false,
	}, {
		query: 'people who have not liked my repos',
		correction: false,
	}, {
		query: 'repos I and Danny do not liked',
		correction: true,
	}, {
		query: 'repos I and Danny do not like',
		correction: false,
	}, {
		query: 'repos I and Danny have not liked',
		correction: false,
	}, {
		query: 'repos Danny does like',
		correction: true,
	}, {
		query: 'repos I not liked',
		correction: true,
	}, {
		query: 'repos Danny and Aang and I do not like',
		correction: false,
	}, {
		query: 'repos Danny and has not liked',
		correction: true,
	}, {
		query: 'repos Danny and Aang not have liked',
		correction: true,
	}, {
		query: 'repos my followers have not liked',
		correction: false,
	}, {
		query: 'repos my followers like',
		correction: false,
	}, {
		query: 'my repositories people who created my repos created',
		correction: true,
	}, {
		query: 'repos created today created yesterday',
		correction: true,
	}, {
		// Should produce results
		query: 'people who like my repos liked by people who follow me that people I follow created',
		correction: true,
	}, {
		// Should produce results
		query: 'people who like my repos that people I follow created',
		correction: true,
	}, {
		query: 'my repos Danny created',
		correction: true,
	}, {
		query: 'repos Danny by me',
		correction: true,
	}, {
		query: 'repos Danny by me Danny',
		correction: true,
	}, {
		query: 'repos I not',
		correction: true,
	}, {
		query: 'issues I not',
		correction: true,
	}, {
		query: 'pull requests I not',
		correction: true,
	}, {
		query: 'repos Danny contributed to and I like',
		correction: false,
	}, {
		query: 'repos I and Danny have not contributed to',
		correction: false,
	}, {
		query: 'repos people who do not like my repos have not contributed to',
		correction: false,
	}, {
		query: 'people who have not contributed to my repos',
		correction: false,
	}, {
		query: 'repos that are not JavaScript repos',
		correction: false,
	}, {
		query: 'repos that are not written in JavaScript',
		correction: false,
	}, {
		query: 'people who are not followed by me',
		correction: false,
	}, {
		query: 'people not followed by me',
		correction: false,
	}, {
		query: 'repos not written in JavaScript',
		correction: false,
	}, {
		query: 'people not mentioned in my issues',
		correction: false,
	}, {
		query: 'issues not assigned to me',
		correction: false,
	}, {
		query: 'issues that are not assigned to me',
		correction: false,
	}, {
		query: 'repos that are not my repos',
		correction: false,
	}, {
		query: 'repos I create',
		correction: true,
	}, {
		query: 'repos I created',
		correction: false,
	}, {
		query: 'repos Danny has created',
		correction: false,
	}, {
		query: 'repos I did not create',
		correction: false,
	}, {
		query: 'repos Danny did not create',
		correction: false,
	}, {
		query: 'repos Danny do not creates',
		correction: 'repos Danny did not create',
	}, {
		// Wrong because implies the returned repos can be created in the futrue.
		query: 'repos I have not created',
		correction: 'repos I did not create',
	}, {
		query: 'repos Danny has not created',
		correction: 'repos Danny did not create',
	}, {
		query: 'repos I made',
		correction: true,
	}, {
		query: 'repos I did not make',
		correction: true,
	}, {
		query: 'repos I did not made',
		correction: true,
	}, {
		query: 'issues I did not open',
		correction: false,
	}, {
		query: 'issues I create',
		correction: 'issues I created',
	}, {
		query: 'issues I did not created',
		correction: 'issues I create',
	}, {
		query: 'people who do not created my repos',
		correction: true,
	}, {
		query: 'people who did not create my repos',
		correction: false,
	}, {
		query: 'people who do not have liked my repos',
		correction: true,
	}, {
		query: 'people who do not have opened my issues',
		correction: true,
	}, {
		query: 'issues that do not mention me',
		correction: false,
	}, {
		query: 'issues that are not assigned to my followers',
		correction: false,
	}, {
		query: 'issues that have not been assigned to me',
		correction: false,
	}, {
		query: 'issues Danny is not assigned to',
		correction: false,
	}, {
		query: 'pull requests my followers are not mentioned in',
		correction: false,
	}, {
		query: 'pull requests that have not been assigned to me',
		correction: false,
	}, {
		query: 'people who did not like',
		correction: true,
	}, {
		query: 'people who like my',
		correction: true,
	}, {
		query: 'that mention me',
		correction: true,
	}, {
		query: 'that I contributed to',
		correction: true,
	}, {
		query: 'people who did not contributed to my repos',
		correction: true,
	}, {
		query: 'Danny\'s followers who do not follow me',
		correction: false,
	}, {
		query: 'people who forked Node',
		correction: false,
	}, {
		query: 'people who forked my repos',
		correction: false,
	}, {
		query: 'repos I have not forked',
		correction: false,
	}, {
		query: 'repos I forked pushed last year',
		correction: true,
	}, {
		query: 'repos I forked that are pushed last year',
		correction: true,
	}, {
		// perhaps, be can disallow this
		query: 'repos with greater than 20 forks and fewer than 0 forks',
		correction: false,
	}, {
		query: 'repos Danny did not fork',
		correction: false,
	}, {
		query: 'repos Danny has not forked',
		correction: false,
	}, {
		// Maybe this should be forbidden for "people who have not"
		// Wait until more rules have been created to solve uncertainty
		query: 'people who do not contribute to my repos',
		correction: false,
	}, {
		query: 'repos Danny does not contribute to',
		correction: false,
	}, {
		query: 'repos Danny has not contributed to',
		correction: false,
	}, {
		query: 'repos Danny or Aang do not contribute to',
		correction: false,
	}, {
		query: 'contributors of repos I did not contribute to pushed last year',
		correction: true,
	}, {
		// Currenrlty returns no results
		query: 'people who contributed to issues I opened',
		correction: true,
	}, {
		query: 'people I follow',
		correction: false,
	}, {
		query: 'people Danny follows',
		correction: false,
	}, {
		query: 'people I and Danny follow',
		correction: false,
	}, {
		query: 'people Danny and I follow',
		correction: false,
	}, {
		query: 'people people Danny follows and Danny follow',
		correction: false,
	}, {
		query: 'issues assigned to me Danny opened and Aang is mentioned in',
		correction: false,
	}, {
		query: 'repos people I follow created that Danny likes',
		correction: false,
	}, {
		query: 'people people I follow who Danny follows and follow Danny follow',
		correction: false,
	}, {
		query: 'repos that are liked by my followers',
		correction: false,
	}, {
		query: 'repos that were liked by my followers',
		correction: false,
	}, {
		query: 'people who did not contribute to my repos',
		correction: false,
	}, {
		query: 'repos that are created in 2014',
		correction: 'repos that were created in 2014',
	}, {
		query: 'repos that were created in 2014',
		correction: false,
	}, {
		// Perhaps this should correct to 'repos that were created by me'
		query: 'repos that have been created by me',
		correction: false,
	}, {
		query: 'issues that have between 20 comments and 34 comments',
		correction: false,
	}, {
		query: 'repos not liked by me',
		correction: false,
	}, {
		query: 'repos that have been liked me',
		correction: true,
	}, {
		query: 'repos liked by me and forked by me',
		correction: false,
	}, {
		query: 'repos liked by me and that are not forked by me',
		correction: true,
	}, {
		query: 'repos liked by me that are not forked by me',
		correction: false,
	}, {
		query: 'repos liked by me I have not contributed to',
		correction: false,
	}, {
		query: 'repos liked by me and forked by me that I have not contributed to',
		correction: false,
	}, {
		query: 'issues that were updated today',
		correction: true,
	}, {
		query: 'repos created today liked by me forked by me',
		correction: true,
	}, {
		query: 'repos created by me forked by me',
		correction: true,
	}, {
		query: 'repos created today liked by me',
		correction: true,
	}, {
		query: 'repos not liked by me not forked by me',
		correction: true,
	}, {
		query: 'repos not liked by me and not forked by me',
		correction: false,
	}, {
		query: 'repos liked by me and forked by me and contributed to by me',
		correction: false,
	}, {
		query: 'repos liked by me contributed to by me forked by me',
		correction: true,
	}, {
		query: 'repos liked by me that are contributed to by me and forked by me',
		correction: false,
	}, {
		query: 'repos liked by me that are contributed to by me that are forked by me',
		correction: true,
	}, {
		query: 'repos liked by me that are contributed to by me and that are forked by me',
		correction: false,
	}, {
		query: 'repos that are liked by me and that are contributed to by me and that are forked by me',
		correction: false,
	}, {
		query: 'repos that are liked by me that are contributed to by me and that are forked by me',
		correction: true,
	}, {
		query: 'repos that are liked by me contributed to by me',
		correction: true,
	}, {
		query: 'repos that are not liked by me and that are not contributed to by me and that are not forked by me',
		correction: false,
	}, {
		query: 'repos not created by me that are liked by me',
		correction: false,
	}, {
		query: 'repos not created by me that are not liked by me',
		correction: false,
	}, {
		query: 'repos not written in JavaScript not liked by me',
		correction: true,
	}, {
		query: 'repos not written in JavaScript that are not liked by me',
		correction: true,
	}, {
		// this is assuming created is treated like passive, though it is not
		query: 'repos created today pushed yesterday',
		correction: true,
	}, {
		// currently edits it, but it is ok
		query: 'repos I created today',
		correction: false,
	}, {
		query: 'my repos created after last week created last week',
		correction: true,
	}, {
		query: 'Danny contributes to',
		correction: true,
	}, {
		query: 'repos I created I like',
		correction: true,
	}, {
		// unimplementd
		query: 'repos that I created I like',
		correction: true,
	}, {
		// unimplementd
		query: 'repos that I created that I like',
		correction: true,
	}, {
		query: 'repos that I created and I like',
		correction: false,
	}, {
		query: 'repos that I created and that I like',
		correction: false,
	}, {
		// unimplemented
		query: 'people who I follow Danny follows',
		correction: true,
	}, {
		// unimplemented
		query: 'people who I follow who Danny follows',
		correction: true,
	}, {
		// unimplemented
		query: 'my',
		correction: true,
	}, {
		query: 'repos created by creators of node and contributors to my repos',
		correction: true,
	}, {
		query: 'my repos I forked that I liked and',
		correction: true,
	}

	// 'followers my followers share',
	// 'followers I and Danny have in common',
	// 'followers I share', // intentionally wrong
	// 'followers I share with Danny',
	// 'followers I and Danny share with Aang',
	// 'followers I and Danny share with Aang and my followers',
	// 'followers Danny has in common with' // doesn't work

	// 'pull requests of mine created by my followers' // no results, too slow. Look at parse stack
	// 'my followers who created pull requests of mine my followers who created repositories followers of mine mentioned in issues of my followers who I follow like that are repos created by me I contributed to am mentioned in that I am mentioned in', // really slow, but because of some rule - look at parse stack. Remove some ambiguous insertions
]