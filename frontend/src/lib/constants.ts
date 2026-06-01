export const STATUSES = [
  'Pending',
  'Processing',
  'Packing',
  'Packed',
  'Completed',
  'Cancelled',
  'Awaiting Parts'
] as const;

export const SERVICES = ['Buy', 'Sell', 'Repair', 'Trade-In', 'Insurance', 'Rent', 'Recycle'] as const;

export const LOCATION_OPTIONS = ['Dubai', 'Sharjah WH'] as const;

export const PRODUCT_STATUSES = ['Available', 'Low Stock', 'Reserved', 'Unavailable'] as const;

export const ELECTRONICS_CATALOG: Record<string, string[]> = {
  Laptop: ['Apple', 'Dell', 'HP', 'Lenovo', 'Microsoft', 'Asus', 'Acer', 'MSI', 'Samsung', 'Razer'],
  Desktop: ['Apple', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Custom Build'],
  Monitor: ['Dell', 'HP', 'Lenovo', 'Samsung', 'LG', 'AOC', 'BenQ', 'Asus'],
  Tablet: ['Apple', 'Samsung', 'Lenovo', 'Microsoft', 'Huawei', 'Xiaomi'],
  Mobile: ['Apple', 'Samsung', 'Google', 'Huawei', 'Xiaomi', 'OnePlus', 'Oppo'],
  Accessory: ['Apple', 'Samsung', 'Dell', 'Logitech', 'Anker', 'Sony', 'Generic'],
  Component: ['Intel', 'AMD', 'NVIDIA', 'Kingston', 'Crucial', 'Samsung', 'Corsair'],
  Networking: ['TP-Link', 'D-Link', 'Ubiquiti', 'Cisco', 'Netgear'],
  Printer: ['HP', 'Canon', 'Epson', 'Brother'],
  Gaming: ['Sony', 'Microsoft', 'Nintendo', 'Razer', 'Logitech'],
  Camera: ['Canon', 'Nikon', 'Sony', 'GoPro', 'DJI'],
  Audio: ['Apple', 'Samsung', 'Sony', 'JBL', 'Bose', 'Beats'],
  TV: ['Samsung', 'LG', 'Sony', 'TCL', 'Hisense'],
  Other: ['Generic']
};

export const ELECTRONICS_CATEGORIES = Object.keys(ELECTRONICS_CATALOG);

export const PAYMENT_MODES = ['Cash', 'Card (POS)', 'Bank Transfer', 'Tabby / BNPL', 'Pending'] as const;

export type Service = (typeof SERVICES)[number];
export type OrderStatus = (typeof STATUSES)[number];

export const SVC_EXTRAS: Record<string, { label: string; key: string; type?: string; opts?: string[] }[]> = {
  Repair: [
    { label: 'Fault Description', key: 'fault' },
    { label: 'Estimated Delivery', key: 'delivery', type: 'date' },
    { label: 'Technician', key: 'tech', type: 'select', opts: ['Assign later', 'Bishal', 'Lena'] }
  ],
  'Trade-In': [
    { label: 'Refurbished Grade', key: 'grade', type: 'select', opts: ['Like New', 'Excellent', 'Good', 'Fair', 'Parts Only'] },
    { label: 'Quote Given (AED)', key: 'quote', type: 'number' }
  ],
  Insurance: [
    { label: 'Coverage Type', key: 'coverage' },
    { label: 'Policy Duration', key: 'duration' }
  ],
  Rent: [
    { label: 'Rental Period', key: 'period' },
    { label: 'Return Date', key: 'returnDate', type: 'date' }
  ],
  Recycle: [
    { label: 'Weight / Qty', key: 'weight' },
    { label: 'Certificate Required?', key: 'cert', type: 'select', opts: ['No', 'Yes'] }
  ]
};

export const SVC_COLORS: Record<string, string> = {
  Buy: 'bg-blue-50 text-brand border-blue-200',
  Sell: 'bg-orange-50 text-orange-700 border-orange-200',
  Repair: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Trade-In': 'bg-purple-50 text-purple-700 border-purple-200',
  Insurance: 'bg-red-50 text-red-700 border-red-200',
  Rent: 'bg-teal-50 text-teal-700 border-teal-200',
  Recycle: 'bg-lime-50 text-lime-700 border-lime-200'
};

export const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-800',
  Processing: 'bg-blue-50 text-brand',
  Packing: 'bg-sky-50 text-sky-700',
  Packed: 'bg-emerald-50 text-emerald-700',
  Completed: 'bg-green-50 text-green-700',
  Cancelled: 'bg-red-50 text-red-700',
  'Awaiting Parts': 'bg-purple-50 text-purple-700'
};

export function normalizeLocation(location = '') {
  return String(location).toLowerCase().includes('sharjah') ? 'Sharjah WH' : 'Dubai';
}
