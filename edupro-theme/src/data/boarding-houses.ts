export interface BoardingHouse {
  id: string
  name: string
  gender: 'Boys' | 'Girls'
  houseMaster: string
  capacity: number
  feePerTermUSD: number
}

export const mockBoardingHouses: BoardingHouse[] = [
  { id: 'BH-01', name: 'Nehanda House', gender: 'Girls', houseMaster: 'Mrs. Zvarevashe', capacity: 120, feePerTermUSD: 180 },
  { id: 'BH-02', name: 'Chaminuka House', gender: 'Boys', houseMaster: 'Mr. Mutasa', capacity: 120, feePerTermUSD: 180 },
]

/** For O(1) lookups in list rows instead of a `.find()` per row (AUD-056). */
export const boardingHousesById = new Map(mockBoardingHouses.map((h) => [h.id, h]))

export interface DormitoryRoom {
  id: string
  boardingHouseId: string
  roomNumber: string
  capacity: number
  currentOccupancy: number
}

export const mockDormitoryRooms: DormitoryRoom[] = [
  { id: 'DR-01', boardingHouseId: 'BH-01', roomNumber: 'N-101', capacity: 6, currentOccupancy: 5 },
  { id: 'DR-02', boardingHouseId: 'BH-01', roomNumber: 'N-102', capacity: 6, currentOccupancy: 6 },
  { id: 'DR-03', boardingHouseId: 'BH-02', roomNumber: 'C-101', capacity: 6, currentOccupancy: 4 },
  { id: 'DR-04', boardingHouseId: 'BH-02', roomNumber: 'C-102', capacity: 6, currentOccupancy: 6 },
]
