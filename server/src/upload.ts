import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import type { ApiResponse } from './types';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const IMAGE_MAGIC_BYTES: Record<string, number[]> = {
  JPEG: [0xFF, 0xD8, 0xFF],
  PNG: [0x89, 0x50, 0x4E, 0x47],
  GIF: [0x47, 0x49, 0x46],
  WebP: [0x52, 0x49, 0x46, 0x46],
};

function validateExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

function validateImageContent(filePath: string): boolean {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(8);
  fs.readSync(fd, buffer, 0, 8, 0);
  fs.closeSync(fd);

  const entries = Object.values(IMAGE_MAGIC_BYTES);
  return entries.some((magic) => buffer.slice(0, magic.length).equals(Buffer.from(magic)));
}

function validateOrigin(req: Request, res: Response, next: () => void): void {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const source = origin || referer;

  if (!source) {
    next();
    return;
  }

  const host = req.headers.host || '';

  for (const allowed of ['http://localhost', 'http://127.0.0.1', 'https://localhost', 'https://127.0.0.1']) {
    if (source.startsWith(allowed)) {
      next();
      return;
    }
  }

  if (host && source.includes(host)) {
    next();
    return;
  }

  const response: ApiResponse = { success: false, message: '请求来源不被允许' };
  res.status(403).json(response);
}

const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 30,
  message: { success: false, message: '上传过于频繁，请稍后再试' },
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'image/svg+xml') {
    cb(new Error('不支持上传 SVG 文件'));
    return;
  }
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只支持上传图片文件'));
  }
};

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/upload', uploadLimiter, validateOrigin, (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const response: ApiResponse = { success: false, message: '文件太大，最大支持 5MB' };
          res.status(413).json(response);
          return;
        }
      }
      const response: ApiResponse = { success: false, message: err.message || '文件上传失败' };
      res.status(400).json(response);
      return;
    }

    if (!req.file) {
      const response: ApiResponse = { success: false, message: '请选择要上传的文件' };
      res.status(400).json(response);
      return;
    }

    const filePath = req.file.path;

    const maxSizeMB = parseInt(req.headers['x-upload-max-size'] as string, 10);
    if (maxSizeMB > 0 && req.file.size > maxSizeMB * 1024 * 1024) {
      fs.unlinkSync(filePath);
      const response: ApiResponse = { success: false, message: `文件太大，最大支持 ${maxSizeMB}MB` };
      res.status(413).json(response);
      return;
    }

    if (!validateExtension(req.file.filename)) {
      fs.unlinkSync(filePath);
      const response: ApiResponse = { success: false, message: '不支持的图片格式' };
      res.status(400).json(response);
      return;
    }

    if (!validateImageContent(filePath)) {
      fs.unlinkSync(filePath);
      const response: ApiResponse = { success: false, message: '文件内容不是有效的图片格式' };
      res.status(400).json(response);
      return;
    }

    try {
      const metadata = await sharp(filePath).metadata();
      if ((metadata.width && metadata.width > 4096) || (metadata.height && metadata.height > 4096)) {
        fs.unlinkSync(filePath);
        const response: ApiResponse = { success: false, message: '图片尺寸超过限制（最大 4096×4096）' };
        res.status(400).json(response);
        return;
      }

      const ext = path.extname(req.file.filename).toLowerCase();
      const tempPath = filePath + '.tmp';

      const sharpInstance = sharp(filePath);
      if (ext === '.jpg' || ext === '.jpeg') {
        await sharpInstance.jpeg().toFile(tempPath);
      } else if (ext === '.png') {
        await sharpInstance.png().toFile(tempPath);
      } else if (ext === '.gif') {
        await sharpInstance.gif().toFile(tempPath);
      } else if (ext === '.webp') {
        await sharpInstance.webp().toFile(tempPath);
      } else {
        await sharpInstance.toFile(tempPath);
      }

      fs.copyFileSync(tempPath, filePath);
      fs.unlinkSync(tempPath);
    } catch {
      try { fs.unlinkSync(filePath); } catch { /* empty */ }
      const response: ApiResponse = { success: false, message: '图片处理失败，文件可能已损坏' };
      res.status(400).json(response);
      return;
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const response: ApiResponse<{ url: string; filename: string }> = {
      success: true,
      data: { url: fileUrl, filename: req.file.filename },
    };
    res.json(response);
  });
});

export default router;
