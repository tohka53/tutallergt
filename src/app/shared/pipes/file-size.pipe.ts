import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'fileSize', standalone: false })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number | null | undefined): string {
    const b = bytes ?? 0;
    if (b < 1024) { return `${b} B`; }
    if (b < 1024 * 1024) { return `${(b / 1024).toFixed(1)} KB`; }
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  }
}
