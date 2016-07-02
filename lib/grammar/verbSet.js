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
	present: { type: Object, required: true},
	past: { type: Object, required: true},
}