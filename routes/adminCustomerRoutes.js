import express from "express";
import { verifyAdmin } from "../middleware/adminAuth.js";
import { verifyAdminOrTechnician } from "../middleware/adminOrTechnicianAuth.js";
import {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerStats,
} from "../controllers/adminCustomerController.js";

const router = express.Router();

// Get customer statistics (accessible by both admin and technician)
router.get("/stats", verifyAdminOrTechnician, getCustomerStats);

// Apply verifyAdmin middleware to all other routes
router.use(verifyAdmin);

// Get all customers with filters
router.get("/", getAllCustomers);

// Get customer by ID
router.get("/:id", getCustomerById);

// Create new customer
router.post("/", createCustomer);

// Update customer
router.put("/:id", updateCustomer);

// Delete customer
router.delete("/:id", deleteCustomer);

export default router;
