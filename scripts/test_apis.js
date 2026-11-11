async function test() {
  const v = await fetch('http://localhost:3001/api/work-orders?view=vehicles').then(r => r.json());
  console.log('Vehicles view success:', v.success, 'Count:', v.count);
  if (v.vehicles && v.vehicles[0]) {
    console.log('Sample vehicle:', v.vehicles[0].plate, v.vehicles[0].brand, v.vehicles[0].model, '3D GLB:', v.vehicles[0].glb_file_name);
  }

  const c = await fetch('http://localhost:3001/api/work-orders?view=customers').then(r => r.json());
  console.log('Customers view success:', c.success, 'Count:', c.count);
  if (c.customers && c.customers[0]) {
    console.log('Sample customer:', c.customers[0].name, 'Phone:', c.customers[0].phone, 'Vehicles:', c.customers[0].vehicles_summary);
  }

  const m = await fetch('http://localhost:3001/api/work-orders?view=maintenances').then(r => r.json());
  console.log('Maintenances view success:', m.success, 'Count:', m.count);
  if (m.maintenances && m.maintenances[0]) {
    console.log('Sample maintenance:', m.maintenances[0].os_number, m.maintenances[0].vehicle_model, 'Status:', m.maintenances[0].status);
  }
}
test().catch(console.error);
