export interface Deployment {
  id: string;
  status: string;
  commit_message: string;
  branch: string;
  hash: string;
  env: string;
  created_at: string;
  author: string;
}
