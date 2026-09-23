import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

// Nest's built-in default filter already collapses unhandled exceptions to a
// generic 500, but that behavior isn't something this codebase controls or
// tests directly — it's an implicit default that a future Nest upgrade or
// config change could alter. This filter makes the "never leak an internal
// error message/stack to the client" guarantee explicit and independently
// testable: known HttpExceptions (validation errors, ForbiddenException,
// NotFoundException, etc.) pass their status/response through unchanged;
// anything else (a raw Prisma error, a bug) is logged server-side with full
// detail and reduced to an opaque 500 for the caller.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
