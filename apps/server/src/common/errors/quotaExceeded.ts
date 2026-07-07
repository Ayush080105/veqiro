import { StatusCodes } from "http-status-codes";
import CustomApiError from "./customApiError.js";

export class QuotaExceededError extends CustomApiError {
  constructor(
    public readonly used: number,
    public readonly limit: number,
  ) {
    super(
      `Maya credits exceeded: ${used}/${limit} used`,
      StatusCodes.TOO_MANY_REQUESTS,
    );
  }
}
