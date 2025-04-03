import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import * as util from 'util';
import * as child_process from 'child_process';
import fetch from 'node-fetch';

// Schema for the download and unzip operation
export const DownloadAndUnzipSchema = z.object({
  url: z.string().url({ message: "Please provide a valid URL" }),
  outputDir: z.string().default('/tmp'),
  filename: z.string().optional()
});

// Function to download a file from a URL and unzip it to the specified directory
export async function downloadAndUnzip(params: z.infer<typeof DownloadAndUnzipSchema>) {
  const { url, outputDir, filename } = params;
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate temp filename if not provided
  const tempFilename = filename || `github-logs.zip`;
  const tempFilePath = path.join(outputDir, tempFilename);
  
  try {
    // Download the file    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}, Message: ${await response.text()}`);
    }
    
    // Save the file to disk
    const fileStream = fs.createWriteStream(tempFilePath);
    const pipeline = util.promisify(stream.pipeline);
    
    if (!response.body) {
      throw new Error('Response body is null');
    }
    
    await pipeline(response.body, fileStream);
    
    // Use the output directory directly for extraction
    const extractDir = outputDir;
    
    // Use unzip command with overwrite flag
    const unzipProcess = child_process.spawnSync('unzip', ['-o', tempFilePath, '-d', extractDir]);
    
    if (unzipProcess.error) {
      throw new Error(`Error unzipping file: ${unzipProcess.error.message}`);
    }
    
    if (unzipProcess.status !== 0) {
      throw new Error(`Unzip process exited with code ${unzipProcess.status}: ${unzipProcess.stderr.toString()}`);
    }
    
    // Clean up the zip file
    fs.unlinkSync(tempFilePath);
    
    return {
      success: true,
      message: `File downloaded and unzipped successfully to ${extractDir}`,
      extractedDirectory: extractDir,
      files: fs.readdirSync(extractDir)
    };
  } catch (error) {
    // Clean up temp file if it exists
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    throw error;
  }
} 