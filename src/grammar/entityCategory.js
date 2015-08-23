var util = require('../util')
var g = require('./grammar')


exports.entities = {}
// A mapping of entity category names to creation lines; used for error reporting
exports.creationLines = {}
// Counter for entity ids
var entityCount = 0


/**
 * Create a new entity category containing the passed entities.
 *
 * @param {Object} opts The options object containing the entities.
 * @return {String} The terminal symbol for the category.
 */

// Schema for an entity category
var entityCategoryOptsSchema = {
	// Unique name for etity category
	name: String,
	// The entities
	entities: { type: Array, arrayType: String },
}

exports.new = function (opts) {
	if (util.illFormedOpts(entityCategoryOptsSchema, opts)) {
		throw 'ill-formed entity category'
	}

	var categoryName = '{' + opts.name.toLowerCase() + '}'

	if (exports.creationLines.hasOwnProperty(categoryName)) {
		util.printErrWithLine('Duplicate entity category:', categoryName)
		throw 'duplicate entity category'
	}

	// Save calling line for error reporting
	exports.creationLines[categoryName] = util.getLine()

	var newEntities = opts.entities
	newEntitiesLen = newEntities.length
	newEntities.forEach(function (entity, i) {
		var entityKey = entity.toLowerCase()

		// Check for duplicate entities within this category
		for (var j = i + 1; j < newEntitiesLen; ++j) {
			var otherEntity = newEntities[j]
			if (entityKey === otherEntity) {
				util.printErrWithLine('Duplicate entity:', categoryName, '->', i + ': ' + entity + ',', j + ': ' + otherEntity)
				throw 'duplicate entity'
			}
		}

		var entityInstances = (exports.entities[entityKey] || (exports.entities[entityKey] = []))
		entityInstances.push({
			// Unmodified display text
			// Add text to each instance of the entity in a difference category in case capitalization differs
			text: entity,
			category: categoryName,
			// Save id as String for semantic arguments ordering
			id: String(entityCount++),
		})
	})

	// To be used as a terminal symbol
	return categoryName
}