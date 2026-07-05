import { StatusCodes } from "http-status-codes";
import CustomApiError from "./customApiError.js";

export class QuotaExceededError extends CustomApiError {
  constructor(
    public readonly resource: "images" | "video_seconds",
    public readonly used: number,
    public readonly limit: number,
  ) {
    super(
      `Maya quota exceeded: ${resource} (${used}/${limit} used)`,
      StatusCodes.TOO_MANY_REQUESTS,
    );
  }
}
