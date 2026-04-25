import multer from "multer";

const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB

export const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only application/pdf files are accepted"));
      return;
    }
    cb(null, true);
  },
});
