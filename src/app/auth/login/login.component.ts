import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Role } from '../../models';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotificationService);

  hidePassword = true;
  loading = false;
  selectedRole: Role = 'mechanic';

  form = this.fb.nonNullable.group({
    email: ['mecanico@demo.com', [Validators.required, Validators.email]],
    password: ['Demo123!', [Validators.required, Validators.minLength(6)]],
  });

  selectRole(role: Role): void {
    this.selectedRole = role;
    this.form.patchValue({
      email: role === 'mechanic' ? 'mecanico@demo.com' : 'cliente@demo.com',
      password: 'Demo123!',
    });
  }

  submit(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (user) => {
        this.loading = false;
        this.notify.success(`Bienvenido, ${user.displayName}`);
        this.router.navigate([user.role === 'mechanic' ? '/app/dashboard' : '/portal/dashboard']);
      },
      error: (err: Error) => {
        this.loading = false;
        this.notify.error(err.message || 'No se pudo iniciar sesión.');
      },
    });
  }

  get email() { return this.form.controls.email; }
  get password() { return this.form.controls.password; }
}
