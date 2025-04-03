import { z } from "zod";
import { githubRequest, buildUrl } from "../common/utils.js";
import {
  GetWorkflowRunLogsSchema,
  GetWorkflowRunSchema,
  ListWorkflowRunsByWorkflowIdSchema,
  ListWorkflowRunsSchema,
  WorkflowRunSchema,
  WorkflowRunsResponseSchema
} from "./workflows.js";

// Define the workflow run status type
const WorkflowRunStatus = z.enum([
  'completed',
  'action_required',
  'cancelled',
  'failure',
  'neutral',
  'skipped',
  'stale',
  'success',
  'timed_out',
  'in_progress',
  'queued',
  'requested',
  'waiting',
  'pending'
]);

/**
 * Get repository owner and repo name, using environment variables as fallback
 * @param providedOwner Optional owner parameter
 * @param providedRepo Optional repo parameter
 * @returns Resolved owner and repo
 */
function getOwnerAndRepo(providedOwner?: string, providedRepo?: string) {
  const owner = providedOwner || process.env.GITHUB_OWNER;
  const repo = providedRepo || process.env.GITHUB_REPO;
  
  if (!owner) {
    throw new Error("Repository owner is required. Either provide it as a parameter or set GITHUB_OWNER environment variable.");
  }
  
  if (!repo) {
    throw new Error("Repository name is required. Either provide it as a parameter or set GITHUB_REPO environment variable.");
  }
  
  return { owner, repo };
}

/**
 * List workflow runs for a repository with optional filters
 * 
 * @param options Filter and pagination options with optional owner and repo
 * @returns List of workflow runs
 */
export async function listCiWorkflowRuns(
  options: z.infer<typeof ListWorkflowRunsSchema>
): Promise<z.infer<typeof WorkflowRunsResponseSchema>> {
  const { ...queryOptions } = options;
  
  const url = buildUrl(
    `https://api.github.com/repos/askscio/scio/actions/runs`,
    {
      branch: queryOptions.branch,
      actor: queryOptions.actor,
      event: queryOptions.event,
      status: queryOptions.status,
      per_page: queryOptions.per_page?.toString(),
      page: queryOptions.page?.toString()
    }
  );

  const response = await githubRequest(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  return WorkflowRunsResponseSchema.parse(response);
}

/**
 * Get details about a specific workflow run
 * 
 * @param options Options containing run_id with optional owner and repo
 * @returns Detailed information about the workflow run
 */
export async function getCiWorkflowRun(
  options: z.infer<typeof GetWorkflowRunSchema>
): Promise<z.infer<typeof WorkflowRunSchema>> {
  const { run_id } = options;
  
  const response = await githubRequest(
    `https://api.github.com/repos/askscio/scio/actions/runs/${run_id}`,
    {
      headers: {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  return WorkflowRunSchema.parse(response);
}

/**
 * List workflow runs for a specific workflow
 * 
 * @param options Filter and pagination options with optional owner, repo, and workflow_id
 * @returns List of workflow runs for the specified workflow
 */
export async function listCiWorkflowRunsForBranch(
  options: z.infer<typeof ListWorkflowRunsByWorkflowIdSchema>
): Promise<z.infer<typeof WorkflowRunsResponseSchema>> {
  const { ...queryOptions } = options;

  const url = buildUrl(
    `https://api.github.com/repos/askscio/scio/actions/workflows/bazel_pr_runner.yml/runs`,
    {
      branch: queryOptions.branch,
      actor: queryOptions.actor,
      event: queryOptions.event,
      status: queryOptions.status,
      created: queryOptions.created,
      exclude_pull_requests: queryOptions.exclude_pull_requests?.toString(),
      check_suite_id: queryOptions.check_suite_id?.toString(),
      head_sha: queryOptions.head_sha,
      per_page: queryOptions.per_page?.toString(),
      page: queryOptions.page?.toString()
    }
  );

  const response = await githubRequest(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  return WorkflowRunsResponseSchema.parse(response);
}

/**
 * Get the download URL for workflow run logs
 * 
 * @param options Options containing run_id with optional owner and repo
 * @returns The URL to download the logs (valid for 1 minute)
 */
export async function getCiWorkflowRunLogs(
  options: z.infer<typeof GetWorkflowRunLogsSchema>
): Promise<{ download_url: string }> {
  const { run_id } = options;
  
  const url = `https://api.github.com/repos/askscio/scio/actions/runs/${run_id}/logs`;
  
  // We need to make a raw fetch request to get the Location header
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": `modelcontextprotocol/servers/github`
  };

  if (process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`;
  }

  // Make request but don't follow redirects
  const response = await fetch(url, {
    method: "GET",
    headers,
    redirect: "manual"
  });
  
  if (response.status !== 302) {
    // If we don't get a redirect, handle the error
    const errorBody = await response.text();
    throw new Error(`Failed to get logs download URL: ${response.status} ${response.statusText}\n${errorBody}`);
  }
  
  const downloadUrl = response.headers.get("location");
  
  if (!downloadUrl) {
    throw new Error("No download URL found in the response headers");
  }
  
  return { download_url: downloadUrl };
} 