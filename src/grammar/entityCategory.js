var util = require('../util')

exports.entities = {}
// A list of all entity categories only to prevent duplicate category names
var entityCategories = []
// An incrementer for entity ids
var entityCount = 0

// Schema for an entity category
var entityCategoryOptsSchema = {
	name: String,
	entities: { type: Array, arrayType: String }
}

// Create a new entity category containing the passed entities
exports.newEntityCategory = function (opts) {
	if (util.illFormedOpts(entityCategoryOptsSchema, opts)) {
		throw 'ill-formed entity category'
	}

	var categoryName = '{' + opts.name + '}'

	if (entityCategories.hasOwnProperty(categoryName)) {
		util.printErrWithLine('Duplicate entity category', categoryName)
		throw 'duplicate entity category'
	}

	var newEntities = opts.entities
	newEntitiesLen = newEntities.length
	newEntities.forEach(function (entity, i) {
		var entityKey = entity.toLowerCase()

		// Check for duplicate entities within this category
		for (var j = i + 1; j < newEntitiesLen; ++j) {
			var otherEntity = newEntities[j]
			if (entityKey === otherEntity) {
				util.printErrWithLine('Duplicate entity', categoryName, '->', i + ': ' + entity + ',', j + ': ' + otherEntity)
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
			id: String(entityCount++)
		})
	})

	// To be used as a terminal symbol
	return categoryName
}