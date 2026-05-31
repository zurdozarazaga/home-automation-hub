import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiErrorResponse } from '../interfaces/api-error-response.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const normalizedResponse = this.normalizeHttpExceptionResponse(
        exceptionResponse,
        statusCode,
        request.url,
      );

      response.status(statusCode).json(normalizedResponse);
      return;
    }

    const fallbackResponse: ApiErrorResponse = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: 'Internal Server Error',
      message: 'Unexpected error',
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(fallbackResponse);
  }

  private normalizeHttpExceptionResponse(
    exceptionResponse: string | object,
    statusCode: number,
    path: string,
  ): ApiErrorResponse {
    if (typeof exceptionResponse === 'string') {
      return {
        statusCode,
        timestamp: new Date().toISOString(),
        path,
        error: this.defaultErrorLabel(statusCode),
        message: exceptionResponse,
      };
    }

    const responseObject = exceptionResponse as {
      error?: string;
      message?: string | string[];
    };

    return {
      statusCode,
      timestamp: new Date().toISOString(),
      path,
      error: responseObject.error ?? this.defaultErrorLabel(statusCode),
      message: responseObject.message ?? this.defaultErrorLabel(statusCode),
    };
  }

  private defaultErrorLabel(statusCode: number): string {
    const labels: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.CONFLICT]: 'Conflict',
    };

    return labels[statusCode] ?? 'Error';
  }
}
