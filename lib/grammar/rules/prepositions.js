var g = require('../grammar')

var prepStr = 'prep'

// (people followed) by (me)
exports.agent = g.newSymbol(prepStr, 'agent').addWord({
	insertionCost: 0.5,
	accepted: [ 'by' ],
	substitutions: [
		{ symbol: 'from', costPenalty: 1 },
		{ symbol: 'via', costPenalty: 1 },
		{ symbol: 'of', costPenalty: 0.5 },
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|at|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|for|given|in|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|on|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|to|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|with|within|without|worth', costPenalty: 3 },
	],
})

// (followers) of (mine)
exports.possessor = g.newSymbol(prepStr, 'possessor').addWord({
	insertionCost: 0.5,
	accepted: [ 'of' ],
	substitutions: [
		{ symbol: 'with', costPenalty: 1 },
		{ symbol: 'to', costPenalty: 1 },
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|within|without|worth', costPenalty: 2 },
	],
})

// (likers) of (`[repositories+]`)
exports.participant = g.newSymbol(prepStr, 'participant').addWord({
	insertionCost: 0.5,
	accepted: [ 'of' ],
	substitutions: [
		{ symbol: 'at|for|in|with', costPenalty: 1 },
	],
})

// (contributors) to (`[repositories+]`)
exports.receiver = g.newInvariableTerm({
	symbolName: g.hyphenate(prepStr, 'receiver'),
	insertionCost: 0.5,
	acceptedTerms: [ 'to', 'of' ],
})

// (people who contribute) to (`[repositories+]`)
exports.contribute = g.newInvariableTerm({
	symbolName: g.hyphenate(prepStr, 'contribute'),
	insertionCost: 0.5,
	acceptedTerms: [ 'to' ],
})

// (people who work) on (`[repositories+]`)
exports.surface = g.newInvariableTerm({
	symbolName: g.hyphenate(prepStr, 'surface'),
	insertionCost: 0.5,
	acceptedTerms: [ 'on' ],
})

// (followers {user} shares) with (me)
exports.associative = g.newSymbol(prepStr, 'associative').addWord({
	insertionCost: 0.5,
	accepted: [ 'with' ],
	substitutions: [
		{ symbol: 'alongside|of|to', costPenalty: 1 },
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|amid|amidst|among|amongst|around|aside|astride|at|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|for|from|given|in|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|on|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 3 },
	],
})

// (repos written) in ({language})
exports.language = g.newInvariableTerm({
	symbolName: g.hyphenate(prepStr, 'language'),
	insertionCost: 0.5,
	acceptedTerms: [ 'in' ],
	substitutedTerms: [
		{ term: 'with', costPenalty: 0.5 },
		{ term: 'using', costPenalty: 0.5 },
	],
})

// (repos created) in (`[year]`)
exports.container = g.newSymbol(prepStr, 'container').addWord({
	insertionCost: 0.5,
	accepted: [ 'in', 'within', 'during' ],
	substitutions: [
		{ symbol: 'on', costPenalty: 0.8 },
		{ symbol: 'from', costPenalty: 0.8 },
		{ symbol: 'of', costPenalty: 1 },
		{ symbol: 'inside |of', costPenalty: 1 },
		{ symbol: 'into', costPenalty: 1 },
		{ symbol: 'aboard|about|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|at|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|by|despite|down|except|excluding|failing|following|for|given|including|lest|like|minus|modulo|near|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|to|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|without|worth', costPenalty: 2 },
	],
})

// (repos created) on ([month] [day] `[year]`)
exports.day = g.newInvariableTerm({
	symbolName: g.hyphenate(prepStr, 'day'),
	insertionCost: 0.5,
	acceptedTerms: [ 'on' ],
	substitutedTerms: [
		{ term: 'in', costPenalty: 0.5 },
		{ term: 'within', costPenalty: 0.5 },
		{ term: 'during', costPenalty: 0.5 },
	],
})

// (repos created) before (`[year]`)
exports.before = g.newSymbol(prepStr, 'before').addWord({
	insertionCost: 0.5,
	accepted: [ 'before', 'until', 'earlier than', 'prior|up to', '<' ],
	substitutions: [
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (repos created) after (`[year]`)
exports.after = g.newSymbol(prepStr, 'after').addWord({
	insertionCost: 1,
	accepted: [ 'after', 'since', 'later than', 'subsequent to', '>' ],
	substitutions: [
		{ symbol: 'aboard|above|absent|across|afore|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (repos created) from (`[year]` to `[year]`)
exports.start = g.newSymbol(prepStr, 'start').addWord({
	insertionCost: 0.8,
	accepted: [ 'from' ],
	substitutions: [
		{ symbol: 'in', costPenalty: 1 },
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (repos created from `[year]`) to (`[year]`)
// (issues with `<int>`) to (`<int>` comments)
exports.end = g.newSymbol(prepStr, 'end').addWord({
	insertionCost: 0.5,
	accepted: [ 'to' ],
	substitutions: [
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (issues) with (`<int>` comments)
exports.possessed = g.newSymbol(prepStr, 'possessed').addWord({
	insertionCost: 0.5,
	accepted: [ 'with' ],
	substitutions: [
		{ symbol: 'have', costPenalty: 1 },
		{ symbol: 'having', costPenalty: 1 },
		{ symbol: 'containing', costPenalty: 1 },
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|within|without|worth', costPenalty: 2 },
	],
})

// (issues with) between (`<int>` and `<int>` comments)
exports.between = g.newSymbol(prepStr, 'between').addWord({
	insertionCost: 2,
	accepted: [ 'between' ],
	substitutions: [
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|from|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (issues with) over (`<int>` comments)
exports.over = g.newSymbol(prepStr, 'over').addWord({
	insertionCost: 0.5,
	accepted: [ 'over', 'above', 'beyond', 'greater|more than', '>' ],
	substitutions: [
		{ symbol: 'aboard|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (issues with) under (`<int>` comments)
exports.under = g.newSymbol(prepStr, 'under').addWord({
	insertionCost: 0.5,
	accepted: [ 'under', 'below', 'fewer|less than', '<' ],
	substitutions: [
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (companies that raised `<int>`) in (funding)
exports.medium = g.newInvariableTerm({
	symbolName: g.hyphenate(prepStr, 'medium'),
	insertionCost: 0.5,
	acceptedTerms: [ 'in', 'of' ],
})

// The benefactive case expresses the person/thing (i.e., the referent of the noun) that benefits from the action of the verb (or the situation expressed by the clause). E.g., "for", "for the benefit of", and "intended for".
// (people who work) at/for (`[company]`)
exports.benefactive = g.newSymbol(prepStr, 'benefactive').addWord({
	insertionCost: 0.5,
	accepted: [ 'at', 'for' ],
	substitutions: [
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|from|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 3 },
	],
})

// (followers I and `{user}` have) in (common)
// (followers I have) in (common with `{user}`)
exports.in = g.newInvariableTerm({
	symbolName: g.hyphenate(prepStr, 'in'),
	insertionCost: 0.5,
	acceptedTerms: [ 'in' ],
})