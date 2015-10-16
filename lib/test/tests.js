/**
 * A collection of test cases, each with a query and expected values for parse results. The queries in the test cases are also used for benchmark measurements.
 *
 * @type Object[]
 * @param {string} test.query The query to parse.
 * @param {boolean|string} test.correction The expected display text of the parse's first result:
 *   - If `true`, display text must be (any `string`) distinguishable from `test.query`.
 *   - If `false`, display text must match `test.query` (i.e., no edits).
 *   - If a `string`, display text must match `test.correction`.
 * @param {string} [test.semantic] The expected semantic of the parse's first result. Required when `test.correction` is `false` or a `string` (i.e., accepts a specific result), otherwise (i.e., accepts varying results) forbidden.
 * @param {string} [note] A note regarding the test printed when the test fails.
 */
module.exports = [
	{
		query: 'repos I have liked',
		correction: false,
		semantic: 'repositories-liked(me)',
	}, {
		query: 'repos created by me and my followers',
		correction: true,
	}, {
		query: 'repos I and my followers created',
		correction: true,
	}, {
		query: 'people who like my repos liked by people who follow people I follow',
		correction: false,
		semantic: 'repository-likers(intersect(repositories-created(me),repositories-liked(followers(users-followed(me)))))',
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
		semantic: 'intersect(followers(me),followers(followers(me)))',
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
		semantic: 'repositories-liked(followers(followers(me)))',
	}, {
		query: 'repos liked by me and my followers',
		correction: false,
		semantic: 'intersect(repositories-liked(me),repositories-liked(followers(me)))',
	}, {
		query: 'repos liked by me and my followers and people who like JavaScript repos liked by me and my followers',
		correction: false,
		semantic: 'intersect(repositories-liked(me),repositories-liked(followers(me)),repositories-liked(repository-likers(intersect(repositories-language(18),repositories-liked(me),repositories-liked(followers(me))))))',
	}, {
		query: 'my repos that are JavaScript repos',
		correction: false,
		semantic: 'intersect(repositories-created(me),repositories-language(18))',
	}, {
		query: 'my JavaScript repos',
		correction: false,
		semantic: 'intersect(repositories-created(me),repositories-language(18))',
	}, {
		query: 'repos that are written in JavaScript',
		correction: false,
		semantic: 'repositories-language(18)',
	}, {
		query: 'my JavaScript repos that are written in JavaScript',
		correction: true,
	}, {
		query: 'issues assigned to me I opened and am mentioned in',
		correction: false,
		semantic: 'intersect(issues-assigned(me),issues-mentioned(me),issues-opened(me))',
	}, {
		query: 'people who are assigned to my issues and follow people who contributed to repos I created and are mentioned in pull requests of mine',
		correction: false,
		semantic: 'intersect(followers(intersect(repository-contributors(repositories-created(me)),users-mentioned(pull-requests-created(me)))),users-assigned(issues-opened(me)))',
	}, {
		query: 'people who are mentioned in my issues and pull requests',
		correction: false,
		semantic: 'intersect(users-mentioned(issues-opened(me)),users-mentioned(pull-requests-created(me)))',
	}, {
		query: 'people who are assigned to my issues and my pull requests',
		correction: false,
		semantic: 'intersect(users-assigned(issues-opened(me)),users-assigned(pull-requests-created(me)))',
	}, {
		query: 'people mentioned in my issues and my pull requests',
		correction: false,
		semantic: 'intersect(users-mentioned(issues-opened(me)),users-mentioned(pull-requests-created(me)))',
	}, {
		query: 'people not mentioned in my issues and my pull requests',
		correction: false,
		semantic: 'intersect(not(users-mentioned(issues-opened(me))),not(users-mentioned(pull-requests-created(me))))',
	}, {
		query: 'my {left-stop-word} repos',
		correction: 'my repos',
		semantic: 'repositories-created(me)',
		note: 'Stop words.',
	}, {
		query: 'my {left-stop-word} JavaScript repos',
		correction: 'my JavaScript repos',
		semantic: 'intersect(repositories-created(me),repositories-language(18))',
		note: 'Stop words.',
	}, {
		query: 'my JavaScript {left-stop-word} repos',
		correction: 'my JavaScript repos',
		semantic: 'intersect(repositories-created(me),repositories-language(18))',
		note: 'Stop words.',
	}, {
		query: 'my {left-stop-word} JavaScript {left-stop-word} repos',
		correction: 'my JavaScript repos',
		semantic: 'intersect(repositories-created(me),repositories-language(18))',
		note: 'Stop words.',
	}, {
		query: 'my {left-stop-word} {left-stop-word} repos',
		correction: 'my repos',
		semantic: 'repositories-created(me)',
		note: 'Stop words.',
	}, {
		query: 'open issues',
		correction: false,
		semantic: 'issues-state(open)',
	}, {
		query: 'issues that are open',
		correction: false,
		semantic: 'issues-state(open)',
	}, {
		query: 'people assigned to my closed issues',
		correction: false,
		semantic: 'users-assigned(intersect(issues-opened(me),issues-state(closed)))',
	}, {
		query: 'contributors to my repos',
		correction: false,
		semantic: 'repository-contributors(repositories-created(me))',
	}, {
		query: 'contributors to my repos and repos of mine',
		correction: true,
	}, {
		query: 'likers of my repos',
		correction: false,
		semantic: 'repository-likers(repositories-created(me))',
	}, {
		query: 'creators of repos I like',
		correction: false,
		semantic: 'repository-creators(repositories-liked(me))',
	}, {
		query: 'likers of repos I like and repos I contributed to',
		correction: false,
		semantic: 'intersect(repository-likers(repositories-contributed(me)),repository-likers(repositories-liked(me)))',
	}, {
		query: 'creators of repos I like and repos I contributed to',
		correction: false,
		semantic: 'repository-creators(intersect(repositories-contributed(me),repositories-liked(me)))',
	}, {
		query: 'creators of pull requests I like and repos I like',
		correction: true,
	}, {
		query: 'likers of my repos and repos I contributed to',
		correction: false,
		semantic: 'intersect(repository-likers(repositories-contributed(me)),repository-likers(repositories-created(me)))',
	}, {
		query: 'creators of repos I like and pull requests I am mentioned in',
		correction: false,
		semantic: 'intersect(creators(repositories-liked(me)),creators(pull-requests-mentioned(me)))',
		note: 'Unsure about semantic.',
	}, {
		query: 'openers of closed issues that mention people I and my followers follow',
		correction: false,
		semantic: 'issue-openers(intersect(issues-mentioned(intersect(users-followed(me),users-followed(followers(me)))),issues-state(closed)))',
	}, {
		query: 'people who are not followers of mine',
		correction: false,
		semantic: 'not(followers(me))',
	}, {
		query: 'people who have not been followed by me',
		correction: false,
		semantic: 'not(users-followed(me))',
	}, {
		query: 'issues that are not open',
		correction: false,
		semantic: 'not(issues-state(open))',
	}, {
		query: 'issues that are closed',
		correction: false,
		semantic: 'issues-state(closed)',
	}, {
		query: 'people I do not follow',
		correction: false,
		semantic: 'not(users-followed(me))',
	}, {
		query: 'people who follow me and do not follow Danny',
		correction: false,
		semantic: 'intersect(followers(me),not(followers(0)))',
	}, {
		query: 'issues I am assigned to',
		correction: false,
		semantic: 'issues-assigned(me)',
	}, {
		query: 'issues assigned to me',
		correction: false,
		semantic: 'issues-assigned(me)',
	}, {
		query: '{left-stop-word} open issues that are never assigned to people who {pre-filter-stop-word} follow me',
		correction: 'open issues that are assigned to people who follow me',
		semantic: 'intersect(issues-assigned(followers(me)),issues-state(open))',
		note: 'Stop words.',
	}, {
		query: 'repos of people who follow me',
		correction: false,
		semantic: 'repositories-created(followers(me))',
	}, {
		query: 'followers of mine and people who follow me',
		correction: false,
		semantic: 'intersect(followers(me),followers(followers(me)))',
	}, {
		query: 'repos of mine and people who follow me',
		correction: true,
	}, {
		query: 'repos I like or my followers likes',
		correction: 'repos I like or my followers like',
		semantic: 'union(repositories-liked(me),repositories-liked(followers(me)))',
	}, {
		query: 'repos I or my followers likes',
		correction: 'repos I or my followers like',
		semantic: 'union(repositories-liked(me),repositories-liked(followers(me)))',
	}, {
		query: 'repos created by people I follow and Danny follows',
		correction: false,
		semantic: 'repositories-created(intersect(users-followed(0),users-followed(me)))',
	}, {
		query: 'repos created by people I and Danny follow',
		correction: false,
		semantic: 'repositories-created(intersect(users-followed(0),users-followed(me)))',
	}, {
		query: 'people who follow people',
		correction: true,
	}, {
		query: 'people followed by myself',
		correction: 'people followed by me',
		semantic: 'users-followed(me)',
	}, {
		query: 'people who follow I',
		correction: 'people who follow me',
		semantic: 'followers(me)',
	}, {
		query: 'people me follows',
		correction: 'people I follow',
		semantic: 'users-followed(me)',
	}, {
		query: 'openers of my closed issues that mention me people who follow me and my followers follow follow',
		correction: false,
		semantic: 'intersect(issue-openers(intersect(issues-mentioned(me),issues-opened(me),issues-state(closed))),users-followed(intersect(followers(me),users-followed(followers(me)))))',
	}, {
		query: 'repos people my followers follow like',
		correction: false,
		semantic: 'repositories-liked(users-followed(followers(me)))',
	}, {
		query: 'people people Danny follows follow',
		correction: false,
		semantic: 'users-followed(users-followed(0))',
	}, {
		query: 'repos people people Danny follows follow created Danny likes',
		correction: true,
	}, {
		query: 'followers of my followers who are followers of mine my followers who created repositories of my followers followers of mine who I follow like that are repos I contributed to follow',
		correction: false,
		semantic: 'intersect(followers(me),followers(followers(me)),users-followed(intersect(followers(me),repository-creators(intersect(repositories-contributed(me),repositories-created(followers(me)),repositories-liked(intersect(followers(me),users-followed(me))))))))',
	}, {
		query: 'repos contributed to by me',
		correction: false,
		semantic: 'repositories-contributed(me)',
	}, {
		query: 'repos to by me',
		correction: true,
	}, {
		query: 'repos liked contributed to by me',
		correction: true,
	}, {
		query: 'repos by me',
		correction: 'repos created by me',
		semantic: 'repositories-created(me)',
	}, {
		query: 'issues opened by me assigned to me',
		correction: 'issues assigned to me opened by me',
		semantic: 'intersect(issues-assigned(me),issues-opened(me))',
		note: 'Transposition.',
	}, {
		query: 'issues with 22 comments',
		correction: false,
		semantic: 'issues(comments-count(22))',
	}, {
		query: 'issues assigned to me with 22 comments',
		correction: false,
		semantic: 'intersect(issues(comments-count(22)),issues-assigned(me))',
	}, {
		query: 'issues with 20 to 34 comments I opened',
		correction: false,
		semantic: 'intersect(issues(comments-count(20,34)),issues-opened(me))',
	}, {
		query: 'issues that are with between 20 comments and 34 comments',
		correction: false,
		semantic: 'issues(comments-count(20,34))',
		note: "I do not like how this sounds. Might be okay."
	}, {
		query: 'issues that have 20 comments',
		correction: false,
		semantic: 'issues(comments-count(20))',
	}, {
		query: 'issues that have between 20 and 24 comments',
		correction: false,
		semantic: 'issues(comments-count(20,24))',
	}, {
		query: 'issues with between 20 and 24 comments',
		correction: false,
		semantic: 'issues(comments-count(20,24))',
	}, {
		query: 'issues with between 20 and 24 comment',
		correction: 'issues with between 20 and 24 comments',
		semantic: 'issues(comments-count(20,24))',
	}, {
		query: 'issues with between 20 comments and 24 comments',
		correction: false,
		semantic: 'issues(comments-count(20,24))',
	}, {
		query: 'issues with between 20 comment and 24 comment',
		correction: 'issues with between 20 comments and 24 comments',
		semantic: 'issues(comments-count(20,24))',
	}, {
		query: 'issues with 3 comments to 3 comments',
		correction: true,
	}, {
		query: 'issues with 3 to 3 comments',
		correction: true,
	}, {
		query: 'issues with 1 comments to 5 comments',
		correction: false,
		semantic: 'issues(comments-count(1,5))',
	}, {
		query: 'issues with 1 to 5 comments',
		correction: false,
		semantic: 'issues(comments-count(1,5))',
	}, {
		query: 'issues with less than 2 > 4 comments',
		correction: 'issues with less than 2 and > 4 comments',
		semantic: 'issues(comments-count-over(4),comments-count-under(2))',
	}, {
		query: 'issues with less than 2 and > 4 comments',
		correction: false,
		semantic: 'issues(comments-count-over(4),comments-count-under(2))',
	}, {
		query: 'JavaScript repos liked by me and my followers',
		correction: false,
		semantic: 'intersect(repositories-language(18),repositories-liked(me),repositories-liked(followers(me)))',
	}, {
		query: 'repos with between 22 and 23 likes',
		correction: 'repos with between 22 and 23 stars',
		semantic: 'repositories(stars-count(22,23))',
	}, {
		query: 'repos with between 22 and 23 stars',
		correction: false,
		semantic: 'repositories(stars-count(22,23))',
	}, {
		query: 'repos created in 2014',
		correction: false,
		semantic: 'repositories(date(2014))',
	}, {
		query: 'repos created 2014',
		correction: 'repos created in 2014',
		semantic: 'repositories(date(2014))',
	}, {
		query: 'repos created in June 2014',
		correction: false,
		semantic: 'repositories(date(2014,jun))',
	}, {
		query: 'repos created in June 24 2014',
		correction: 'repos created on June 24 2014',
		semantic: 'repositories(date(2014,24,jun))',
	}, {
		query: 'repos created this year',
		correction: false,
		semantic: 'repositories(date(this-year))',
	}, {
		query: 'repos created after this year',
		correction: false,
		semantic: 'repositories(date-after(this-year))',
	}, {
		query: 'repos created between last year and this year',
		correction: false,
		semantic: 'repositories(date-interval-end(this-year),date-interval-start(last-year))',
	}, {
		query: 'repos created from 2012 to 2014',
		correction: false,
		semantic: 'repositories(date-interval-end(2014),date-interval-start(2012))',
	}, {
		query: 'repos created before June 20 2000 and after this year',
		correction: false,
		semantic: 'repositories(date-after(this-year),date-before(20,2000,jun))',
		note: "Perhaps prevent this because logically contradictory.",
	}, {
		query: 'people I and Danny follows',
		correction: 'people I and Danny follow',
		semantic: 'intersect(users-followed(0),users-followed(me))',
	}, {
		query: 'people people Danny follow and Danny follows',
		correction: 'people people Danny follows and Danny follow',
		semantic: 'intersect(users-followed(0),users-followed(users-followed(0)))',
	}, {
		query: 'likers of my repos I contributed to that I like and my repos I contributed to',
		correction: false,
		semantic: 'intersect(repository-likers(intersect(repositories-contributed(me),repositories-created(me),repositories-liked(me))),repository-likers(intersect(repositories-contributed(me),repositories-created(me))))',
	}, {
		query: 'my GitHub repos liked by my github followers',
		correction: 'my GitHub repos liked by my GitHub followers',
		semantic: 'intersect(repositories-created(me),repositories-liked(followers(me)))',
		note: "Corrects capitalization.",
	}, {
		query: 'my followers\' repos',
		correction: false,
		semantic: 'repositories-created(followers(me))',
	}, {
		query: 'my {left-stop-word} followers\' repos',
		correction: 'my followers\' repos',
		semantic: 'repositories-created(followers(me))',
		note: 'Stop words.',
	}, {
		query: 'my {left-stop-word} followers\' {left-stop-word} repos',
		correction: 'my followers\' repos',
		semantic: 'repositories-created(followers(me))',
		note: 'Stop words.',
	}, {
		query: 'Danny\'s followers\' followers',
		correction: false,
		semantic: 'followers(followers(3))',
	}, {
		query: 'repos of Danny\'s',
		correction: false,
		semantic: 'repositories-created(3)',
	}, {
		query: 'Danny\'s followers',
		correction: false,
		semantic: 'followers(3)',
	}, {
		query: 'female people',
		correction: false,
		semantic: 'users-gender(female)',
		note: 'Perhaps correct to "females".',
	}, {
		query: 'female people who are male',
		correction: true,
	}, {
		query: 'male people who are not male',
		correction: true,
	}, {
		query: 'my male followers',
		correction: false,
		semantic: 'intersect(followers(me),users-gender(male))',
	}, {
		query: 'Danny\'s male followers',
		correction: false,
		semantic: 'intersect(followers(3),users-gender(male))',
	}, {
		query: 'my followers\' female followers',
		correction: false,
		semantic: 'intersect(followers(followers(me)),users-gender(female))',
	}, {
		query: 'my female followers\' female followers',
		correction: false,
		semantic: 'intersect(followers(intersect(followers(me),users-gender(female))),users-gender(female))',
	}, {
		query: 'my female followers\' female followers who are not male',
		correction: false,
		semantic: 'intersect(followers(intersect(followers(me),users-gender(female))),not(users-gender(male)),users-gender(female))',
	}, {
		query: 'REPOS i LiKe',
		correction: 'repos I like',
		semantic: 'repositories-liked(me)',
	}, {
		query: 'repos that are not created today liked by me',
		correction: 'repos that were not created today liked by me',
		semantic: 'intersect(not(repositories(date(today))),not(repositories-liked(me)))',
	}, {
		query: 'people who are not my followers',
		correction: false,
		semantic: 'not(followers(me))',
	}, {
		query: 'repos not created today not liked by me',
		correction: 'repos not created today that are not liked by me',
		semantic: 'intersect(not(repositories(date(today))),not(repositories-liked(me)))',
	}, {
		query: 'women',
		correction: false,
		semantic: 'users-gender(female)',
	}, {
		query: 'men I follow',
		correction: false,
		semantic: 'intersect(users-followed(me),users-gender(male))',
	}, {
		query: 'men who I follow',
		correction: false,
		semantic: 'intersect(users-followed(me),users-gender(male))',
	}, {
		query: 'people who are male',
		correction: false,
		semantic: 'users-gender(male)',
	}, {
		query: 'people who are males',
		correction: false,
		semantic: 'users-gender(male)',
		note: 'Should this correct to "people who are male"?',
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
		correction: 'people people I follow who Danny follows and follow Danny follow',
		semantic: 'users-followed(intersect(followers(0),users-followed(0),users-followed(me)))',
	}, {
		query: 'repos people I follow created that Danny like',
		correction: 'repos people I follow created that Danny likes',
		semantic: 'intersect(repositories-created(users-followed(me)),repositories-liked(0))',
	}, {
		query: 'issues assigned to me Danny opened and Aang are mentioned in',
		correction: 'issues assigned to me Danny opened and Aang is mentioned in',
		semantic: 'intersect(issues-assigned(me),issues-mentioned(1),issues-opened(0))',
	}, {
		query: 'people {user} follows',
		correction: true,
		note: 'Cannot use placeholder symbols.',
	}, {
		query: 'people I and {user} follow',
		correction: true,
		note: 'Cannot use placeholder symbols.',
	}, {
		query: 'issues with <int> comments',
		correction: true,
		note: 'Cannot use placeholder symbols.',
	}, {
		query: 'my repos me people who follow my followers have been and',
		correction: true,
	}, {
		query: 'people my followers who created repositories of my followers followers of mine who I follow like follow',
		correction: false,
		semantic: 'users-followed(intersect(followers(me),repository-creators(intersect(repositories-created(followers(me)),repositories-liked(intersect(followers(me),users-followed(me)))))))',
	}, {
		query: 'contributors to my repos or repos I like or Danny likes',
		correction: false,
		semantic: 'repository-contributors(union(repositories-created(me),union(repositories-liked(0),repositories-liked(me))))',
	}, {
		query: 'repos I like or I created',
		correction: false,
		semantic: 'union(repositories-created(me),repositories-liked(me))',
	}, {
		query: 'repos I or Danny like',
		correction: false,
		semantic: 'union(repositories-liked(0),repositories-liked(me))',
	}, {
		query: 'repos I or Danny or my followers like',
		correction: false,
		semantic: 'union(repositories-liked(0),repositories-liked(me),repositories-liked(followers(me)))',
	}, {
		query: 'repos I or Danny and my followers like',
		correction: false,
		semantic: 'repositories-liked(union(0,me,followers(me)))',
		semantic: 'union(repositories-liked(0),intersect(repositories-liked(me),repositories-liked(followers(me))))',
	}, {
		query: 'repos I or Danny created',
		correction: false,
		semantic: 'union(repositories-created(me),repositories-created(0))',
	}, {
		query: 'repos I or Danny or my followers created',
		correction: false,
		semantic: 'union(repositories-created(0),repositories-created(me),repositories-created(followers(me)))',
	}, {
		query: 'people never currently I follow',
		correction: 'people I follow',
		semantic: 'users-followed(me)',
	}, {
		query: 'people I have',
		correction: true,
	}, {
		query: 'repos I have',
		correction: true,
	}, {
		query: 'repos been liked by me',
		correction: 'repos that have been liked by me',
		semantic: 'repositories-liked(me)',
	}, {
		query: 'people who not been followed by me',
		correction: 'people who have not been followed by me',
		semantic: 'not(users-followed(me))',
	}, {
		query: 'repos I contributed to',
		correction: false,
		semantic: 'repositories-contributed(me)',
	}, {
		query: 'repos I did not contributed to',
		correction: 'repos I do not contribute to',
		semantic: 'not(repositories-contributed(me))',
	}, {
		query: 'repos I have not contributed to',
		correction: false,
		semantic: 'not(repositories-contributed(me))',
	}, {
		query: 'repos I did not contribute to',
		correction: false,
		semantic: 'not(repositories-contributed(me))',
		note: 'Maybe only "have not".',
	}, {
		query: 'repos I do not contribute to',
		correction: false,
		semantic: 'not(repositories-contributed(me))',
		note: 'Unsure.',
	}, {
		query: 'repos I to contributed to',
		correction: 'repos I contributed to',
		semantic: 'repositories-contributed(me)',
	}, {
		query: 'repos I to created',
		correction: 'repos I created',
		semantic: 'repositories-created(me)',
	}, {
		query: 'repos I to have created',
		correction: 'repos I have created',
		semantic: 'repositories-created(me)',
	}, {
		query: 'repos I and Danny have contributed to',
		correction: false,
		semantic: 'intersect(repositories-contributed(0),repositories-contributed(me))',
	}, {
		query: 'repos I or Danny have contributed to',
		correction: false,
		semantic: 'union(repositories-contributed(0),repositories-contributed(me))',
	}, {
		query: 'repos I did create',
		correction: 'repos I created',
		semantic: 'repositories-created(me)',
	}, {
		query: 'people who have liked my repos',
		correction: false,
		semantic: 'repository-likers(repositories-created(me))',
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
		semantic: 'intersect(issues-mentioned(followers(repository-likers(repositories-contributed(repository-creators(4))))),issues-opened(me))',
	}, {
		query: 'issues opened by me that mention followers of people who like repos creators of Node contributed to and are assigned to pull requests I am not mentioned in',
		correction: false,
		semantic: 'intersect(issues-mentioned(followers(intersect(repository-likers(repositories-contributed(repository-creators(4))),users-assigned(not(pull-requests-mentioned(me)))))),issues-opened(me))',
	}, {
		query: 'issues opened by me that mention followers of people who like repos creators of Node contribute to and are assigned to pull requests I am not mentioned in',
		correction: false,
		semantic: 'intersect(issues-mentioned(followers(intersect(repository-likers(repositories-contributed(repository-creators(4))),users-assigned(not(pull-requests-mentioned(me)))))),issues-opened(me))',
	}, {
		query: 'issues opened me followers people repos creators of Node contributed to assigned to pull requests am not mentioned in',
		correction: true,
	}, {
		query: 'people who do contributed to my repos',
		correction: 'people who do not contribute to my repos',
		semantic: 'not(repository-contributors(repositories-created(me)))',
	}, {
		query: 'people who do contributed not to my repos',
		correction: true,
		note: 'Unsure.',
	}, {
		query: 'issues with -20 to 34 comments I opened',
		correction: true,
	}, {
		query: 'repos created before June 0 2000 and July -2 3000',
		correction: true,
	}, {
		query: 'repos created before June 32 1940',
		correction: true,
	}, {
		query: 'repos created before June 31 1950',
		correction: false,
		semantic: 'repositories(date-before(1950,31,jun))',
	}, {
		query: 'people who do not follow me',
		correction: false,
		semantic: 'not(followers(me))',
	}, {
		query: 'people who people',
		correction: true,
	}, {
		query: 'people who followers',
		correction: true,
	}, {
		query: 'my pull requests assigned to me',
		correction: false,
		semantic: 'intersect(pull-requests-assigned(me),pull-requests-created(me))',
	}, {
		query: 'repos I do not like',
		correction: false,
		semantic: 'not(repositories-liked(me))',
	}, {
		query: 'repos I did not like',
		correction: true,
		note: 'I do not know whether to prevent "repos I did not like" because "repos I did not star" is acceptable.',
	}, {
		query: 'repos Danny does not like',
		correction: false,
		semantic: 'not(repositories-liked(0))',
	}, {
		query: 'repos Danny has not liked',
		correction: false,
		semantic: 'not(repositories-liked(0))',
	}, {
		query: 'repos Danny has liked',
		correction: false,
		semantic: 'repositories-liked(0)',
	}, {
		query: 'repos Danny have likes',
		correction: 'repos Danny has liked',
		semantic: 'repositories-liked(0)',
	}, {
		query: 'repos I have not liked',
		correction: false,
		semantic: 'not(repositories-liked(me))',
	}, {
		query: 'repos I has not liked',
		correction: 'repos I have not liked',
		semantic: 'not(repositories-liked(me))',
	}, {
		query: 'repos I not have liked',
		correction: true,
		note: 'Add transposition correction?',
	}, {
		query: 'repos people who follow me and I do not like',
		correction: false,
		semantic: 'intersect(not(repositories-liked(me)),not(repositories-liked(followers(me))))',
	}, {
		query: 'repos people who follow me and me do not like',
		correction: 'repos people who follow me and I do not like',
		semantic: 'intersect(not(repositories-liked(me)),not(repositories-liked(followers(me))))',
	}, {
		query: 'repos people who follow me created that Aang does not like',
		correction: false,
		semantic: 'intersect(not(repositories-liked(1)),repositories-created(followers(me)))',
	}, {
		query: 'repos people who follow me and I does not like',
		correction: 'repos people who follow me and I do not like',
		semantic: 'intersect(not(repositories-liked(me)),not(repositories-liked(followers(me))))',
	}, {
		query: 'repos people who follow me and I have not liked',
		correction: false,
		semantic: 'intersect(not(repositories-liked(me)),not(repositories-liked(followers(me))))',
	}, {
		query: 'repos people who follow me and I has not likes',
		correction: 'repos people who follow me and I have not liked',
		semantic: 'intersect(not(repositories-liked(me)),not(repositories-liked(followers(me))))',
	}, {
		query: 'repos people who have not liked Danny\'s repos created',
		correction: false,
		semantic: 'repositories-created(not(repository-likers(repositories-created(3))))',
	}, {
		query: 'repos I did not have liked',
		correction: true,
	}, {
		query: 'repos Danny and I do not like',
		correction: false,
		semantic: 'intersect(not(repositories-liked(0)),not(repositories-liked(me)))',
	}, {
		query: 'repos Danny and people who follow Danny have not liked',
		correction: false,
		semantic: 'intersect(not(repositories-liked(0)),not(repositories-liked(followers(0))))',
	}, {
		query: 'repos that have been liked by me',
		correction: false,
		semantic: 'repositories-liked(me)',
	}, {
		query: 'people who do not like my repos',
		correction: false,
		semantic: 'not(repository-likers(repositories-created(me)))',
	}, {
		query: 'repos that have not been liked by me',
		correction: false,
		semantic: 'not(repositories-liked(me))',
	}, {
		query: 'repos that not been liked by me',
		correction: 'repos that have not been liked by me',
		semantic: 'not(repositories-liked(me))',
	}, {
		query: 'repos not been liked by me',
		correction: 'repos that have not been liked by me',
		semantic: 'not(repositories-liked(me))',
	}, {
		query: 'people who have not liked my repos',
		correction: false,
		semantic: 'not(repository-likers(repositories-created(me)))',
	}, {
		query: 'repos I and Danny do not liked',
		correction: 'repos I and Danny do not like',
		semantic: 'intersect(not(repositories-liked(0)),not(repositories-liked(me)))',
	}, {
		query: 'repos I and Danny do not like',
		correction: false,
		semantic: 'intersect(not(repositories-liked(0)),not(repositories-liked(me)))',
	}, {
		query: 'repos I and Danny have not liked',
		correction: false,
		semantic: 'intersect(not(repositories-liked(0)),not(repositories-liked(me)))',
	}, {
		query: 'repos Danny does like',
		correction: 'repos Danny likes',
		semantic: 'repositories-liked(0)',
	}, {
		query: 'repos I not liked',
		correction: 'repos I do not like',
		semantic: 'not(repositories-liked(me))',
		note: 'Unsure.',
	}, {
		query: 'repos Danny and Aang and I do not like',
		correction: false,
		semantic: 'intersect(not(repositories-liked(0)),not(repositories-liked(1)),not(repositories-liked(me)))',
	}, {
		query: 'repos Danny and has not liked',
		correction: 'repos Danny has not liked',
		semantic: 'not(repositories-liked(0))',
	}, {
		query: 'repos Danny and Aang not have liked',
		correction: 'repos Danny and Aang have not liked',
		semantic: 'intersect(not(repositories-liked(0)),not(repositories-liked(1)))',
	}, {
		query: 'repos my followers have not liked',
		correction: false,
		semantic: 'not(repositories-liked(followers(me)))',
	}, {
		query: 'repos my followers like',
		correction: false,
		semantic: 'repositories-liked(followers(me))',
	}, {
		query: 'my repositories people who created my repos created',
		correction: true,
	}, {
		query: 'repos created today created yesterday',
		correction: true,
	}, {
		query: 'people who like my repos liked by people who follow me that people I follow created',
		correction: true,
	}, {
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
		semantic: 'intersect(repositories-contributed(0),repositories-liked(me))',
	}, {
		query: 'repos I and Danny have not contributed to',
		correction: false,
		semantic: 'intersect(not(repositories-contributed(0)),not(repositories-contributed(me)))',
	}, {
		query: 'repos people who do not like my repos have not contributed to',
		correction: false,
		semantic: 'not(repositories-contributed(not(repository-likers(repositories-created(me)))))',
	}, {
		query: 'people who have not contributed to my repos',
		correction: false,
		semantic: 'not(repository-contributors(repositories-created(me)))',
	}, {
		query: 'repos that are not JavaScript repos',
		correction: false,
		semantic: 'not(repositories-language(18))',
	}, {
		query: 'repos that are not written in JavaScript',
		correction: false,
		semantic: 'not(repositories-language(18))',
	}, {
		query: 'people who are not followed by me',
		correction: false,
		semantic: 'not(users-followed(me))',
	}, {
		query: 'people not followed by me',
		correction: false,
		semantic: 'not(users-followed(me))',
	}, {
		query: 'repos not written in JavaScript',
		correction: false,
		semantic: 'not(repositories-language(18))',
	}, {
		query: 'people not mentioned in my issues',
		correction: false,
		semantic: 'not(users-mentioned(issues-opened(me)))',
	}, {
		query: 'issues not assigned to me',
		correction: false,
		semantic: 'not(issues-assigned(me))',
	}, {
		query: 'issues that are not assigned to me',
		correction: false,
		semantic: 'not(issues-assigned(me))',
	}, {
		query: 'repos that are not my repos',
		correction: false,
		semantic: 'not(repositories-created(me))',
	}, {
		query: 'repos I create',
		correction: 'repos I created',
		semantic: 'repositories-created(me)',
	}, {
		query: 'repos I created',
		correction: false,
		semantic: 'repositories-created(me)',
	}, {
		query: 'repos Danny has created',
		correction: false,
		semantic: 'repositories-created(0)',
	}, {
		query: 'repos I did not create',
		correction: false,
		semantic: 'not(repositories-created(me))',
	}, {
		query: 'repos Danny did not create',
		correction: false,
		semantic: 'not(repositories-created(0))',
	}, {
		query: 'repos Danny do not creates',
		correction: 'repos Danny did not create',
		semantic: 'not(repositories-created(0))',
	}, {
		query: 'repos I have not created',
		correction: 'repos I did not create',
		semantic: 'not(repositories-created(me))',
		note: 'Incorrect because implies the returned repos can be "created" in the future.',
	}, {
		query: 'repos Danny has not created',
		correction: 'repos Danny did not create',
		semantic: 'not(repositories-created(0))',
	}, {
		query: 'repos I made',
		correction: 'repos I created',
		semantic: 'repositories-created(me)',
	}, {
		query: 'repos I did not make',
		correction: 'repos I did not create',
		semantic: 'not(repositories-created(me))',
	}, {
		query: 'repos I did not made',
		correction: 'repos I did not create',
		semantic: 'not(repositories-created(me))',
	}, {
		query: 'issues I did not open',
		correction: false,
		semantic: 'not(issues-opened(me))',
	}, {
		query: 'issues I create',
		correction: 'issues I created',
		semantic: 'issues-opened(me)',
	}, {
		query: 'issues I did not created',
		correction: 'issues I did not create',
		semantic: 'not(issues-opened(me))',
	}, {
		query: 'people who do not created my repos',
		correction: 'people who did not create my repos',
		semantic: 'not(repository-creators(repositories-created(me)))',
	}, {
		query: 'people who did not create my repos',
		correction: false,
		semantic: 'not(repository-creators(repositories-created(me)))',
	}, {
		query: 'people who do not have liked my repos',
		correction: true,
		note: 'Unsure.',
	}, {
		query: 'people who do not have opened my issues',
		correction: true,
		note: 'Unsure.',
	}, {
		query: 'issues that do not mention me',
		correction: false,
		semantic: 'not(issues-mentioned(me))',
	}, {
		query: 'issues that are not assigned to my followers',
		correction: false,
		semantic: 'not(issues-assigned(followers(me)))',
	}, {
		query: 'issues that have not been assigned to me',
		correction: false,
		semantic: 'not(issues-assigned(me))',
	}, {
		query: 'issues Danny is not assigned to',
		correction: false,
		semantic: 'not(issues-assigned(0))',
	}, {
		query: 'pull requests my followers are not mentioned in',
		correction: false,
		semantic: 'not(pull-requests-mentioned(followers(me)))',
	}, {
		query: 'pull requests that have not been assigned to me',
		correction: false,
		semantic: 'not(pull-requests-assigned(me))',
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
		correction: 'people who do not contribute to my repos',
		semantic: 'not(repository-contributors(repositories-created(me)))',
		note: 'Unsure.',
	}, {
		query: 'Danny\'s followers who do not follow me',
		correction: false,
		semantic: 'intersect(followers(3),not(followers(me)))',
	}, {
		query: 'people who forked Node',
		correction: false,
		semantic: 'repository-forkers(4)',
	}, {
		query: 'people who forked my repos',
		correction: false,
		semantic: 'repository-forkers(repositories-created(me))',
	}, {
		query: 'repos I have not forked',
		correction: false,
		semantic: 'not(repositories-forked(me))',
	}, {
		query: 'repos I forked pushed last year',
		correction: 'repos pushed last year I forked',
		semantic: 'intersect(repositories-forked(me),repositories-pushed(date(last-year)))',
	}, {
		query: 'repos I forked that are pushed last year',
		correction: 'repos I forked that were pushed last year',
		semantic: 'intersect(repositories-forked(me),repositories-pushed(date(last-year)))',
	}, {
		query: 'repos with greater than 20 forks and fewer than 0 forks',
		correction: false,
		semantic: 'repositories(forks-count-over(20),forks-count-under(0))',
		note: 'Perhaps prevent this.',
	}, {
		query: 'repos Danny did not fork',
		correction: false,
		semantic: 'not(repositories-forked(0))',
		note: 'Should this only be "has not forked"?',
	}, {
		query: 'repos Danny has not forked',
		correction: false,
		semantic: 'not(repositories-forked(0))',
	}, {
		query: 'people who do not contribute to my repos',
		correction: false,
		semantic: 'not(repository-contributors(repositories-created(me)))',
		note: 'Perhaps correct to "people who have not".',
	}, {
		query: 'repos Danny does not contribute to',
		correction: false,
		semantic: 'not(repositories-contributed(0))',
	}, {
		query: 'repos Danny has not contributed to',
		correction: false,
		semantic: 'not(repositories-contributed(0))',
	}, {
		query: 'repos Danny or Aang do not contribute to',
		correction: false,
		semantic: 'union(not(repositories-contributed(0)),not(repositories-contributed(1)))',
	}, {
		query: 'repos Danny and Aang do not contribute to',
		correction: false,
		semantic: 'intersect(not(repositories-contributed(0)),not(repositories-contributed(1)))',
	}, {
		query: 'repos I and Danny or Aang and my followers like',
		correction: false,
		semantic: 'union(intersect(repositories-liked(me),repositories-liked(0)),intersect(repositories-liked(1),repositories-liked(followers(me))))',
	}, {
		query: 'repos I and Danny or Danny and my followers like',
		correction: false,
		semantic: 'union(intersect(repositories-liked(me),repositories-liked(0)),intersect(repositories-liked(0),repositories-liked(followers(me))))',
	}, {
		query: 'contributors of repos I did not contribute to pushed last year',
		correction: 'contributors of repos pushed last year I do not contribute to',
		semantic: 'repository-contributors(intersect(not(repositories-contributed(me)),repositories-pushed(date(last-year))))',
		note: 'Unsure about "do/did not".',
	}, {
		query: 'people who contributed to issues I opened',
		correction: true,
	}, {
		query: 'people I follow',
		correction: false,
		semantic: 'users-followed(me)',
	}, {
		query: 'people Danny follows',
		correction: false,
		semantic: 'users-followed(0)',
	}, {
		query: 'people I and Danny follow',
		correction: false,
		semantic: 'intersect(users-followed(0),users-followed(me))',
	}, {
		query: 'people Danny and I follow',
		correction: false,
		semantic: 'intersect(users-followed(0),users-followed(me))',
	}, {
		query: 'people people Danny follows and Danny follow',
		correction: false,
		semantic: 'intersect(users-followed(0),users-followed(users-followed(0)))',
	}, {
		query: 'issues assigned to me Danny opened and Aang is mentioned in',
		correction: false,
		semantic: 'intersect(issues-assigned(me),issues-mentioned(1),issues-opened(0))',
	}, {
		query: 'repos people I follow created that Danny likes',
		correction: false,
		semantic: 'intersect(repositories-created(users-followed(me)),repositories-liked(0))',
	}, {
		query: 'people people I follow who Danny follows and follow Danny follow',
		correction: false,
		semantic: 'users-followed(intersect(followers(0),users-followed(0),users-followed(me)))',
	}, {
		query: 'repos that are liked by my followers',
		correction: false,
		semantic: 'repositories-liked(followers(me))',
	}, {
		query: 'repos that were liked by my followers',
		correction: false,
		semantic: 'repositories-liked(followers(me))',
	}, {
		query: 'people who did not contribute to my repos',
		correction: false,
		semantic: 'not(repository-contributors(repositories-created(me)))',
	}, {
		query: 'repos that are created in 2014',
		correction: 'repos that were created in 2014',
		semantic: 'repositories(date(2014))',
	}, {
		query: 'repos that were created in 2014',
		correction: false,
		semantic: 'repositories(date(2014))',
	}, {
		query: 'repos that have been created by me',
		correction: false,
		semantic: 'repositories-created(me)',
		note: 'Perhaps correct to "repos that were created by me".',
	}, {
		query: 'issues that have between 20 comments and 34 comments',
		correction: false,
		semantic: 'issues(comments-count(20,34))',
	}, {
		query: 'repos not liked by me',
		correction: false,
		semantic: 'repositories-liked(me)',
	}, {
		query: 'repos that have been liked me',
		correction: 'repos that have been liked by me',
		semantic: 'repositories-liked(me)',
	}, {
		query: 'repos liked by me and forked by me',
		correction: false,
		semantic: 'intersect(repositories-forked(me),repositories-liked(me))',
	}, {
		query: 'repos liked by me and that are not forked by me',
		correction: 'repos liked by me that are not forked by me',
		semantic: 'intersect(not(repositories-forked(me)),repositories-liked(me))',
	}, {
		query: 'repos liked by me that are not forked by me',
		correction: false,
		semantic: 'intersect(not(repositories-forked(me)),repositories-liked(me))',
	}, {
		query: 'repos liked by me I have not contributed to',
		correction: false,
		semantic: 'intersect(not(repositories-contributed(me)),repositories-liked(me))',
	}, {
		query: 'repos liked by me and forked by me that I have not contributed to',
		correction: false,
		semantic: 'intersect(not(repositories-contributed(me)),repositories-forked(me),repositories-liked(me))',
	}, {
		query: 'issues that were updated today',
		correction: false,
		semantic: 'issues(date(today))',
	}, {
		query: 'repos created today liked by me forked by me',
		correction: 'repos created today and liked by me and forked by me',
		semantic: 'intersect(repositories(date(today)),repositories-forked(me),repositories-liked(me))',
		note: 'Perhaps "that are" or "and are" is inserted instead of "and".',
	}, {
		query: 'repos created by me forked by me',
		correction: 'repos created by me that are forked by me',
		semantic: 'intersect(repositories-created(me),repositories-forked(me))',
		note: 'Perhaps "and" or "and are" is inserted instead of "that are".',
	}, {
		query: 'repos created today liked by me',
		correction: 'repos created today that are liked by me',
		semantic: 'intersect(repositories(date(today)),repositories-liked(me))',
		note: 'Perhaps "and" or "and are" is inserted instead of "that are".',
	}, {
		query: 'repos not liked by me not forked by me',
		correction: 'repos liked by me that are not forked by me',
		semantic: 'intersect(not(repositories-forked(me)),repositories-liked(me))',
		note: 'Perhaps "and" or "and are" is inserted instead of "that are".',
	}, {
		query: 'repos not liked by me and not forked by me',
		correction: false,
		semantic: 'intersect(not(repositories-forked(me)),not(repositories-liked(me)))',
	}, {
		query: 'repos liked by me and forked by me and contributed to by me',
		correction: false,
		semantic: 'intersect(repositories-contributed(me),repositories-forked(me),repositories-liked(me))',
	}, {
		query: 'repos liked by me contributed to by me forked by me',
		correction: 'repos liked by me and contributed to by me and forked by me',
		semantic: 'intersect(repositories-contributed(me),repositories-forked(me),repositories-liked(me))',
	}, {
		query: 'repos liked by me that are contributed to by me and forked by me',
		correction: false,
		semantic: 'intersect(repositories-contributed(me),repositories-forked(me),repositories-liked(me))',
	}, {
		query: 'repos liked by me that are contributed to by me that are forked by me',
		correction: 'repos liked by me that are contributed to by me and that are forked by me',
		semantic: 'intersect(repositories-contributed(me),repositories-forked(me),repositories-liked(me))',
	}, {
		query: 'repos liked by me that are contributed to by me and that are forked by me',
		correction: false,
		semantic: 'intersect(repositories-contributed(me),repositories-forked(me),repositories-liked(me))',
	}, {
		query: 'repos that are liked by me and that are contributed to by me and that are forked by me',
		correction: false,
		semantic: 'intersect(repositories-contributed(me),repositories-forked(me),repositories-liked(me))',
	}, {
		query: 'repos that are liked by me that are contributed to by me and that are forked by me',
		correction: 'repos that are liked by me and that are contributed to by me and that are forked by me',
		semantic: 'intersect(repositories-contributed(me),repositories-forked(me),repositories-liked(me))',
	}, {
		query: 'repos that are liked by me contributed to by me',
		correction: 'repos that are liked by me and contributed to by me',
		semantic: 'intersect(repositories-contributed(me),repositories-liked(me))',
	}, {
		query: 'repos that are not liked by me and that are not contributed to by me and that are not forked by me',
		correction: false,
		semantic: 'intersect(not(repositories-contributed(me)),not(repositories-forked(me)),not(repositories-liked(me)))',
	}, {
		query: 'repos not created by me that are liked by me',
		correction: false,
		semantic: 'intersect(not(repositories-created(me)),repositories-liked(me))',
	}, {
		query: 'repos not created by me that are not liked by me',
		correction: false,
		semantic: 'intersect(not(repositories-created(me)),not(repositories-liked(me)))',
	}, {
		query: 'repos not written in JavaScript not liked by me',
		correction: 'repos not written in JavaScript that are not liked by me',
		semantic: 'intersect(not(repositories-liked(me)),not(repositories-language(18)))',
		note: 'Unsure if "that are" should be inserted.',
	}, {
		query: 'repos not written in JavaScript that are not liked by me',
		correction: false,
		semantic: 'intersect(not(repositories-liked(me)),not(repositories-language(18)))',
	}, {
		query: 'repos created today pushed yesterday',
		correction: true,
		note: 'This is assuming "created [date]" is treated as passive, thought currently is not.',
	}, {
		query: 'repos I created today',
		correction: false,
		semantic: 'intersect(repositories(date(today)),repositories-created(me))',
		note: 'Currently edits this, but that might be okay.',
	}, {
		query: 'my repos created after last week created last week',
		correction: true,
	}, {
		query: 'Danny contributes to',
		correction: 'repos Danny contributes to',
		semantic: 'repositories-contributed(0)',
	}, {
		query: 'repos I created I like',
		correction: 'repos I created that I like',
		semantic: 'intersect(repositories-created(me),repositories-liked(me))',
		note: 'Unimplemented.',
	}, {
		query: 'repos that I created I like',
		correction: 'repos that I created and I like',
		semantic: 'intersect(repositories-created(me),repositories-liked(me))',
		note: 'Unimplemented.',
	}, {
		query: 'repos that I created that I like',
		correction: 'repos that I created and that I like',
		semantic: 'intersect(repositories-created(me),repositories-liked(me))',
		note: 'Unimplemented.',
	}, {
		query: 'repos that I created and I like',
		correction: false,
		semantic: 'intersect(repositories-created(me),repositories-liked(me))',
	}, {
		query: 'repos that I created and that I like',
		correction: false,
		semantic: 'intersect(repositories-created(me),repositories-liked(me))',
	}, {
		query: 'people who I follow Danny follows',
		correction: 'people who I follow and Danny follows',
		semantic: 'intersect(users-followed(0),users-followed(me))',
		note: 'Unimplemented.',
	}, {
		query: 'people who I follow who Danny follows',
		correction: 'people who I follow and who Danny follows',
		semantic: 'intersect(users-followed(0),users-followed(me))',
		note: 'Unimplemented.',
	}, {
		query: 'my',
		correction: true,
		note: 'Unimplemented.',
	}, {
		query: 'repos created by creators of node and contributors to my repos',
		correction: true,
	}, {
		query: 'my repos I forked that I liked and',
		correction: true,
	}, {
		query: 'repos I like to like',
		correction: true,
	}, {
		query: 'repos with 02 stars',
		correction: 'repos with 2 stars',
	  semantic: 'repositories(stars-count(2))',
	}, {
		query: 'repos with 2.0 stars',
		correction: 'repos with 2 stars',
	  semantic: 'repositories(stars-count(2))',
	}, {
		query: 'repos created by John von Neumann',
		correction: false,
		semantic: 'repositories-created(2)',
	}, {
		query: 'people who follow Danny\'s',
		correction: true,
	}, {
		query: 'people who follow Danny\'s followers\'',
		correction: true,
	}, {
		query: 'people who follow my followers\' followers',
		correction: false,
		semantic: 'followers(followers(followers(me)))',
	}, {
		query: 'people who follow my followers\' followers\' followers',
		correction: false,
		semantic: 'followers(followers(followers(followers(me))))',
	}, {
		query: 'Aang',
		correction: false,
		semantic: '1',
	}, {
		query: 'Aang Danny\'s followers',
		correction: true,
	}, {
		query: 'Aang Danny',
		correction: true,
	}, {
		query: 'issues having 2 comments',
		correction: 'issues with 2 comments',
  	semantic: 'issues(comments-count(2))',
  	note: 'Terminal symbol substition with OR.',
	}, {
		query: 'repos I contribute',
		correction: 'repos I contribute to',
		semantic: 'repositories-contributed(me)',
		note: 'Partial match to multi-token terminal symbol.',
	}, {
		query: 'repos Aang contribute',
		correction: 'repos Aang contributes to',
		semantic: 'repositories-contributed(1)',
		note: 'Partial match to multi-token terminal symbol.',
	}, {
		query: 'issues with less than 100 comments',
		correction: false,
		semantic: 'issues(comments-count-under(100))',
		note: 'Accepted multi-token terminal symbol with OR.',
	}, {
		query: 'rules I to',
		correction: 'rules I contribute to',
		semantic: 'repositories-contributed(me)',
		note: 'Partial match to multi-token terminal symbol.',
	}, {
		query: 'issues updated after today and before yesterday updated after today',
		correction: true,
		note: 'Regarding the number of maxparams for category semantics, how we imeplement dates, and why not just use a category semantic for everything (e.g., issues(liked(1))). Or, we do not use category semantics for dates.'
	}

	// 'followers my followers share',
	// 'followers I and Danny have in common',
	// 'followers I share', // intentionally wrong
	// 'followers I share with Danny',
	// 'followers I and Danny share with Aang',
	// 'followers I and Danny share with Aang and my followers',
	// 'followers Danny has in common with' // doesn't work

	// 'my followers who created pull requests of mine my followers who created repositories followers of mine mentioned in issues of my followers who I follow like that are repos created by me I contributed to am mentioned in that I am mentioned in', // really slow, but because of some rule - look at parse stack. Remove some ambiguous insertions

	// Logically contradictory -> stopped by semantic processor. No legal results are possible, so parse continues until exhausted all possibilities. Will be solved by adding more edits to grammar.
	// - problems fixed by adding "my" to deletables (but that creates many more problems)
	// 'my repos are not my repos I created yesterday'
	// 'pull requests of mine created by my followers'
]