import { z } from 'zod';
import * as path from 'path'
import { downloadAndUnzip, DownloadAndUnzipSchema } from './downloader.js';
import { analyzeBazelLogs, AnalyzeBazelLogsSchema, LogAnalysisResult } from './log-analyzer.js';
import * as fs from 'fs';

// Schema for the workflow logs operation
export const AnalyzeWorkflowLogsSchema = z.object({
  url: z.string().url({ message: "Please provide a valid URL to the workflow logs zip file" }),
  outputDir: z.string().default('/tmp/workflow_logs'),
  bazelLogsFolderName: z.string().default("Bazel build and test")
});

/**
 * Downloads and analyzes workflow logs from a ZIP file URL
 * 
 * This operation:
 * 1. Downloads and extracts the workflow logs ZIP file
 * 2. Analyzes the Bazel build and test logs
 * 3. Returns a summary of any errors found
 */
export async function analyzeWorkflowLogs(params: z.infer<typeof AnalyzeWorkflowLogsSchema>): Promise<LogAnalysisResult> {
  const { url, outputDir, bazelLogsFolderName } = params;

  try {
    // Create a unique directory for this analysis
    const analysisDir = path.join(outputDir, new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(analysisDir, { recursive: true });

    // Step 1: Download and extract logs
    const downloadResult = await downloadAndUnzip({
      url,
      outputDir: analysisDir
    });

    if (!downloadResult.success) {
      return {
        success: false,
        errorSummary: "Failed to download or extract logs",
        errorDetails: downloadResult.message || "Unknown error occurred during download"
      };
    }
    // Step 2: Analyze the logs
    const analysisResult = await analyzeBazelLogs({
      extractedDir: downloadResult.extractedDirectory,
      bazelLogsFolderName
    });

    // Step 3: Return the analysis results
    return analysisResult;
  } catch (error) {
    // Handle any unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      errorSummary: "Error analyzing workflow logs",
      errorDetails: errorMessage
    };
  }
}

// Example usage:
// async function main() {
//   const result = await analyzeWorkflowLogs({
//     url: "https://example.com/workflow-logs.zip",
//     outputDir: "/tmp/workflow-logs"
//   });
//
//   console.log("Analysis result:", result);
//   if (!result.success) {
//     console.error("Error details:", result.errorDetails);
//   }
// }
//
// main().catch(console.error); 