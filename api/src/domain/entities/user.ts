export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  googleId: string;
  email: string;
  name: string | null;
}
