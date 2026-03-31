import CustomApiError from "../errors/customApiError.js";
import { StatusCodes } from "http-status-codes";
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
 const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.log(err);
    let customError = {
        // set default
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        msg: err.message || 'Something went wrong try again later',
      }
    
      if(err instanceof CustomApiError){
        customError.statusCode = err.statusCode;
        customError.msg = err.message;
      }
    if (err instanceof ZodError) {
        customError.msg = err.issues
          .map((item) => `${item.path.join('.')}: ${item.message}`)
          .join(', ')
        customError.statusCode = StatusCodes.BAD_REQUEST
      }
    return res.status(customError.statusCode).json({ message: customError.msg });
}
export default errorHandler;