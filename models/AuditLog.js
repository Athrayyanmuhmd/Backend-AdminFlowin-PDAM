import mongoose from "mongoose";

/**
 * AuditLog — Mencatat setiap aksi penting yang dilakukan admin/teknisi
 * Fields sesuai kebutuhan audit trail sistem PDAM
 */
const AuditLogSchema = new mongoose.Schema(
  {
    // Siapa yang melakukan aksi
    idAdmin: {
      type: mongoose.Types.ObjectId,
      ref: "AdminAccount",
      default: null,
    },
    namaAdmin: {
      type: String,
      required: true,
    },
    // Jenis aksi (format: RESOURCE_ACTION)
    aksi: {
      type: String,
      required: true,
      // Contoh: ADMIN_CREATE, ADMIN_DELETE, ADMIN_UPDATE_PASSWORD,
      //         KONEKSI_ASSIGN_TEKNISI, KONEKSI_UNASSIGN_TEKNISI, KONEKSI_VERIFY,
      //         METERAN_CREATE, METERAN_DELETE,
      //         TAGIHAN_GENERATE, TAGIHAN_UPDATE_STATUS,
      //         TEKNISI_CREATE, TEKNISI_DELETE, WORK_ORDER_CREATE
    },
    // Resource yang terkena dampak
    resource: {
      type: String,
      required: true,
      // Contoh: Admin, KoneksiData, Meteran, Tagihan, Teknisi, WorkOrder
    },
    resourceId: {
      type: String,
      default: null,
    },
    // Data sebelum/sesudah perubahan (opsional, untuk audit mendalam)
    nilaiBefore: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    nilaiAfter: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Catatan tambahan
    catatan: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Index untuk query cepat berdasarkan waktu dan aksi
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ aksi: 1 });
AuditLogSchema.index({ idAdmin: 1 });

export default mongoose.model("AuditLog", AuditLogSchema);
