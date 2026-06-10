export interface JwtPayload {
  sub: string;
  username: string;
  roles?: string[];
  permissions?: string[];
}
