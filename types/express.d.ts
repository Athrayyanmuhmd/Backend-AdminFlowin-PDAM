import { IAdminAccountDocument } from '../models/AdminAccount.js';
import { ITechnicianDocument } from '../models/Technician.js';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      admin?: IAdminAccountDocument;
      technician?: ITechnicianDocument | any;
      userId?: any;
      technicianId?: string;
      userEmail?: string;
      userRole?: 'admin' | 'technician' | 'user';
    }
  }
}
