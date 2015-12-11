/**
 * The `BinaryHeap` constructor.
 *
 * Creates a min heap data structure created using a binary tree. All nodes are less than or equal to each of its two children.
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
	// Up-heap beginning at the last array index (i.e., the bottom of the heap).
	var nodeIndex = this.content.length
	var nodeCost = node.minCost

	// Up-heap while the new node index is not the root of the heap.
	while (nodeIndex > 0) {
		// Get the parent node.
		var parentIndex = nodeIndex - 1 >>> 1
		var parent = this.content[parentIndex]

		// If `node`'s parent's value is less than or equal to `node`'s value, stop.
		if (parent.minCost <= nodeCost) {
			break
		}

		// Set the parent node to the new node's previous index and repeat the previous step.
		this.content[nodeIndex] = parent
		nodeIndex = parentIndex
	}

	// Add the new node to the heap.
	this.content[nodeIndex] = node

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
		// Set the last node at the root of the heap.
		var nodeIndex = 0
		var nodeCost = node.minCost

		while (true) {
			// Compute the indexes of the child nodes.
			var child1Index = (nodeIndex << 1) + 1
			var child2Index = child1Index + 1

			// If the first child exists.
			if (child1Index < length) {
				var child1 = this.content[child1Index]
				var child1Cost = child1.minCost

				// If the first child's value is less than the node's value.
				if (child1Cost < nodeCost) {
					// If the second child exists.
					if (child2Index < length) {
						var child2 = this.content[child2Index]

						// If the second child's value is less than the node's value and the first child's value, swap its index with the node's.
						if (child2.minCost < child1Cost) {
							this.content[nodeIndex] = child2
							nodeIndex = child2Index
							continue
						}
					}

					// If the first child's value is less than the node's value and the second child's value, swap its index with the node's.
					this.content[nodeIndex] = child1
					nodeIndex = child1Index
					continue
				} else if (child2Index < length) {
					var child2 = this.content[child2Index]

					// If the second child's value is less than the node's value, swap its index with the node's.
					if (child2.minCost < nodeCost) {
						this.content[nodeIndex] = child2
						nodeIndex = child2Index
						continue
					}
				}
			}

			// Set the formerly last node in the heap at the index where its value is less than or equal to the value of both of its children, and stop.
			this.content[nodeIndex] = node
			break
		}
	}

	return rootNode
}

// Export `BinaryHeap`.
module.exports = BinaryHeap