export class PipelineError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "PipelineError";
    this.statusCode = statusCode;
  }
}
