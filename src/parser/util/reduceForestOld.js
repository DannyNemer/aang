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
				if (!sub.node) { // propagate pruning
					subs.splice(s, 1)
					subsLen--
					if (subsLen) continue

					delete parentSub.node
					return
				}

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
	// return

	// We are handling the same parentSub more than once, but unsure how
	// Could be there are duplicates because of different 'position' in query (diff nodeTab)
	if (subsLen === 1) {
		// if (sub.next || (parentSub.next && parentSub.next.node.subs !== subs)) return
		if (sub.next || (parentSub.next && parentSub.next.node.subs === subs)) return

		// if (parentSub.next && sub.next) return // <- goal. should be only thing stopping

		var parentRuleProps = parentSub.ruleProps

		// cannot move semantic up, because then can incorrectly get semantics in parentSub.next
		// we could create a LHS object and just push that
		// or could assign to grammar rules whether LHS/RHS
		if (parentSub.next && subRuleProps.semantic && !subRuleProps.semanticIsRHS) return

		// It is possible for these to work, if make new Array of insertion that went through each of below steps
		if (parentRuleProps.constructor === Array || subRuleProps.constructor	=== Array) return
		if (parentRuleProps.personNumber) return
		if (parentRuleProps.verbForm || subRuleProps.verbForm) return // BROKEN when allowed
		if (parentRuleProps.gramCase || subRuleProps.gramCase) return // BROKEN when allowed
		// It is possible for these to work if don't rquire conjugation
		if (parentRuleProps.insertionIdx === 1 || subRuleProps.insertionIdx === 1) return
		// if (parentRuleProps.insertionIdx === 0 && subRuleProps.insertionIdx === 0) return // Does not occur
		// if (parentRuleProps.insertedSemantic && subRuleProps.insertedSemantic) return // Does not occur


		parentSub.minCost = sub.minCost // might need to add if next
		var newRuleProps = parentSub.ruleProps = {
			cost: parentRuleProps.cost + subRuleProps.cost,
		}

		var insertedSemantic = parentRuleProps.insertedSemantic || subRuleProps.insertedSemantic
		if (insertedSemantic) {
			// there is next a parentSub.next with insertions
			newRuleProps.semanticIsRHS = true

			// BUT we are not checking about what is coming down the tree
			if (parentRuleProps.semantic) {
				newRuleProps.semantic = semantic.insertSemantic(parentRuleProps.semantic, insertedSemantic)
			} else if (subRuleProps.semantic) {
				// what if the sub is a RHS - never appears to be
				newRuleProps.semantic = semantic.insertSemantic(subRuleProps.semantic, insertedSemantic)
			} else {
				newRuleProps.semantic = insertedSemantic
			}
		} else if (subRuleProps.semantic) {
			if (parentRuleProps.semantic) {
				if (parentSub.next) { // need to make sure only visited if will go to next one
					newRuleProps.semanticRHS = subRuleProps.semantic
					newRuleProps.semantic = parentRuleProps.semantic
				} else if (parentRuleProps.semanticRHS) { // only if RHS will come from both branches
					var RHS = semantic.mergeRHS(parentRuleProps.semanticRHS, subRuleProps.semantic)
					if (RHS === -1) {
						delete parentSub.node
						// propagate deletion going up
						return
					}

					// util.mark()
					newRuleProps.semantic = semantic.insertSemantic(parentRuleProps.semantic, RHS)
					newRuleProps.semanticIsRHS = true
				} else {
					newRuleProps.semantic = semantic.insertSemantic(parentRuleProps.semantic, subRuleProps.semantic)
					newRuleProps.semanticIsRHS = true
				}
			} else {
				// if (subRuleProps.semanticRHS) {
				// 	// if previous in binary had a semantic
				// 	// it is possible there are other semantics down this branch, which will mess this up
				// 	newRuleProps.semantic = semantic.insertSemantic(subRuleProps.semantic, subRuleProps.semanticRHS)
				// 	newRuleProps.semanticIsRHS = true
				// } else {
					if (subRuleProps.semanticRHS) {
						util.mark()
						newRuleProps.semanticRHS = subRuleProps.semanticRHS
						newRuleProps.semantic = subRuleProps.semantic
					} else if (subRuleProps.semanticIsRHS) {
						if (parentSub.next) {
							newRuleProps.semanticRHS = subRuleProps.semantic
						} else {
							newRuleProps.semanticIsRHS = true
							newRuleProps.semantic = subRuleProps.semantic
						}
					} else {
						// never reached
						// if (parentSub.next) {
						// 	newRuleProps.semanticRHS = subRuleProps.semantic
						// }

						// Should we check if there is a parentSub.next, therwise this semantic is moving to parent and semantics in the right branch might incorrectly go inside it
						newRuleProps.semantic = subRuleProps.semantic
					}
				// }
			}
		} else if (parentRuleProps.semantic) {
			if (parentRuleProps.semanticRHS) {
				// if previous in binary had a semantic
				// it is possible there are other semantics down this branch, which will mess this up
				newRuleProps.semantic = semantic.insertSemantic(parentRuleProps.semantic, parentRuleProps.semanticRHS)
				newRuleProps.semanticIsRHS = true
			} else {
				if (parentRuleProps.semanticIsRHS) { // will never be both
					newRuleProps.semanticIsRHS = parentRuleProps.semanticIsRHS
				}

				newRuleProps.semantic = parentRuleProps.semantic
			}
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
			// inserted text can be an in array form even though no Object inside
			// change this in construction of edit rules
			// then add to check
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
				if (parentText && subText) {
					if (parentText.constructor === String && subText.constructor === String) {
						newRuleProps.text = parentText + ' ' + subText
					} else {
						newRuleProps.text = [].concat(parentText, subText) // FIX: after ensuring no arrays will be here
					}
				} else {
					newRuleProps.text = parentText || subText
				}
			}
		}

		// Occurs after simplication above so if a reduce() is called for a .next, it is appended to end
		if (parentSub.next) {
			if (sub.node.subs) {
				parentSub.node = sub.node // do not copy `sub`, which has ruleProps
			} else {
				parentSub.node = parentSub.next.node
				delete parentSub.next // delete next before reduct() so doesn't get skipped
				reduce(parentSub, parentSub.node.subs)
			}
		} else {
			parentSub.node = sub.node
		}
	}
}