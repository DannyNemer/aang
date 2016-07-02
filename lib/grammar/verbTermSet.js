var util = require('../util/util')
var g = require('./grammar')
var NSymbol = require('./NSymbol')


/**
 * [personNumberVerbTenseSetSchema description]
 *
 * @typedef {Object} PersonNumberVerbFormsTenseSet
 * @property {string} oneSg
 * @property {string} threeSg
 * @property {string} pl
 * @property {string} [subjunctive]
 * @property {string} [participle]
 */
var personNumberVerbFormsTenseSetSchema = {
	oneSg: { type: String, required: true },
	threeSg: { type: String, required: true },
	pl: { type: String, required: true },
	subjunctive: String,
	participle: String,
}

/**
 * [simpleVerbTenseSetSchema description]
 *
 * @typedef {Object} SimpleVerbFormsTenseSet
 * @property {string} simple
 * @property {string} [subjunctive]
 * @property {string} [participle]
 */
var simpleVerbFormsTenseSetSchema = {
	simple: { type: String, required: true },
	subjunctive: String,
	participle: String,
}

/**
 * [verbFormsSet description]
 *
 * @typedef {Object} VerbFormsSet
 * @property {PersonNumberVerbFormsTenseSet} present [description]
 * @property {PersonNumberVerbFormsTenseSet|SimpleVerbFormsTenseSet} past [description]
 */
var verbFormsSetSchema = {
	present: {
		type: Object,
		schema: personNumberVerbFormsTenseSetSchema,
		required: true,
	},
	past: {
		type: Object,
		schema: [ personNumberVerbFormsTenseSetSchema, simpleVerbFormsTenseSetSchema ],
		required: true,
	},
}

/**
 * [verbSchema description]
 *
 * @memberOf verbSet
 * @param {Object} options The options object.
 * @param {string} [options.symbolName]
 * @param {number} [options.insertionCost]
 * @param {boolean} [options.noPastDisplayText]
 * @param {VerbFormsSet} options.verbFormsSet
 * @returns {NSymbol}
 */
var verbSchema = {
	symbolName: String,
	insertionCost: Number,
	noPastDisplayText: Boolean,
	verbFormsSet: { type: Object, schema: verbFormsSetSchema, required: true },
}

exports.newVerb = function (options) {
	if (util.illFormedOpts(verbSchema, options)) {
		throw new Error('Ill-formed verb')
	}
}

/**
 *
 *
 * @typedef {Object} TenseVerbSet
 * @property {NSymbol} noTense
 * @property {NSymbol} present
 * @property {NSymbol} past
 */

/**
 * [verbSchema description]
 *
 * @memberOf verbSet
 * @param {Object} options The options object.
 * @param {string} [options.symbolName]
 * @param {number} [options.insertionCost]
 * @param {VerbFormsSet} options.verbFormsSet
 * @returns {NSymbol}
 */
var tenseVerbSchema = {
	symbolName: String,
	insertionCost: Number,
	verbFormsSet: { type: Object, schema: verbFormsSetSchema, required: true },
}

exports.newTenseVerb = function (options) {
	if (util.illFormedOpts(tenseVerbSchema, options)) {
		throw new Error('Ill-formed tense verb')
	}
}