import { Router, Request, Response } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'diary.json');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const router = Router();

router.get('/export', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      res.status(404).json({ success: false, message: '没有可导出的数据' });
      return;
    }

    const zip = new AdmZip();
    zip.addLocalFile(DB_PATH, '');

    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const file of files) {
        const filePath = path.join(UPLOADS_DIR, file);
        if (fs.statSync(filePath).isFile()) {
          zip.addLocalFile(filePath, 'uploads');
        }
      }
    }

    const zipBuffer = zip.toBuffer();
    const filename = `diary-export-${new Date().toISOString().slice(0, 10)}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(zipBuffer);
  } catch (error) {
    console.error('[Export] 导出失败:', error);
    res.status(500).json({ success: false, message: '导出失败' });
  }
});

router.post('/import', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: '请上传备份文件' });
      return;
    }

    const zip = new AdmZip(req.file.buffer);

    const dbEntry = zip.getEntry('diary.json');
    if (!dbEntry) {
      res.status(400).json({ success: false, message: '备份文件中缺少 diary.json' });
      return;
    }

    let backupDb: { entries: any[]; nextId: number };
    try {
      backupDb = JSON.parse(dbEntry.getData().toString('utf-8'));
    } catch {
      res.status(400).json({ success: false, message: 'diary.json 格式无效' });
      return;
    }

    let currentDb: { entries: any[]; nextId: number };
    if (fs.existsSync(DB_PATH)) {
      currentDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } else {
      currentDb = { entries: [], nextId: 1 };
    }

    const currentMap = new Map<number, any>();
    for (const entry of currentDb.entries) {
      currentMap.set(entry.id, entry);
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const backupEntry of backupDb.entries) {
      const existing = currentMap.get(backupEntry.id);
      if (!existing) {
        currentMap.set(backupEntry.id, backupEntry);
        added++;
      } else {
        const tBackup = new Date(backupEntry.updated_at || backupEntry.created_at).getTime();
        const tExisting = new Date(existing.updated_at || existing.created_at).getTime();
        if (tBackup > tExisting) {
          currentMap.set(backupEntry.id, backupEntry);
          updated++;
        } else if (tBackup < tExisting) {
          skipped++;
        } else {
          skipped++;
        }
      }
    }

    const merged = Array.from(currentMap.values());
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const maxId = merged.reduce((max, e) => Math.max(max, e.id), 0);
    const mergedDb = { entries: merged, nextId: Math.max(maxId + 1, backupDb.nextId, currentDb.nextId) };

    fs.writeFileSync(DB_PATH, JSON.stringify(mergedDb, null, 2), 'utf-8');

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const uploadEntries = zip.getEntries().filter(e => e.entryName.startsWith('uploads/') && !e.isDirectory);
    let uploadAdded = 0;
    let uploadUpdated = 0;
    let uploadSkipped = 0;
    for (const entry of uploadEntries) {
      const entryName = entry.entryName;
      if (entryName.includes('..') || entryName.startsWith('/') || /^[a-zA-Z]:\\/.test(entryName)) {
        console.warn('[Import] 跳过不安全的文件:', entryName);
        uploadSkipped++;
        continue;
      }

      const fileName = path.basename(entry.entryName);
      if (!fileName) continue;

      const destPath = path.join(UPLOADS_DIR, fileName);
      const backupTime = entry.header.time?.getTime() || 0;

      if (fs.existsSync(destPath)) {
        const localTime = fs.statSync(destPath).mtimeMs;
        if (backupTime > localTime) {
          fs.writeFileSync(destPath, entry.getData());
          uploadUpdated++;
        } else {
          uploadSkipped++;
        }
      } else {
        fs.writeFileSync(destPath, entry.getData());
        uploadAdded++;
      }
    }

    const { initDatabase } = require('./database');
    initDatabase();

    const parts: string[] = [];
    if (added > 0) parts.push(`新增 ${added} 篇`);
    if (updated > 0) parts.push(`更新 ${updated} 篇`);
    if (skipped > 0) parts.push(`跳过 ${skipped} 篇（本地版本更新）`);
    if (uploadAdded > 0) parts.push(`新增 ${uploadAdded} 个附件`);
    if (uploadUpdated > 0) parts.push(`更新 ${uploadUpdated} 个附件`);
    if (uploadSkipped > 0) parts.push(`跳过 ${uploadSkipped} 个附件（本地版本更新）`);
    if (parts.length === 0) parts.push('无变化');

    res.json({
      success: true,
      message: `导入完成：${parts.join('、')}`,
    });
  } catch (error) {
    console.error('[Import] 导入失败:', error);
    res.status(500).json({ success: false, message: '导入失败' });
  }
});

export default router;
