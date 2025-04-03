import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Schema for the log analysis operation
export const AnalyzeBazelLogsSchema = z.object({
  extractedDir: z.string({
    description: "The directory containing the extracted log files"
  }),
  bazelLogsFolderName: z.string().default("Bazel Build and Test")
});

export type LogAnalysisResult = {
  success: boolean;
  errorSummary: string;
  errorDetails: string;
  sourceFile?: string;
  relevantLogContent?: string;
};

/**
 * Analyzes Bazel build and test logs to find errors
 * Prioritizes:
 * 1. "Get errors during workflow run.txt" - Contains summarized errors
 * 2. "View Failed Test Logs.txt" - Contains test failure details
 * 3. "Build Incremental.txt" - Contains build process logs
 */
export async function analyzeBazelLogs(params: z.infer<typeof AnalyzeBazelLogsSchema>): Promise<LogAnalysisResult> {
  const { extractedDir, bazelLogsFolderName } = params;
  
  const bazelLogsPath = path.join(extractedDir, bazelLogsFolderName);
  
  // Check if Bazel logs folder exists
  if (!fs.existsSync(bazelLogsPath)) {
    return {
      success: false,
      errorSummary: "Bazel logs folder not found",
      errorDetails: `Could not find '${bazelLogsFolderName}' folder in the extracted directory '${bazelLogsPath}'`
    };
  }
  
  const files = fs.readdirSync(bazelLogsPath);
  
  // Priority 1: Look for summarized errors file
  const errorSummaryFile = files.find((file: string) => 
    file.toLowerCase().includes("get errors during workflow run.txt"));
  
  if (errorSummaryFile) {
    const filePath = path.join(bazelLogsPath, errorSummaryFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    if (content.trim().length > 0) {
      return {
        success: false,
        errorSummary: "Workflow run errors found",
        errorDetails: extractErrorDetails(content),
        sourceFile: errorSummaryFile,
        relevantLogContent: content
      };
    }
  }
  
  // Priority 2: Look for failed test logs
  const failedTestFile = files.find((file: string) => 
    file.toLowerCase().includes("view failed test logs.txt"));
  
  if (failedTestFile) {
    const filePath = path.join(bazelLogsPath, failedTestFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    if (content.trim().length > 0) {
      return {
        success: false,
        errorSummary: "Test failures detected",
        errorDetails: extractErrorDetails(content),
        sourceFile: failedTestFile,
        relevantLogContent: content
      };
    }
  }
  
  // Priority 3: Look for build logs
  const buildFile = files.find((file: string) => 
    file.toLowerCase().includes("build incremental.txt"));
  
  if (buildFile) {
    const filePath = path.join(bazelLogsPath, buildFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if build log contains errors
    if (containsErrors(content)) {
      return {
        success: false,
        errorSummary: "Build errors detected",
        errorDetails: extractErrorDetails(content),
        sourceFile: buildFile,
        relevantLogContent: extractRelevantContent(content)
      };
    } else {
      return {
        success: true,
        errorSummary: "No errors found in build log",
        errorDetails: "Build appears successful",
        sourceFile: buildFile
      };
    }
  }
  
  // No relevant log files found
  return {
    success: false,
    errorSummary: "No relevant log files found",
    errorDetails: `Could not find expected log files in '${bazelLogsFolderName}' folder`
  };
}

/**
 * Extracts the most relevant error details from the log content
 */
function extractErrorDetails(content: string): string {
  // Look for common error patterns
  const errorPatterns = [
    /ERROR:|FAILED:|Exception:|error:|failed:|BUILD FAILED/gi
  ];
  
  for (const pattern of errorPatterns) {
    const match = content.match(pattern);
    if (match) {
      // Find the error line and include surrounding context
      const lines = content.split('\n');
      const errorLineIndex = lines.findIndex(line => line.match(pattern));
      
      if (errorLineIndex >= 0) {
        // Include up to 10 lines after the error
        const contextLines = lines.slice(
          errorLineIndex, 
          Math.min(errorLineIndex + 10, lines.length)
        );
        return contextLines.join('\n');
      }
    }
  }
  
  // If no clear error pattern, return the first 500 characters
  return content.substring(0, 500) + (content.length > 500 ? '...' : '');
}

/**
 * Checks if the content contains error indicators
 */
function containsErrors(content: string): boolean {
  const errorIndicators = [
    'ERROR:',
    'FAILED:',
    'BUILD FAILED',
    'Exception:',
    'error:',
    'failed:',
    'Execution failed'
  ];
  
  return errorIndicators.some(indicator => content.includes(indicator));
}

/**
 * Extracts the most relevant content from a log file
 */
function extractRelevantContent(content: string): string {
  // If the content is short enough, return it all
  if (content.length <= 2000) {
    return content;
  }
  
  // Otherwise, try to find and return the most relevant sections
  const lines = content.split('\n');
  
  // Find lines containing error indicators
  const errorLines = lines.map((line, index) => ({ line, index }))
    .filter(({ line }) => containsErrors(line));
  
  if (errorLines.length > 0) {
    // Get the first error and its context
    const firstErrorIndex = errorLines[0].index;
    const startIndex = Math.max(0, firstErrorIndex - 5);
    const endIndex = Math.min(lines.length, firstErrorIndex + 15);
    
    return lines.slice(startIndex, endIndex).join('\n');
  }
  
  // If no errors found, return the first and last parts of the log
  const head = lines.slice(0, 10).join('\n');
  const tail = lines.slice(Math.max(0, lines.length - 20)).join('\n');
  
  return `${head}\n\n...\n\n${tail}`;
} 