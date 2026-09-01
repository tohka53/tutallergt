import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataSyncService } from '../../core/services/data-sync.service';
import { NotificationService } from '../../core/services/notification.service';
import { WorkshopSettingsService } from '../../core/services/workshop-settings.service';

type Modo = 'client' | 'mechanic';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private sync = inject(DataSyncService);
  private router = inject(Router);
  private notify = inject(NotificationService);
  settings = inject(WorkshopSettingsService);

  /** El cliente es quien más entra, así que su pestaña abre por omisión. */
  modo: Modo = 'client';
  hidePassword = true;
  loading = false;
  /** Mensaje largo (p. ej. "no tienes vehículos") que merece quedarse en pantalla. */
  aviso = '';

  phoneForm = this.fb.nonNullable.group({
    phone: ['', [Validators.required, Validators.pattern(/^[0-9()+\-\s]{8,20}$/)]],
  });

  mechanicForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  cambiarModo(modo: Modo): void {
    this.modo = modo;
    this.aviso = '';
  }

  get phone() { return this.phoneForm.controls.phone; }
  get email() { return this.mechanicForm.controls.email; }
  get password() { return this.mechanicForm.controls.password; }

  async entrarCliente(): Promise<void> {
    if (this.phoneForm.invalid || this.loading) { this.phoneForm.markAllAsTouched(); return; }
    this.loading = true;
    this.aviso = '';
    try {
      const user = await this.auth.loginClient(this.phone.value);
      await this.sync.loadForCurrentUser();
      this.notify.success(`Bienvenido, ${user.displayName}`);
      this.router.navigate(['/portal/dashboard']);
    } catch (e) {
      this.aviso = (e as Error).message || 'No se pudo ingresar.';
    } finally {
      this.loading = false;
    }
  }

  async entrarMecanico(): Promise<void> {
    if (this.mechanicForm.invalid || this.loading) { this.mechanicForm.markAllAsTouched(); return; }
    this.loading = true;
    this.aviso = '';
    try {
      const user = await this.auth.loginMechanic(this.email.value, this.password.value);
      await this.sync.loadForCurrentUser();
      const error = this.sync.lastError;
      if (error) { this.notify.error(error); }
      this.notify.success(`Bienvenido, ${user.displayName}`);
      this.router.navigate(['/app/dashboard']);
    } catch (e) {
      this.aviso = (e as Error).message || 'No se pudo iniciar sesión.';
    } finally {
      this.loading = false;
    }
  }
}
