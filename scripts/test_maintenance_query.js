const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const db = new DatabaseSync(path.join(__dirname, '../data/gtech.db'));

const query = `
  SELECT 
    wo.id as work_order_id,
    wo.os_number,
    wo.status,
    wo.initial_scope,
    wo.customer_complaint,
    wo.created_at,
    wo.km_entry,
    c.id as customer_id,
    c.name as customer_name,
    c.phone as customer_phone,
    v.id as vehicle_id,
    v.brand as vehicle_brand,
    v.model as vehicle_model,
    v.plate as vehicle_plate,
    v.year as vehicle_year,
    v.vehicle_key,
    q.total_amount as quote_total,
    (SELECT COUNT(*) FROM wo_replaced_parts rp WHERE rp.work_order_id = wo.id) as replaced_parts_count,
    (SELECT GROUP_CONCAT(rp.component_name || ' (' || rp.warranty_terms || ')', ' • ') FROM wo_replaced_parts rp WHERE rp.work_order_id = wo.id) as parts_summary,
    (SELECT COUNT(*) FROM wo_checklist_items ci WHERE ci.work_order_id = wo.id) as checklist_items_count
  FROM work_orders wo
  JOIN customers c ON wo.customer_id = c.id
  JOIN vehicles v ON wo.vehicle_id = v.id
  LEFT JOIN wo_quotes q ON q.work_order_id = wo.id AND q.version_number = (
    SELECT MAX(version_number) FROM wo_quotes WHERE work_order_id = wo.id
  )
  ORDER BY wo.created_at DESC
`;

const res = db.prepare(query).all();
console.log('Maintenances count:', res.length);
console.log('Sample:', res[0]);

