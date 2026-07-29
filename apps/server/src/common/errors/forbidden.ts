import { StatusCodes } from "http-status-codes";
import CustomApiError from "./customApiError.js";

export class ForbiddenError extends CustomApiError {
  constructor(message: string) {
    super(message, StatusCodes.FORBIDDEN);
  }
}
