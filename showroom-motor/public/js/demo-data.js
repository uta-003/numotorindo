/* Data awal untuk Mode Demo (hosting statis tanpa backend).
   Password disimpan apa adanya HANYA untuk demo lokal di browser. */
window.DEMO_SEED = {
  users: [
    { id:'user-1', username:'admin',   pass:'admin123',   name:'Admin Showroom', role:'admin', active:true },
    { id:'user-2', username:'owner',   pass:'owner123',   name:'Budi Santoso (Pemilik)', role:'owner', active:true, komisiPersen:0, targetBulanan:0 },
    { id:'user-3', username:'sales',   pass:'sales123',   name:'Rina Amelia (Sales)', role:'sales', active:true, komisiPersen:2.5, targetBulanan:40000000 },
    { id:'user-4', username:'mekanik', pass:'mekanik123', name:'Joko Prasetyo (Mekanik)', role:'mekanik', active:true }
  ],
  customers: [
    { id:'cust-1', name:'Hendra Wijaya', phone:'0812-3344-5566', address:'Jl. Kenanga No. 21, Depok', notes:'', createdAt:'2026-06-28T06:30:00Z' },
    { id:'cust-2', name:'Agus Salim', phone:'0857-1122-3344', address:'Jl. Melati Raya No. 9, Bekasi', notes:'', createdAt:'2026-05-09T04:15:00Z' }
  ],
  seq: { unit:7, inv:3, cost:21, pay:4, customer:3, bastd:2, basdid:2, photo:1 }
};