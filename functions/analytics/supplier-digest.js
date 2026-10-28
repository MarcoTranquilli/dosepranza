const {calculate}=require('./digest-calculator');
const {renderDigest}=require('./digest-email');
const suppliers=require('../config/suppliers');
// Filter before aggregation: no global diagnostics, user rankings or totals leak into the variant.
function supplierDigest(orders,drafts,window,supplierId='pagnottella',generatedAt=new Date()) {
  if(!Object.hasOwn(suppliers,supplierId)) throw new Error('digest_invalid_supplier');
  const report=calculate(orders.filter(o=>o.supplierId===supplierId),drafts.filter(d=>d.supplierId===supplierId),window);
  report.suppliers={[supplierId]:report.suppliers[supplierId]};
  return {report,mail:renderDigest(report,generatedAt,{supplierId})};
}
module.exports={supplierDigest};
