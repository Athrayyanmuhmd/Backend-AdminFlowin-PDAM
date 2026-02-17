import WorkOrder from "../models/WorkOrder.js";
import Technician from "../models/Technician.js";
import User from "../models/User.js";
import ConnectionData from "../models/ConnectionData.js";
import Meteran from "../models/Meteran.js";
import Notification from "../models/Notification.js";

/**
 * Create a new work order
 * POST /api/work-orders
 * Access: Admin only
 */
export const createWorkOrder = async (req, res) => {
  try {
    const {
      type,
      priority,
      customerId,
      connectionDataId,
      meteranId,
      scheduledDate,
      estimatedDuration,
      location,
      description,
      notes,
      adminNotes,
    } = req.body;

    // Validasi required fields
    if (!type || !scheduledDate || !location?.address || !description) {
      return res.status(400).json({
        success: false,
        pesan: "Field yang required: type, scheduledDate, location.address, description"
      });
    }

    // Generate work order number
    const workOrderNumber = await WorkOrder.generateWorkOrderNumber();

    // Get customer info if customerId provided
    let customerName = null;
    let customerPhone = null;
    if (customerId) {
      const customer = await User.findById(customerId);
      if (customer) {
        customerName = customer.namaLengkap;
        customerPhone = customer.noHP;
      }
    }

    // Create work order
    const workOrder = await WorkOrder.create({
      workOrderNumber,
      type,
      priority: priority || "medium",
      status: "pending",
      customerId: customerId || null,
      customerName,
      customerPhone,
      connectionDataId: connectionDataId || null,
      meteranId: meteranId || null,
      scheduledDate: new Date(scheduledDate),
      estimatedDuration: estimatedDuration || 120,
      location,
      description,
      notes: notes || null,
      adminNotes: adminNotes || null,
      assignedBy: req.admin._id, // dari middleware auth
      activityLog: [{
        action: "created",
        performedBy: {
          userId: req.admin._id,
          userType: "admin",
          userName: req.admin.namaLengkap || req.admin.email,
        },
        timestamp: new Date(),
        details: `Work order created: ${type}`,
      }]
    });

    res.status(201).json({
      success: true,
      pesan: "Work order berhasil dibuat",
      data: workOrder,
    });
  } catch (error) {
    console.error("Error creating work order:", error);
    res.status(500).json({
      success: false,
      pesan: "Gagal membuat work order",
      error: error.message,
    });
  }
};

/**
 * Get all work orders with filtering
 * GET /api/work-orders
 * Access: Admin, Technician
 */
export const getAllWorkOrders = async (req, res) => {
  try {
    const {
      status,
      type,
      priority,
      technicianId,
      customerId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = {};

    if (status) {
      if (status.includes(',')) {
        query.status = { $in: status.split(',') };
      } else {
        query.status = status;
      }
    }

    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (technicianId) query.assignedTechnicianId = technicianId;
    if (customerId) query.customerId = customerId;

    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate);
      if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { workOrderNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query
    const workOrders = await WorkOrder.find(query)
      .populate('assignedTechnicianId', 'namaLengkap email phone')
      .populate('customerId', 'namaLengkap email phone')
      .populate('connectionDataId')
      .populate('meteranId')
      .populate('assignedBy', 'namaLengkap email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await WorkOrder.countDocuments(query);

    res.status(200).json({
      success: true,
      data: workOrders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting work orders:", error);
    res.status(500).json({
      success: false,
      pesan: "Gagal mengambil data work order",
      error: error.message,
    });
  }
};

/**
 * Get work order by ID
 * GET /api/work-orders/:id
 * Access: Admin, Technician
 */
export const getWorkOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const workOrder = await WorkOrder.findById(id)
      .populate('assignedTechnicianId', 'namaLengkap email phone')
      .populate('customerId', 'namaLengkap email phone customerType')
      .populate('connectionDataId')
      .populate('meteranId')
      .populate('assignedBy', 'namaLengkap email')
      .populate('additionalTechnicianRequest.approvedBy', 'namaLengkap email')
      .populate('additionalTechnicianRequest.additionalTechnicianId', 'namaLengkap email phone');

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        pesan: "Work order tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      data: workOrder,
    });
  } catch (error) {
    console.error("Error getting work order:", error);
    res.status(500).json({
      success: false,
      pesan: "Gagal mengambil data work order",
      error: error.message,
    });
  }
};

/**
 * Assign technician to work order
 * PUT /api/work-orders/:id/assign
 * Access: Admin only
 */
export const assignTechnician = async (req, res) => {
  try {
    const { id } = req.params;
    const { technicianId } = req.body;

    if (!technicianId) {
      return res.status(400).json({
        success: false,
        pesan: "technicianId harus diisi",
      });
    }

    // Check if technician exists
    const technician = await Technician.findById(technicianId);
    if (!technician) {
      return res.status(404).json({
        success: false,
        pesan: "Teknisi tidak ditemukan",
      });
    }

    // Update work order
    const workOrder = await WorkOrder.findByIdAndUpdate(
      id,
      {
        assignedTechnicianId: technicianId,
        assignedAt: new Date(),
        status: "assigned",
        $push: {
          activityLog: {
            action: "assigned",
            performedBy: {
              userId: req.admin._id,
              userType: "admin",
              userName: req.admin.namaLengkap || req.admin.email,
            },
            timestamp: new Date(),
            details: `Assigned to technician: ${technician.namaLengkap}`,
          }
        }
      },
      { new: true }
    ).populate('assignedTechnicianId', 'namaLengkap email phone');

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        pesan: "Work order tidak ditemukan",
      });
    }

    // Create notification for technician
    await Notification.create({
      userId: technicianId,
      judul: "Work Order Baru",
      message: `Anda ditugaskan untuk ${workOrder.type} di ${workOrder.location.address}`,
      kategori: "Informasi",
      link: `/work-orders/${workOrder._id}`,
    });

    res.status(200).json({
      success: true,
      pesan: "Teknisi berhasil ditugaskan",
      data: workOrder,
    });
  } catch (error) {
    console.error("Error assigning technician:", error);
    res.status(500).json({
      success: false,
      pesan: "Gagal menugaskan teknisi",
      error: error.message,
    });
  }
};

/**
 * Update work order status
 * PUT /api/work-orders/:id/status
 * Access: Admin, Technician
 */
export const updateWorkOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        pesan: "Status harus diisi",
      });
    }

    const validStatuses = ["pending", "assigned", "in_progress", "on_hold", "completed", "cancelled", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status tidak valid. Pilihan: ${validStatuses.join(', ')}`,
      });
    }

    const updateData = {
      status,
      $push: {
        activityLog: {
          action: "status_updated",
          performedBy: {
            userId: req.admin?._id || req.technician?._id,
            userType: req.admin ? "admin" : "technician",
            userName: req.admin?.namaLengkap || req.technician?.namaLengkap || "Unknown",
          },
          timestamp: new Date(),
          details: `Status changed to: ${status}${notes ? ` - ${notes}` : ''}`,
        }
      }
    };

    // Get work order first to check timestamps
    let workOrder = await WorkOrder.findById(id);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        pesan: "Work order tidak ditemukan",
      });
    }

    // Set timestamps based on status
    if (status === "in_progress" && !workOrder.startedAt) {
      updateData.startedAt = new Date();
    } else if (status === "completed" && !workOrder.completedAt) {
      updateData.completedAt = new Date();
      // Calculate actual duration
      if (workOrder.startedAt) {
        const durationMs = new Date() - new Date(workOrder.startedAt);
        updateData.actualDuration = Math.round(durationMs / 60000); // convert to minutes
      }
    } else if (status === "cancelled") {
      updateData.cancelledAt = new Date();
      if (notes) {
        updateData.cancellationReason = notes;
      }
    } else if (status === "rejected") {
      if (notes) {
        updateData.rejectionReason = notes;
      }
    }

    workOrder = await WorkOrder.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    res.status(200).json({
      success: true,
      pesan: "Status work order berhasil diupdate",
      data: workOrder,
    });
  } catch (error) {
    console.error("Error updating work order status:", error);
    res.status(500).json({
      success: false,
      pesan: "Gagal mengupdate status work order",
      error: error.message,
    });
  }
};

/**
 * Update work order details
 * PUT /api/work-orders/:id
 * Access: Admin only
 */
export const updateWorkOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Fields that are allowed to be updated
    const allowedFields = [
      'type', 'priority', 'scheduledDate', 'estimatedDuration',
      'location', 'description', 'notes', 'adminNotes'
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    updateData.$push = {
      activityLog: {
        action: "updated",
        performedBy: {
          userId: req.admin._id,
          userType: "admin",
          userName: req.admin.namaLengkap || req.admin.email,
        },
        timestamp: new Date(),
        details: `Work order details updated`,
      }
    };

    const workOrder = await WorkOrder.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        pesan: "Work order tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      pesan: "Work order berhasil diupdate",
      data: workOrder,
    });
  } catch (error) {
    console.error("Error updating work order:", error);
    res.status(500).json({
      success: false,
      pesan: "Gagal mengupdate work order",
      error: error.message,
    });
  }
};

/**
 * Delete work order
 * DELETE /api/work-orders/:id
 * Access: Admin only
 */
export const deleteWorkOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const workOrder = await WorkOrder.findByIdAndDelete(id);

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        pesan: "Work order tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      pesan: "Work order berhasil dihapus",
    });
  } catch (error) {
    console.error("Error deleting work order:", error);
    res.status(500).json({
      success: false,
      pesan: "Gagal menghapus work order",
      error: error.message,
    });
  }
};

/**
 * Get work orders by technician
 * GET /api/work-orders/technician/:technicianId
 * Access: Admin, Technician (own data)
 */
export const getWorkOrdersByTechnician = async (req, res) => {
  try {
    const { technicianId } = req.params;
    const { status, startDate, endDate } = req.query;

    const query = { assignedTechnicianId: technicianId };

    if (status) {
      if (status.includes(',')) {
        query.status = { $in: status.split(',') };
      } else {
        query.status = status;
      }
    }

    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate);
      if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    const workOrders = await WorkOrder.find(query)
      .populate('customerId', 'namaLengkap phone')
      .populate('connectionDataId')
      .populate('meteranId')
      .sort({ scheduledDate: -1 });

    res.status(200).json({
      success: true,
      data: workOrders,
    });
  } catch (error) {
    console.error("Error getting technician work orders:", error);
    res.status(500).json({
      success: false,
      pesan: "Gagal mengambil data work order teknisi",
      error: error.message,
    });
  }
};

/**
 * Get work order statistics
 * GET /api/work-orders/stats
 * Access: Admin only
 */
export const getWorkOrderStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Total work orders
    const total = await WorkOrder.countDocuments(matchQuery);

    // Work orders by status
    const byStatus = await WorkOrder.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Work orders by type
    const byType = await WorkOrder.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      }
    ]);

    // Work orders by priority
    const byPriority = await WorkOrder.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 }
        }
      }
    ]);

    // Completion rate
    const completed = byStatus.find(s => s._id === 'completed')?.count || 0;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(2) : 0;

    // Average completion time (for completed WOs)
    const avgCompletionTime = await WorkOrder.aggregate([
      {
        $match: {
          ...matchQuery,
          status: 'completed',
          actualDuration: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: "$actualDuration" }
        }
      }
    ]);

    // Overdue work orders
    const overdueCount = await WorkOrder.countDocuments({
      ...matchQuery,
      status: { $nin: ['completed', 'cancelled'] },
      scheduledDate: { $lt: new Date() }
    });

    res.status(200).json({
      success: true,
      data: {
        totalWorkOrders: total,
        workOrdersByStatus: byStatus,
        workOrdersByType: byType,
        workOrdersByPriority: byPriority,
        completionRate: parseFloat(completionRate),
        averageCompletionTime: avgCompletionTime[0]?.avgDuration || 0,
        overdueWorkOrders: overdueCount,
      },
    });
  } catch (error) {
    console.error("Error getting work order stats:", error);
    res.status(500).json({
      success: false,
      pesan: "Gagal mengambil statistik work order",
      error: error.message,
    });
  }
};

export default {
  createWorkOrder,
  getAllWorkOrders,
  getWorkOrderById,
  assignTechnician,
  updateWorkOrderStatus,
  updateWorkOrder,
  deleteWorkOrder,
  getWorkOrdersByTechnician,
  getWorkOrderStats,
};
