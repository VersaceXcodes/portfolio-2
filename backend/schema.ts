import { z } from 'zod';

/*
  Comprehensive Zod schemas for all database tables:
  - users
  - roles
  - user_roles
  - categories
  - posts
  - comments

  For each table:
  - Entity schema (main data)
  - Create input schema
  - Update input schema
  - Query/search input schema
  - Response schemas (single and list)
  - Inferred types
*/

/* 1) users table */

export const userSchema = z.object({
  id: z.string(),
  username: z.string().min(1).max(50),
  email: z.string().email().max(255),
  password_hash: z.string(),
  full_name: z.string().max(100).nullable(),
  avatar_url: z.string().url().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
});

export const createUserInputSchema = z.object({
  username: z.string().min(1).max(50),
  email: z.string().email().max(255),
  password_hash: z.string(),
  full_name: z.string().max(100).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateUserInputSchema = z.object({
  id: z.string(),
  username: z.string().min(1).max(50).optional(),
  email: z.string().email().max(255).optional(),
  password_hash: z.string().optional(),
  full_name: z.string().max(100).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const searchUserInputSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['username', 'email', 'created_at', 'is_active', 'full_name']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const userResponseSchema = z.object({
  data: userSchema,
});

export const usersListResponseSchema = z.object({
  data: z.array(userSchema),
  total: z.number().int().positive().optional(),
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type SearchUserInput = z.infer<typeof searchUserInputSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type UsersListResponse = z.infer<typeof usersListResponseSchema>;

/* 2) roles table */

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const createRoleInputSchema = z.object({
  name: z.string().min(1).max(50),
});

export const updateRoleInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(50).optional(),
});

export const searchRoleInputSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'id']).default('name'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const roleResponseSchema = z.object({
  data: roleSchema,
});

export const rolesListResponseSchema = z.object({
  data: z.array(roleSchema),
  total: z.number().int().positive().optional(),
});

export type Role = z.infer<typeof roleSchema>;
export type CreateRoleInput = z.infer<typeof createRoleInputSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleInputSchema>;
export type SearchRoleInput = z.infer<typeof searchRoleInputSchema>;
export type RoleResponse = z.infer<typeof roleResponseSchema>;
export type RolesListResponse = z.infer<typeof rolesListResponseSchema>;

/* 3) user_roles join table */

export const userRoleSchema = z.object({
  user_id: z.string(),
  role_id: z.string(),
});

export const createUserRoleInputSchema = z.object({
  user_id: z.string(),
  role_id: z.string(),
});

export const updateUserRoleInputSchema = z.object({
  user_id: z.string(),
  role_id: z.string(),
});

export const searchUserRoleInputSchema = z.object({
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['user_id', 'role_id']).default('user_id'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const userRoleResponseSchema = z.object({
  data: userRoleSchema,
});

export const userRolesListResponseSchema = z.object({
  data: z.array(userRoleSchema),
  total: z.number().int().positive().optional(),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type CreateUserRoleInput = z.infer<typeof createUserRoleInputSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleInputSchema>;
export type SearchUserRoleInput = z.infer<typeof searchUserRoleInputSchema>;
export type UserRoleResponse = z.infer<typeof userRoleResponseSchema>;
export type UserRolesListResponse = z.infer<typeof userRolesListResponseSchema>;

/* 4) categories table */

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});

export const createCategoryInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
});

export const updateCategoryInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
});

export const searchCategoryInputSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'id']).default('name'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const categoryResponseSchema = z.object({
  data: categorySchema,
});

export const categoriesListResponseSchema = z.object({
  data: z.array(categorySchema),
  total: z.number().int().positive().optional(),
});

export type Category = z.infer<typeof categorySchema>;
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;
export type SearchCategoryInput = z.infer<typeof searchCategoryInputSchema>;
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;
export type CategoriesListResponse = z.infer<typeof categoriesListResponseSchema>;

/* 5) posts table */

export const postSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable(),
  category_id: z.string().nullable(),
  title: z.string().min(1),
  content: z.string().min(1),
  image_url: z.string().url().nullable(),
  published: z.boolean(),
  created_at: z.coerce.date(),
});

export const createPostInputSchema = z.object({
  user_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  image_url: z.string().url().nullable().optional(),
  published: z.boolean().optional().default(false),
});

export const updatePostInputSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  image_url: z.string().url().nullable().optional(),
  published: z.boolean().optional(),
});

export const searchPostInputSchema = z.object({
  query: z.string().optional(),
  user_id: z.string().optional(),
  category_id: z.string().optional(),
  published: z.boolean().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['title', 'created_at', 'published']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const postResponseSchema = z.object({
  data: postSchema,
});

export const postsListResponseSchema = z.object({
  data: z.array(postSchema),
  total: z.number().int().positive().optional(),
});

export type Post = z.infer<typeof postSchema>;
export type CreatePostInput = z.infer<typeof createPostInputSchema>;
export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;
export type SearchPostInput = z.infer<typeof searchPostInputSchema>;
export type PostResponse = z.infer<typeof postResponseSchema>;
export type PostsListResponse = z.infer<typeof postsListResponseSchema>;

/* 6) comments table */

export const commentSchema = z.object({
  id: z.string(),
  post_id: z.string(),
  user_id: z.string().nullable(),
  content: z.string().min(1),
  created_at: z.coerce.date(),
});

export const createCommentInputSchema = z.object({
  post_id: z.string(),
  user_id: z.string().nullable().optional(),
  content: z.string().min(1),
});

export const updateCommentInputSchema = z.object({
  id: z.string(),
  post_id: z.string(),
  user_id: z.string().nullable().optional(),
  content: z.string().min(1).optional(),
});

export const searchCommentInputSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['content', 'created_at', 'id', 'post_id', 'user_id']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const commentResponseSchema = z.object({
  data: commentSchema,
});

export const commentsListResponseSchema = z.object({
  data: z.array(commentSchema),
  total: z.number().int().positive().optional(),
});

export type Comment = z.infer<typeof commentSchema>;
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentInputSchema>;
export type SearchCommentInput = z.infer<typeof searchCommentInputSchema>;
export type CommentResponse = z.infer<typeof commentResponseSchema>;
export type CommentsListResponse = z.infer<typeof commentsListResponseSchema>;