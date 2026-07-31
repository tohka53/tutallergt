import { Injectable } from '@angular/core';

/**
 * Almacenamiento de archivos binarios (tarjetas de circulación, imágenes, PDFs)
 * en IndexedDB para la demo.
 *
 * PRODUCCIÓN: implementar la misma interfaz apuntando a Supabase Storage,
 * Firebase Storage, Amazon S3 o una API propia. Los componentes sólo dependen
 * de saveBlob / getBlob / deleteBlob, por lo que el reemplazo es transparente.
 */
@Injectable({ providedIn: 'root' })
export class IndexedDbService {
  private readonly dbName = 'taller-control-files';
  private readonly storeName = 'blobs';
  private readonly version = 1;
  private dbPromise?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) { return this.dbPromise; }
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async saveBlob(key: string, blob: Blob): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getBlob(key: string): Promise<Blob | undefined> {
    const db = await this.open();
    return new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).get(key);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteBlob(key: string): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
