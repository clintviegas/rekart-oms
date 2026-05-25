/* ── Shared config ──────────────────────────────────────────────── */
const STATUSES = ['Pending','Processing','Completed','Cancelled','Awaiting Parts'];
const STATUS_CLS = {
  'Pending':'s-Pending','Processing':'s-Processing','Completed':'s-Completed',
  'Cancelled':'s-Cancelled','Awaiting Parts':'s-AwaitingParts'
};
const SVC_EXTRAS = {
  Repair:    [{label:'Fault Description', key:'fault'}, {label:'Estimated Delivery', key:'delivery', type:'date'}, {label:'Technician', key:'tech', type:'select', opts:['Assign later','Bishal','Lena']}],
  'Trade-In':[{label:'Condition Grade (A/B/C/D)', key:'grade'}, {label:'Quote Given (AED)', key:'quote', type:'number'}],
  Insurance: [{label:'Coverage Type', key:'coverage'}, {label:'Policy Duration', key:'duration'}],
  Rent:      [{label:'Rental Period', key:'period'}, {label:'Return Date', key:'returnDate', type:'date'}],
  Recycle:   [{label:'Weight / Qty', key:'weight'}, {label:'Certificate Required?', key:'cert', type:'select', opts:['No','Yes']}]
};
const SVC_COND_LABEL = {
  Repair:'Repair Details', 'Trade-In':'Trade-In Details', Insurance:'Insurance Details',
  Rent:'Rental Details', Recycle:'Recycle Details'
};
const svcTabMap = {Buy:'buy',Sell:'sell',Repair:'repair','Trade-In':'tradein',Insurance:'ins',Rent:'rent',Recycle:'recycle'};
