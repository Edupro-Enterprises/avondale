export interface BusStop {
  id: string
  name: string
  pickupTime: string
  dropoffTime: string
}

export interface BusRoute {
  id: string
  name: string
  driverName: string
  driverPhone: string
  vehicleReg: string
  capacity: number
  feePerTermUSD: number
  stops: BusStop[]
}

export const mockBusRoutes: BusRoute[] = [
  {
    id: 'BR-01',
    name: 'Mbare — Glen View',
    driverName: 'Simbarashe Gwenzi',
    driverPhone: '+263 77 456 1122',
    vehicleReg: 'AFB 4471',
    capacity: 60,
    feePerTermUSD: 40,
    stops: [
      { id: 'STOP-01', name: 'Mbare Musika', pickupTime: '06:15', dropoffTime: '16:00' },
      { id: 'STOP-02', name: 'Glen View 1 Shops', pickupTime: '06:35', dropoffTime: '16:25' },
      { id: 'STOP-03', name: 'Glen View 3 Clinic', pickupTime: '06:45', dropoffTime: '16:35' },
    ],
  },
  {
    id: 'BR-02',
    name: 'Mbare — Highfield',
    driverName: 'Blessing Chirara',
    driverPhone: '+263 77 456 3344',
    vehicleReg: 'AFB 5502',
    capacity: 60,
    feePerTermUSD: 35,
    stops: [
      { id: 'STOP-04', name: 'Machipisa Shops', pickupTime: '06:20', dropoffTime: '16:05' },
      { id: 'STOP-05', name: 'Gazaland Market', pickupTime: '06:40', dropoffTime: '16:20' },
    ],
  },
]
