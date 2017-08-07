/**
 * The `DHeap` constructor.
 *
 * Creates a min heap data structure created using a d-ary tree. All nodes are less than or equal to each of its `d` children.
 *
 * To use a `d`-ary heap with a a shortest path graph algorithm, where `n` is the number of vertices in the graph and `m` is the number of edges, then `d = m/n` to balance the total times for these two types of operations against each other. Using this calculation with the parse forest graphs which `Parser` produces from this grammar, `d` almost always rounds to 2. Hence, `pfsearch` uses `BinaryHeap` (i.e., where `d` is 2) instead of `DHeap` to avoid accommodating for scarcely variable arity.
 *
 * @constructor
 * @param {number} arity The arity of the heap.
 */
function DHeap(arity) {
	this.arity = Math.floor(arity)
	this.content = []
	this.pushCount = 0
}

/**
 * Adds `node` to the heap.
 *
 * Performs an up-heap operation to resort the heap:
 * 1. Add `node` to the bottom level of the heap.
 * 2. If `node`'s parent's value is less than or equal to `node`'s value, stop.
 * 3. If not, swap `node` with its parent and return to the previous step.
 *
 * @memberOf DHeap
 * @param {Object} node The node to add to the heap.
 */
DHeap.prototype.push = function (node) {
	// Add the new node to the bottom of the heap (at the end of the array).
	var length = this.content.push(node)

	// Up-heap at the index of the new node.
	var nodeIndex = length - 1
	var nodeCost = node.minCost

	// Up-heap while the new node is not the root of the heap.
	while (nodeIndex > 0) {
		// Get the parent node.
		var parentIndex = Math.floor((nodeIndex - 1) / this.arity)
		var parent = this.content[parentIndex]

		// If the parent node's value is less than or equal to the new node's value, stop.
		if (parent.minCost <= nodeCost) {
			break
		}

		// Otherwise, swap the parent node with the new node and repeat the previous step.
		this.content[parentIndex] = node
		this.content[nodeIndex] = parent
		nodeIndex = parentIndex
	}

	// Profile the number of insertions.
	this.pushCount++
}

/**
 *
 * Extracts the node from the heap with the lowest value.
 *
 * Performs a down-heap operation to resort the heap:
 * 1. Replace the root of the heap with the last node on the last level.
 * 2. If the new root's value is less than or equal to the value of both of its children, stop.
 * 3. If not, swap the node with its child of smallest value and return to the previous step.
 *
 * @memberOf DHeap
 * @returns {Object} Returns the node with the lowest value.
 */
DHeap.prototype.pop = function () {
	// Get the root of the heap, which has the lowest value of all nodes.
	var rootNode = this.content[0]

	// Get the last node on the last level.
	var node = this.content.pop()
	var length = this.content.length

	// Down-heap if nodes remain.
	if (length > 0) {
		// Put the last node at the root of the heap.
		var nodeIndex = 0
		this.content[nodeIndex] = node
		var nodeCost = node.minCost

		while (true) {
			// The index of the child with the smallest value, if any.
			var swapIndex = null
			var minCost = undefined

			var level = this.arity * nodeIndex
			for (var childIndex = level + 1, endIdx = level + this.arity; childIndex <= endIdx; ++childIndex) {
				if (childIndex < length) {
					var newCost = this.content[childIndex].minCost

					// If the value of the child is less than the node's value, swap the two.
					if (newCost < (swapIndex === null ? nodeCost : minCost)) {
						swapIndex = childIndex
						minCost = newCost
					}
				} else {
					break
				}
			}

			// If the node's value is less than or equal to its children, stop.
			if (swapIndex === null) {
				break
			}

			// Otherwise, swap the node with its child of smallest value and repeat the previous step.
			this.content[nodeIndex] = this.content[swapIndex]
			this.content[swapIndex] = node
			nodeIndex = swapIndex
		}
	}

	return rootNode
}

// Export `DHeap`.
module.exports = DHeap