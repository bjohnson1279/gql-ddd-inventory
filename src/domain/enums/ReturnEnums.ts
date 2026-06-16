export enum RMAStatus {
  Requested = 'REQUESTED',
  Authorized = 'AUTHORIZED',
  Received = 'RECEIVED',
  Completed = 'COMPLETED',
  Rejected = 'REJECTED',
}

export enum RMADisposition {
  Restock = 'RESTOCK',
  Scrap = 'SCRAP',
  Quarantine = 'QUARANTINE',
}

export enum RMAItemStatus {
  Pending = 'PENDING',
  Received = 'RECEIVED',
  Rejected = 'REJECTED',
}

export enum QuarantineStatus {
  Quarantined = 'QUARANTINED',
  Restocked = 'RESTOCKED',
  Scrapped = 'SCRAPPED',
  Rtv = 'RTV',
}
