// Might be able to be accomplsih reduction in search.js, but here we are proving accuracy and performance improvements
// At last check, reductions applied here save 10% from parse time


var semantic = require('../grammar/semantic')
var util = require('../util')

module.exports = function (startNode) {
	for (var s = 0, subs = startNode.subs, subsLen = subs.length; s < subsLen; ++s) {
		var sub = subs[s]

		sub.minCost = 0 // initialize to 0 to add for sub and sub.next
		reduce(sub, sub.node.subs)
	}
}

function reduce(parentSub, subs) {
	var minCost

	for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
		var sub = subs[s]

		// Do not inspect same sub more than once (subs can be in more than one node)
		if (sub.minCost === undefined) {
			sub.minCost = 0 // initialize to 0 to add for sub and sub.next

			var childSubs = sub.node.subs
			if (childSubs) {
				reduce(sub, childSubs)

				// Only nonterminal rules are binary (hence, within childSubs check)
				var subNext = sub.next
				if (subNext) {
					// sub.next will never be terminal (because all binary rules are nonterminal)
					reduce(sub, subNext.node.subs)
				}
			}
		}

		// Get cost after calling reduce() on children because of reductions
		var subRuleProps = sub.ruleProps
		var cost = sub.minCost + (subRuleProps.constructor === Array ? subRuleProps[0].cost : subRuleProps.cost)

		if (minCost === undefined || cost < minCost) {
			minCost = cost
		}
	}

	// Add for cost of sub and sub.next
	parentSub.minCost += minCost

	// We are handling the same parentSub more than once, but unsure how
	// Could be there are duplicates because of different 'position' in query (diff nodeTab)
	if (subsLen === 1) {
		if (parentSub.next || sub.next) return

		var parentRuleProps = parentSub.ruleProps

		if (parentRuleProps.constructor === Array || subRuleProps.constructor	=== Array) return
		if (parentRuleProps.insertedSemantic && subRuleProps.insertedSemantic) return
		if (parentRuleProps.semantic && subRuleProps.semantic) return
		if (parentRuleProps.personNumber) return
		if (parentRuleProps.insertionIdx === 0 && subRuleProps.insertionIdx === 0) return
		if (parentRuleProps.insertionIdx === 1 || subRuleProps.insertionIdx === 1) return

		parentSub.node = sub.node
		parentSub.minCost = sub.minCost
		var newRuleProps = parentSub.ruleProps = {
			cost: parentRuleProps.cost + subRuleProps.cost
		}

		var insertedSemantic = parentRuleProps.insertedSemantic || subRuleProps.insertedSemantic
		if (insertedSemantic) {
			newRuleProps.semanticIsRHS = true

			if (parentRuleProps.semantic) {
				newRuleProps.semantic = semantic.insertSemantic(parentRuleProps.semantic, insertedSemantic)
			} else if (subRuleProps.semantic) {
				newRuleProps.semantic = semantic.insertSemantic(subRuleProps.semantic, insertedSemantic)
			} else {
				newRuleProps.semantic = insertedSemantic
			}
		} else if (subRuleProps.semantic) {
			newRuleProps.semanticIsRHS = subRuleProps.semanticIsRHS
			newRuleProps.semantic = subRuleProps.semantic
		} else if (parentRuleProps.semantic) {
			newRuleProps.semantic = parentRuleProps.semantic
		}

		if (subRuleProps.personNumber) {
			newRuleProps.personNumber = subRuleProps.personNumber
		}

		var subText = subRuleProps.text
		var parentText = parentRuleProps.text
		if (parentRuleProps.insertionIdx === 0) {
			if (subText) {
				var verbForm = parentRuleProps.verbForm
				if (verbForm && subText[verbForm]) {
					newRuleProps.text = parentText.concat(subText[verbForm])
				} else {
					if (verbForm) newRuleProps.verbForm = verbForm
					newRuleProps.text = parentText.concat(subText)
				}
			} else {
				newRuleProps.text = parentText
			}
		} else if (subRuleProps.insertionIdx === 0) {
			if (parentText) {
				newRuleProps.text = subText.concat(parentText)
			} else {
				newRuleProps.text = subText
			}
		} else {
			var parentGramCase = parentRuleProps.gramCase
			if (parentGramCase && subText[parentGramCase]) {
				newRuleProps.text = subText[parentGramCase]
			} else {
				if (subRuleProps.gramCase) newRuleProps.gramCase = subRuleProps.gramCase
				newRuleProps.text = parentText || subText
			}
		}
	}
}