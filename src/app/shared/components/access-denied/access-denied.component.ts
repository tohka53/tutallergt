import { Component } from '@angular/core';
@Component({
  selector: 'app-access-denied',
  standalone: false,
  template: `
    <div class="tc-error-page">
      <mat-icon>lock</mat-icon>
      <h1>Acceso denegado</h1>
      <p>No tienes permisos para ver esta sección.</p>
      <a mat-raised-button color="primary" routerLink="/">Volver al inicio</a>
    </div>`,
  styles: [`
    .tc-error-page { text-align:center; padding:80px 20px; }
    .tc-error-page mat-icon { font-size:72px; height:72px; width:72px; color: var(--tc-status-void); }
    .tc-error-page h1 { margin:16px 0 8px; }
    .tc-error-page p { color: var(--tc-muted); margin-bottom:24px; }
  `],
})
export class AccessDeniedComponent {}
