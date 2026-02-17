import { v2 as cloudinary } from "cloudinary";
import { configDotenv } from "dotenv";

configDotenv();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Update access mode for existing files in Cloudinary
 * This script updates all files in aqualink folder to be publicly accessible
 */
async function updateFilesAccessMode() {
  try {
    console.log("🔄 Starting to update file access modes...");

    // List all resources in aqualink folder
    const folders = ["aqualink/nik", "aqualink/kk", "aqualink/imb"];

    for (const folder of folders) {
      console.log(`\n📁 Processing folder: ${folder}`);

      // Get all resources in this folder
      const result = await cloudinary.api.resources({
        type: "upload",
        resource_type: "raw",
        prefix: folder,
        max_results: 500,
      });

      console.log(`   Found ${result.resources.length} files`);

      // Update each resource
      for (const resource of result.resources) {
        try {
          await cloudinary.uploader.explicit(resource.public_id, {
            type: "upload",
            resource_type: "raw",
            access_mode: "public",
          });
          console.log(`   ✅ Updated: ${resource.public_id}`);
        } catch (error) {
          console.error(
            `   ❌ Failed to update ${resource.public_id}:`,
            error.message
          );
        }
      }
    }

    console.log("\n✅ All files have been updated!");
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// Run the script
updateFilesAccessMode();
