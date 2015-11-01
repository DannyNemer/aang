/**
 * The `BinaryHeap` constructor.
 *
 * Creates a min heap data structure created using a binary tree. All nodes are less than or equal to each of its children.
 *
 * @constructor
 */
function BinaryHeap() {
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
 * @memberOf BinaryHeap
 * @param {Object} node The node to add to the heap.
 */
BinaryHeap.prototype.push = function (node) {
	// Add the new node to the bottom of the heap (at the end of the array).
	var length = this.content.push(node)

	// Up-heap at the index of the new node.
	var nodeIndex = length - 1
	var nodeCost = node.minCost

	// Up-heap while the new node is not the root of the heap.
	while (nodeIndex > 0) {
		// Get the parent node.
		var parentIndex = Math.floor((nodeIndex + 1) / 2) - 1
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
 * Extracts the node from the heap with the lowest value.
 *
 * Performs a down-heap operation to resort the heap:
 * 1. Replace the root of the heap with the last node on the last level.
 * 2. If the new root's value is less than or equal to the value of both of its children, stop.
 * 3. If not, swap the node with its child of smallest value and return to the previous step.
 *
 * @memberOf BinaryHeap
 * @returns {Object} Returns the node with the lowest value.
 */
BinaryHeap.prototype.pop = function () {
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
			// Compute the indexes of the child nodes.
			var child2Index = (nodeIndex + 1) * 2
			var child1Index = child2Index - 1

			// The index of the child with the smallest value, if any.
			var swapIndex = null

			// If the first child exists (is inside the array).
			if (child1Index < length) {
				var child1Cost = this.content[child1Index].minCost

				// If the value of the child is less than the node's value, swap the two.
				if (child1Cost < nodeCost) {
					swapIndex = child1Index
				}
			}

			// If the second child exists (is inside the array).
			if (child2Index < length) {
				var child2Cost = this.content[child2Index].minCost

				// If the value of the child is less than the node's value and the other child's value, swap it with the node.
				if (child2Cost < (swapIndex === null ? nodeCost : child1Cost)) {
					swapIndex = child2Index
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

// Export `BinaryHeap`.
module.exports = BinaryHeap