export interface ApiErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  error: string;
  message: string | string[];
}
