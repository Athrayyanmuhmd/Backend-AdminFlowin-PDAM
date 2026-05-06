// @ts-nocheck — legacy REST controller, phase-out menuju GraphQL
import { v2 as cloudinary } from "cloudinary";
import axios from "axios";
import logger from "../utils/logger.js";

// Proxy endpoint to serve documents with authentication
export const getDocumentProxy = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: 400,
        pesan: "Document URL is required",
      });
    }

    // Validate URL is from Cloudinary
    if (!url.includes("cloudinary.com")) {
      return res.status(400).json({
        status: 400,
        pesan: "Invalid document URL",
      });
    }

    // Ensure URL has .pdf extension
    let processedUrl = url;
    if (!url.endsWith(".pdf")) {
      processedUrl = `${url}.pdf`;
    }

    // Fetch document from Cloudinary
    const response = await axios.get(processedUrl, {
      responseType: "stream",
      timeout: 30000,
    });

    // Set response headers
    res.setHeader(
      "Content-Type",
      response.headers["content-type"] || "application/pdf"
    );
    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"]);
    }
    res.setHeader("Content-Disposition", "inline");
    // private: hanya browser peminta yang boleh cache — tidak CDN/proxy publik
    // no-store: dokumen sensitif tidak boleh tersimpan di disk cache browser
    res.setHeader("Cache-Control", "private, no-store");
    // Hapus manual CORS header — biarkan CORS middleware server.ts yang mengatur
    // (middleware sudah dikonfigurasi hanya izinkan origin admin panel)

    // Stream the document to client
    response.data.pipe(res);
  } catch (error) {
    logger.error({ err: error }, "Error proxying document");

    if (error.response?.status === 401) {
      return res.status(401).json({
        status: 401,
        pesan: "Unauthorized access to document from Cloudinary",
      });
    }

    if (error.response?.status === 404) {
      return res.status(404).json({
        status: 404,
        pesan: "Document not found in Cloudinary",
      });
    }

    return res.status(500).json({
      status: 500,
      pesan: "Failed to retrieve document",
      error: error.message,
    });
  }
};
