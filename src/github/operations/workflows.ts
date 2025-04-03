import { z } from "zod";
import { githubRequest, buildUrl } from "../common/utils.js";

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

// Schema definitions for the workflow API operations
export const ListWorkflowRunsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (username or organization). If not provided, uses GITHUB_OWNER env var."),
  repo: z.string().optional().describe("Repository name. If not provided, uses GITHUB_REPO env var."),
  branch: z.string().optional().describe("Filter by branch name"),
  actor: z.string().optional().describe("Filter by GitHub username who triggered the workflow"),
  event: z.string().optional().describe("Filter by event type that triggered the workflow (e.g., push, pull_request)"),
  status: WorkflowRunStatus.optional().describe("Filter by workflow status"),
  per_page: z.number().optional().describe("Results per page (max 100)"),
  page: z.number().optional().describe("Page number of the results")
});

export const GetWorkflowRunSchema = z.object({
  run_id: z.number().describe("The ID of the workflow run"),
  owner: z.string().optional().describe("Repository owner (username or organization). If not provided, uses GITHUB_OWNER env var."),
  repo: z.string().optional().describe("Repository name. If not provided, uses GITHUB_REPO env var.")
});

export const ListWorkflowRunsByWorkflowIdSchema = z.object({
  owner: z.string().optional().describe("Repository owner (username or organization). If not provided, uses GITHUB_OWNER env var."),
  repo: z.string().optional().describe("Repository name. If not provided, uses GITHUB_REPO env var."),
  workflow_id: z.string().optional().describe("The ID of the workflow or filename. If not provided, uses GITHUB_WORKFLOW_ID env var."),
  branch: z.string().optional().describe("Filter by branch name"),
  actor: z.string().optional().describe("Filter by GitHub username who triggered the workflow"),
  event: z.string().optional().describe("Filter by event type that triggered the workflow"),
  status: WorkflowRunStatus.optional().describe("Filter by workflow status"),
  created: z.string().optional().describe("Date range filter (e.g., '>=2020-01-01')"),
  exclude_pull_requests: z.boolean().optional().describe("If true, excludes workflow runs triggered by pull requests"),
  check_suite_id: z.number().optional().describe("Filter by check suite ID"),
  head_sha: z.string().optional().describe("Only returns workflow runs associated with this SHA"),
  per_page: z.number().optional().describe("Results per page (max 100)"),
  page: z.number().optional().describe("Page number of the results")
});

export const GetWorkflowRunLogsSchema = z.object({
  run_id: z.number().describe("The ID of the workflow run"),
  owner: z.string().optional().describe("Repository owner (username or organization). If not provided, uses GITHUB_OWNER env var."),
  repo: z.string().optional().describe("Repository name. If not provided, uses GITHUB_REPO env var.")
});

// Response schema definitions
export const WorkflowRunSchema = z.object({
  id: z.number(),
  name: z.string(),
  node_id: z.string(),
  head_branch: z.string(),
  head_sha: z.string(),
  run_number: z.number(),
  event: z.string(),
  status: WorkflowRunStatus,
  conclusion: z.string().nullable(),
  workflow_id: z.number(),
  check_suite_id: z.number(),
  check_suite_node_id: z.string(),
  url: z.string(),
  html_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  run_attempt: z.number(),
  run_started_at: z.string(),
  jobs_url: z.string(),
  logs_url: z.string(),
  check_suite_url: z.string(),
  artifacts_url: z.string(),
  cancel_url: z.string(),
  rerun_url: z.string(),
  workflow_url: z.string(),
  repository: z.object({
    id: z.number(),
    node_id: z.string(),
    name: z.string(),
    full_name: z.string(),
    owner: z.object({
      login: z.string(),
      id: z.number(),
      node_id: z.string(),
      avatar_url: z.string(),
      url: z.string(),
      html_url: z.string(),
      type: z.string(),
      site_admin: z.boolean()
    })
  })
});

export const WorkflowRunsResponseSchema = z.object({
  total_count: z.number(),
  workflow_runs: z.array(WorkflowRunSchema)
});

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
export async function listWorkflowRuns(
  options: z.infer<typeof ListWorkflowRunsSchema>
): Promise<z.infer<typeof WorkflowRunsResponseSchema>> {
  const { owner: providedOwner, repo: providedRepo, ...queryOptions } = options;
  const { owner, repo } = getOwnerAndRepo(providedOwner, providedRepo);
  
  const url = buildUrl(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs`,
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
export async function getWorkflowRun(
  options: z.infer<typeof GetWorkflowRunSchema>
): Promise<z.infer<typeof WorkflowRunSchema>> {
  const { run_id, owner: providedOwner, repo: providedRepo } = options;
  const { owner, repo } = getOwnerAndRepo(providedOwner, providedRepo);
  
  const response = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${run_id}`,
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
export async function listWorkflowRunsByWorkflowId(
  options: z.infer<typeof ListWorkflowRunsByWorkflowIdSchema>
): Promise<z.infer<typeof WorkflowRunsResponseSchema>> {
  const { owner: providedOwner, repo: providedRepo, workflow_id: providedWorkflowId, ...queryOptions } = options;
  const { owner, repo } = getOwnerAndRepo(providedOwner, providedRepo);
  
  // Get workflow_id from options or environment variable
  const workflow_id = providedWorkflowId || process.env.GITHUB_WORKFLOW_ID;
  
  if (!workflow_id) {
    throw new Error("Workflow ID is required. Either provide it as a parameter or set GITHUB_WORKFLOW_ID environment variable.");
  }
  
  const url = buildUrl(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/runs`,
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
export async function getWorkflowRunLogs(
  options: z.infer<typeof GetWorkflowRunLogsSchema>
): Promise<{ download_url: string }> {
  const { run_id, owner: providedOwner, repo: providedRepo } = options;
  const { owner, repo } = getOwnerAndRepo(providedOwner, providedRepo);
  
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${run_id}/logs`;
  
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