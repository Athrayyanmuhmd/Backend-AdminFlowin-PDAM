import { v2 as cloudinary } from "cloudinary";
import axios from "axios";

// Proxy endpoint to serve documents with authentication
export const getDocumentProxy = async (req, res) => {
  try {
    const { url } = req.query;

    console.log("\n📄 Document proxy request");
    console.log("   Requested by user:", req.user?.id);
    console.log("   Original URL:", url);

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
      console.log("   Added .pdf extension to URL");
    }

    console.log("   Processed URL:", processedUrl);

    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{public_id}
    const urlParts = processedUrl.split("/");
    const resourceType = urlParts[4]; // Get resource type (raw or image)
    const uploadIndex = urlParts.indexOf("upload");
    const fileWithVersion = urlParts.slice(uploadIndex + 1).join("/"); // Get everything after 'upload/'
    const publicId = fileWithVersion.replace(/^v\d+\//, ""); // Remove version prefix
    const publicIdWithoutExt = publicId.replace(/\.[^/.]+$/, ""); // Remove extension if exists

    console.log("   Resource type from URL:", resourceType);
    console.log("   Extracted public_id:", publicIdWithoutExt);

    // Just proxy the original URL directly without modifying it
    // The Cloudinary SDK will handle authentication via API key
    console.log("🔄 Fetching document from Cloudinary...");

    // Fetch document from Cloudinary using the original URL
    // Add authentication headers if needed
    const response = await axios.get(processedUrl, {
      responseType: "stream",
      timeout: 30000,
      headers: {
        // Cloudinary will authenticate based on URL signature if it's a signed URL
        // Or we can use basic auth with API credentials
      },
    });

    console.log("✅ Streaming document to client");
    console.log("   Content-Type:", response.headers["content-type"]);

    // Set appropriate headers
    res.setHeader(
      "Content-Type",
      response.headers["content-type"] || "application/pdf"
    );
    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"]);
    }
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Stream the document to client
    response.data.pipe(res);
  } catch (error) {
    console.error("\n❌ Error proxying document");
    console.error("   Error:", error.message);

    if (error.response) {
      console.error("   Response status:", error.response.status);
    }

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
