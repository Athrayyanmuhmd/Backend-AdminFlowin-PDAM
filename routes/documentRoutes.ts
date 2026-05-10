import express from 'express';
import { verifyAdmin } from '../middleware/adminAuth.js';
import { verifyTokenFromQuery } from '../middleware/auth.js';
import {
  viewDocument,
  investigateDocument,
  uploadForInvestigation,
} from '../controllers/documentController.js';

const router = express.Router();

/**
 * GET /documents/view?url=<cloudinaryUrl>&docType=<type>&ownerId=<id>&token=<jwt>
 *
 * Token bisa via header Authorization ATAU query param ?token=
 * (query param diperlukan untuk <iframe src="..."> yang tidak bisa set header)
 *
 * Feature flags:
 *   PROXY_DOCUMENT_ENABLED=false  → redirect ke Cloudinary langsung
 *   CANARY_DOCUMENT_ENABLED=false → proxy aktif, fingerprint nonaktif
 */
router.get('/view', verifyTokenFromQuery, viewDocument);

/**
 * POST /documents/investigate
 * Body: multipart/form-data { file: <pdf atau gambar yang dicurigai bocor> }
 * Hanya admin yang bisa mengakses endpoint investigasi ini.
 */
router.post('/investigate', verifyAdmin, uploadForInvestigation, investigateDocument);

export default router;
