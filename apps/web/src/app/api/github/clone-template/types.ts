export interface CloneTemplateRequest {
  template: {
    owner: string;
    repo: string;
  };
  newRepo: {
    owner: string;
    name: string;
    description?: string;
    private: boolean;
  };
}

export interface GitHubTemplateResponse {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
}

export interface CloneTemplateResponse {
  success: boolean;
  repository: {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    html_url: string;
    default_branch: string;
  };
}
