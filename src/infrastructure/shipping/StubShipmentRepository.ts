import { IShipmentRepository } from '../../application/useCases/ManageShipping';

export class StubShipmentRepository implements IShipmentRepository {
  async save(_: any): Promise<void> {}

  async findById(_: any): Promise<any> {
    return null;
  }

  async findAll(): Promise<any[]> {
    return [];
  }

  async update(_: any): Promise<void> {}
}
