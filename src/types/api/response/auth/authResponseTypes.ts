import type { User } from "@supabase/supabase-js";

type WithUser = User;

export type UserResponse = Omit<WithUser, never>;
export type LoginResponse = Omit<WithUser, never>;
export type SignupResponse = Omit<WithUser, never>;
