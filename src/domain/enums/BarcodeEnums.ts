export enum BarcodeSymbology {
  UPC_A = 'upc_a',
  UPC_E = 'upc_e',
  EAN_13 = 'ean_13',
  EAN_8 = 'ean_8',
  CODE_128 = 'code_128',
  QR = 'qr',
  ITF_14 = 'itf_14',
  GS1_128 = 'gs1_128',
}

export const BarcodeSymbologyLabels: Record<BarcodeSymbology, string> = {
  [BarcodeSymbology.UPC_A]: 'UPC-A',
  [BarcodeSymbology.UPC_E]: 'UPC-E',
  [BarcodeSymbology.EAN_13]: 'EAN-13',
  [BarcodeSymbology.EAN_8]: 'EAN-8',
  [BarcodeSymbology.CODE_128]: 'Code 128',
  [BarcodeSymbology.QR]: 'QR Code',
  [BarcodeSymbology.ITF_14]: 'ITF-14',
  [BarcodeSymbology.GS1_128]: 'GS1-128',
};

export enum BarcodeSource {
  Supplier = 'supplier',
  Internal = 'internal',
  GS1 = 'gs1',
}
