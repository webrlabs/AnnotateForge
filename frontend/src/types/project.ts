export enum MemberRole {
  VIEWER = 'viewer',
  EDITOR = 'editor',
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  classes: string[];
  owner_id?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  image_count: number;
  thumbnails: string[];
  // Permission info for current user
  can_edit: boolean;
  can_manage_members: boolean;
  member_count: number;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  classes?: string[];
  is_public?: boolean;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  classes?: string[];
  is_public?: boolean;
}

export interface ProjectMember {
  id: string;
  user_id: string;
  username: string;
  email: string;
  role: MemberRole;
  created_at: string;
}

export interface ProjectMemberCreate {
  user_id?: string;
  email?: string;
  role: MemberRole;
}

export interface ProjectMemberUpdate {
  role: MemberRole;
}
