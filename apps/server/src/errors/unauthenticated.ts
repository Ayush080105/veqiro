import CustomApiError from "./customApiError.js";
import { StatusCodes } from "http-status-codes";

export class UnauthenticatedError extends CustomApiError {
    constructor(message: string) {
        super(message, StatusCodes.UNAUTHORIZED);
    }
}