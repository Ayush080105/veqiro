import CustomApiError from "./customApiError.js";
import { StatusCodes } from "http-status-codes";

export class BadRequestError extends CustomApiError {
    constructor(message: string) {
        super(message, StatusCodes.BAD_REQUEST);
    }
}