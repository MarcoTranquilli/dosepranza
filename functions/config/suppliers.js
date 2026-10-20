/**
 * @typedef {Object} Supplier
 * @property {string} id
 * @property {string} displayName
 * @property {string} fromHeader
 * @property {string} cutoffTimeRome
 * @property {number} reminderMinutesBeforeCutoff
 * @property {{type:'GROUP_THRESHOLD'|'DIRECT_CONFIRMATION', minTotalCents:number}} rules
 */
/** @type {Readonly<Record<string, Supplier>>} */
const suppliers = {
  russo: {
    id:'russo', displayName:'Alimentari Russo',
    fromHeader:'Alimentari Russo <marco.tranquilli@dos.design>',
    cutoffTimeRome:'10:30', reminderMinutesBeforeCutoff:25,
    rules:{type:'GROUP_THRESHOLD', minTotalCents:2000}
  },
  pagnottella: {
    id:'pagnottella', displayName:'Pagnottella Gourmet',
    fromHeader:'Pagnottella Gourmet <marco.tranquilli@dos.design>',
    cutoffTimeRome:'11:00', reminderMinutesBeforeCutoff:25,
    rules:{type:'DIRECT_CONFIRMATION', minTotalCents:0}
  }
};
for (const supplier of Object.values(suppliers)) {
  Object.freeze(supplier.rules);
  Object.freeze(supplier);
}
module.exports = Object.freeze(suppliers);
