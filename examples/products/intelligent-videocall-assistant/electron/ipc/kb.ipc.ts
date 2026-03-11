import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import { kbService } from '../services/kb-service';

export function registerKBIPC(): void {
    ipcMain.handle(
        IPC_CHANNELS.KB_UPLOAD,
        async (_event, { filePath, fileName }: { filePath: string; fileName: string }) => {
            console.log('[IPC:KB] Ingesting:', fileName);
            return kbService.ingest(filePath, fileName);
        }
    );

    ipcMain.handle(IPC_CHANNELS.KB_LIST, () => {
        return kbService.listDocuments();
    });

    ipcMain.handle(IPC_CHANNELS.KB_DELETE, (_event, id: string) => {
        kbService.deleteDocument(id);
        return { success: true };
    });
}
