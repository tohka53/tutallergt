import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private snack = inject(MatSnackBar);

  success(message: string): void {
    this.show(message, 'tc-snack-ok');
  }
  error(message: string): void {
    this.show(message, 'tc-snack-error');
  }
  info(message: string): void {
    this.show(message, 'tc-snack-info');
  }

  private show(message: string, panelClass: string): void {
    this.snack.open(message, 'Cerrar', {
      duration: 4000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: [panelClass],
    });
  }
}
